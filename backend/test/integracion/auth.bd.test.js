// RF 01 contra PostgreSQL real (base _test). Se omite si no hay DATABASE_URL_TEST en backend/.env.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { obtenerPrisma, desconectarPrisma } from '../../src/db/prisma.js';
import { crearRepositorioUsuarios } from '../../src/modulos/usuarios/usuarios.repositorio.js';
import { crearServicioUsuarios } from '../../src/modulos/usuarios/usuarios.servicio.js';
import { crearServicioContrasenas } from '../../src/utils/contrasenas.js';
import { levantarServidor } from '../ayudantes/servidor.js';

const hayBaseDePruebas = Boolean(process.env.DATABASE_URL_TEST);
const cliente = { nombre: 'María Pérez', correo: 'maria@correo.com', contrasena: 'clave-maria-1' };

describe('RF 01 · integración con PostgreSQL', { skip: !hayBaseDePruebas && 'falta DATABASE_URL_TEST' }, () => {
  let prisma;
  let api;

  before(async () => {
    // Seguro: solo se vacían tablas de una base cuyo nombre termina en _test.
    assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'), 'la base de pruebas debe terminar en _test');
    prisma = obtenerPrisma();
    api = await levantarServidor();
  });

  beforeEach(() => prisma.$executeRawUnsafe('TRUNCATE TABLE "clientes", "usuarios" RESTART IDENTITY CASCADE'));

  after(async () => {
    await api?.cerrar();
    await desconectarPrisma();
  });

  it('el registro guarda el usuario con hash bcrypt y su ficha de cliente', async () => {
    const { estado } = await api.pedir('POST', '/api/auth/registro', { cuerpo: cliente });
    assert.equal(estado, 201);

    const guardado = await prisma.usuario.findUnique({ where: { correo: cliente.correo }, include: { cliente: true } });
    assert.equal(guardado.rol, 'CLIENTE');
    assert.match(guardado.hashContrasena, /^\$2[aby]\$/);
    assert.equal(guardado.cliente.nombre, cliente.nombre);
  });

  it('el índice único de correo impide duplicados aunque los registros lleguen a la vez', async () => {
    const respuestas = await Promise.all([
      api.pedir('POST', '/api/auth/registro', { cuerpo: cliente }),
      api.pedir('POST', '/api/auth/registro', { cuerpo: { ...cliente, correo: 'MARIA@correo.com' } }),
    ]);
    const estados = respuestas.map((r) => r.estado).sort();
    assert.deepEqual(estados, [201, 409]);
    assert.equal(await prisma.usuario.count(), 1);
  });

  it('login y perfil funcionan con datos reales', async () => {
    await api.pedir('POST', '/api/auth/registro', { cuerpo: cliente });
    const login = await api.pedir('POST', '/api/auth/login', { cuerpo: cliente });
    assert.equal(login.estado, 200);
    const perfil = await api.pedir('GET', '/api/auth/perfil', { token: login.cuerpo.token });
    assert.equal(perfil.cuerpo.usuario.correo, cliente.correo);
  });

  it('el seed del administrador inicial es idempotente', async () => {
    const servicio = crearServicioUsuarios({
      repositorioUsuarios: crearRepositorioUsuarios(prisma),
      contrasenas: crearServicioContrasenas(4),
    });
    const datos = { nombre: 'Admin', correo: 'admin@motostore.gt', contrasena: 'clave-admin-123' };
    assert.equal((await servicio.asegurarAdministradorInicial(datos)).creado, true);
    assert.equal((await servicio.asegurarAdministradorInicial(datos)).creado, false);
    assert.equal(await prisma.usuario.count({ where: { rol: 'ADMINISTRADOR' } }), 1);
  });
});
