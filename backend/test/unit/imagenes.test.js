// Ampliación: imagen por modelo (subida de archivo validada por su firma real, máximo 2 MB).
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioCatalogo } from '../../src/modulos/catalogo/catalogo.servicio.js';
import { detectarTipoArchivo } from '../../src/utils/archivos.js';
import { crearBaseFalsa } from '../ayudantes/base-falsa.js';
import { PDF, PNG, crearAlmacenFalso } from '../ayudantes/escenario-ventas.js';

const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(50, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(50, 1)]);

describe('Imágenes de modelos', () => {
  let catalogo;
  let almacen;
  let modelo;

  beforeEach(async () => {
    const base = crearBaseFalsa();
    almacen = crearAlmacenFalso();
    catalogo = crearServicioCatalogo({ datos: base, almacenImagenes: almacen });
    const marca = await catalogo.crearMarca({ nombre: 'Yamaha' });
    modelo = await catalogo.crearModelo({ marcaId: marca.id, nombre: 'MT-03', cilindrada: 321 });
  });

  it('un modelo sin imagen tiene imagenUrl nula', () => {
    assert.equal(modelo.imagenUrl, null);
  });

  for (const [tipo, contenido] of [['PNG', PNG], ['JPG', JPG], ['WebP', WEBP]]) {
    it(`acepta ${tipo} y devuelve la URL pública`, async () => {
      const actualizado = await catalogo.subirImagenModelo(modelo.id, { contenido });
      assert.match(actualizado.imagenUrl, /^\/api\/imagenes\/archivo-1\.(png|jpg|webp)$/);
    });
  }

  it('rechaza un PDF o un texto aunque se llamen .png', async () => {
    await assert.rejects(catalogo.subirImagenModelo(modelo.id, { contenido: PDF }), { estado: 400 });
    await assert.rejects(catalogo.subirImagenModelo(modelo.id, { contenido: Buffer.from('<svg onload=alert(1)>') }), { estado: 400 });
    assert.equal(almacen.archivos.size, 0);
  });

  it('rechaza imágenes de más de 2 MB', async () => {
    const grande = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    await assert.rejects(catalogo.subirImagenModelo(modelo.id, { contenido: grande }), { estado: 400 });
  });

  it('al reemplazar la imagen borra el archivo anterior', async () => {
    await catalogo.subirImagenModelo(modelo.id, { contenido: PNG });
    await catalogo.subirImagenModelo(modelo.id, { contenido: JPG });
    assert.deepEqual([...almacen.archivos.keys()], ['archivo-2.jpg']);
  });

  it('quitar la imagen borra el archivo y deja imagenUrl nula', async () => {
    await catalogo.subirImagenModelo(modelo.id, { contenido: PNG });
    const sinImagen = await catalogo.quitarImagenModelo(modelo.id);
    assert.equal(sinImagen.imagenUrl, null);
    assert.equal(almacen.archivos.size, 0);
  });

  it('las motos del catálogo muestran la imagen de su modelo', async () => {
    await catalogo.subirImagenModelo(modelo.id, { contenido: PNG });
    await catalogo.crearMotocicleta({ vin: 'JYA00000000000001', modeloId: modelo.id, anio: 2026, color: 'Gris', precio: '54500' }, 1);
    const { motocicletas } = await catalogo.listarCatalogo({});
    assert.equal(motocicletas[0].modelo.imagenUrl, '/api/imagenes/archivo-1.png');
  });

  it('un modelo inexistente responde 404', async () => {
    await assert.rejects(catalogo.subirImagenModelo(999, { contenido: PNG }), { estado: 404 });
  });

  it('leer una imagen devuelve su contenido y tipo; un nombre inexistente responde 404', async () => {
    await catalogo.subirImagenModelo(modelo.id, { contenido: PNG });
    const { contenido, tipo } = await catalogo.leerImagen('archivo-1.png');
    assert.equal(tipo, 'image/png');
    assert.equal(contenido.length, PNG.length);
    await assert.rejects(catalogo.leerImagen('no-existe.png'), { estado: 404 });
    await assert.rejects(catalogo.leerImagen('../.env'), { estado: 404 });
  });
});

describe('Detección del tipo real de archivo', () => {
  it('reconoce WebP solo cuando se pide entre los tipos permitidos', () => {
    assert.equal(detectarTipoArchivo(WEBP, ['image/webp']).tipo, 'image/webp');
    assert.equal(detectarTipoArchivo(WEBP, ['image/jpeg', 'image/png', 'application/pdf']), null);
    assert.equal(detectarTipoArchivo(PDF, ['image/png']), null);
  });
});
