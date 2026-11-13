// PA-3: el primer administrador sale del seed; los demás los crea un administrador.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioUsuarios } from '../../src/modulos/usuarios/usuarios.servicio.js';
import { crearServicioContrasenas } from '../../src/utils/contrasenas.js';
import { crearRepositorioUsuariosFalso } from './repositorio-falso.js';

const datosAdmin = { nombre: 'Admin Principal', correo: 'admin@motostore.gt', contrasena: 'clave-admin-123' };

describe('PA-3 · servicio de usuarios', () => {
  let repositorio;
  let servicio;

  beforeEach(() => {
    repositorio = crearRepositorioUsuariosFalso();
    servicio = crearServicioUsuarios({
      repositorioUsuarios: repositorio,
      contrasenas: crearServicioContrasenas(4),
    });
  });

  it('un administrador crea otro administrador', async () => {
    const usuario = await servicio.crearAdministrador(datosAdmin);
    assert.equal(usuario.rol, 'ADMINISTRADOR');
    assert.equal(usuario.hashContrasena, undefined);
  });

  it('el administrador inicial se crea una sola vez (el seed se puede repetir)', async () => {
    const primera = await servicio.asegurarAdministradorInicial(datosAdmin);
    const segunda = await servicio.asegurarAdministradorInicial(datosAdmin);
    assert.equal(primera.creado, true);
    assert.equal(segunda.creado, false);
    assert.equal(repositorio.usuarios.length, 1);
  });

  it('el seed falla si el correo ya pertenece a un cliente', async () => {
    await repositorio.crearCliente({ nombre: 'X', correo: datosAdmin.correo, hashContrasena: 'h' });
    await assert.rejects(servicio.asegurarAdministradorInicial(datosAdmin), { estado: 409 });
  });

  it('el seed exige correo, nombre y contraseña válidos', async () => {
    await assert.rejects(
      servicio.asegurarAdministradorInicial({ ...datosAdmin, contrasena: '' }),
      { estado: 400 },
    );
  });
});
