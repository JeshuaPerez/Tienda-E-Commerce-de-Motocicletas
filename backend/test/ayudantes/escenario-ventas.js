// Escenario común de la fase 3: catálogo con dos motos y un accesorio, un cliente con cuenta,
// un administrador, reloj controlable y almacén de archivos en memoria.
import { crearBaseFalsa } from './base-falsa.js';
import { crearServicioCatalogo } from '../../src/modulos/catalogo/catalogo.servicio.js';
import { crearServicioInventario } from '../../src/modulos/inventario/inventario.servicio.js';
import { crearServicioCupones } from '../../src/modulos/cupones/cupones.servicio.js';
import { crearServicioCaja } from '../../src/modulos/caja/caja.servicio.js';
import { crearServicioVentas } from '../../src/modulos/ventas/ventas.servicio.js';
import { crearServicioPos } from '../../src/modulos/pos/pos.servicio.js';
import { crearEmisorInterno } from '../../src/modulos/facturacion/emisor-interno.js';
import { crearServicioFacturacion } from '../../src/modulos/facturacion/facturacion.servicio.js';
import { crearServicioReportes } from '../../src/modulos/reportes/reportes.servicio.js';

export const ADMIN = { id: 1, rol: 'ADMINISTRADOR' };
export const CLIENTE = { id: 2, rol: 'CLIENTE' };
export const OTRO_CLIENTE = { id: 3, rol: 'CLIENTE' };

// 13 de noviembre de 2026, 09:00 en Guatemala (UTC-6).
export const HOY = new Date('2026-11-13T15:00:00Z');

export const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(100, 1)]);
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 1)]);

export function crearAlmacenFalso() {
  const archivos = new Map();
  let n = 0;
  return {
    archivos,
    guardar: async (contenido, extension) => {
      const nombre = `archivo-${++n}.${extension}`;
      archivos.set(nombre, contenido);
      return nombre;
    },
    leer: async (nombre) => archivos.get(nombre),
    eliminar: async (nombre) => void archivos.delete(nombre),
  };
}

export async function crearEscenario() {
  const base = crearBaseFalsa();
  const reloj = { ahora: HOY };
  const ahora = () => reloj.ahora;
  const almacen = crearAlmacenFalso();

  const catalogo = crearServicioCatalogo({ datos: base });
  const emisor = crearEmisorInterno({ serie: 'A', datosEmisor: { nombre: 'MotoStore GT', nit: '1234567-8', direccion: 'Ciudad de Guatemala' } });
  const servicios = {
    catalogo,
    inventario: crearServicioInventario({ datos: base }),
    cupones: crearServicioCupones({ datos: base, reloj: ahora }),
    caja: crearServicioCaja({ datos: base, reloj: ahora }),
    ventas: crearServicioVentas({ datos: base, almacen, reloj: ahora, emisor }),
    pos: crearServicioPos({ datos: base, reloj: ahora, emisor }),
    facturacion: crearServicioFacturacion({ datos: base, reloj: ahora, emisor }),
    reportes: crearServicioReportes({ datos: base, reloj: ahora }),
  };

  const marca = await catalogo.crearMarca({ nombre: 'Yamaha' });
  const modelo = await catalogo.crearModelo({ marcaId: marca.id, nombre: 'FZ 2.0', cilindrada: 149 });
  const moto1 = await catalogo.crearMotocicleta(
    { vin: 'ME1RG0710P0000001', modeloId: modelo.id, anio: 2026, color: 'Azul', precio: '25999.99' }, ADMIN.id,
  );
  const moto2 = await catalogo.crearMotocicleta(
    { vin: 'ME1RG0710P0000002', modeloId: modelo.id, anio: 2026, color: 'Negro', precio: '26500.00' }, ADMIN.id,
  );
  const casco = await catalogo.crearAccesorio({ sku: 'CAS-1', nombre: 'Casco', precio: '450.00' });
  await servicios.inventario.ajustarAccesorio({ accesorioId: casco.id, cantidad: 5, referencia: 'Inicial' }, ADMIN.id);

  await base.repos.clientes.crear({ nombre: 'Ana López', usuarioId: CLIENTE.id });
  await base.repos.clientes.crear({ nombre: 'Otro Cliente', usuarioId: OTRO_CLIENTE.id });

  return { base, reloj, almacen, servicios, modelo, moto1, moto2, casco, tablas: () => base.tablas() };
}

export const estadoMoto = (escenario, id) => escenario.tablas().motocicletas.find((m) => m.id === id).estado;
export const stockDe = (escenario, id) => escenario.tablas().accesorios.find((a) => a.id === id).stock;
