// Llamadas del panel de administración. Cada función corresponde a un endpoint de docs/plan.md.
import { api } from '../estado/sesion.js';

const g = (ruta, consulta) => api.pedir('GET', ruta, { consulta });
const post = (ruta, cuerpo) => api.pedir('POST', ruta, { cuerpo });
const put = (ruta, cuerpo) => api.pedir('PUT', ruta, { cuerpo });
const patch = (ruta, cuerpo) => api.pedir('PATCH', ruta, { cuerpo });

export const panel = {
  // RF 06
  resumenInventario: () => g('/inventario/resumen'),
  alertas: () => g('/inventario/alertas'),
  motocicletas: (filtros) => g('/inventario/motocicletas', filtros),
  movimientos: (filtros) => g('/inventario/movimientos', filtros),
  ajustarAccesorio: (datos) => post('/inventario/ajustes', datos),

  // RF 02 y PA-1
  marcas: () => g('/marcas'),
  crearMarca: (datos) => post('/marcas', datos),
  actualizarMarca: (id, datos) => put(`/marcas/${id}`, datos),
  modelos: (marcaId) => g('/modelos', { marcaId }),
  crearModelo: (datos) => post('/modelos', datos),
  actualizarModelo: (id, datos) => put(`/modelos/${id}`, datos),
  crearMoto: (datos) => post('/motocicletas', datos),
  actualizarMoto: (id, datos) => put(`/motocicletas/${id}`, datos),
  cambiarEstadoMoto: (id, estado) => patch(`/motocicletas/${id}/estado`, { estado }),
  accesorios: () => g('/accesorios'),
  crearAccesorio: (datos) => post('/accesorios', datos),
  actualizarAccesorio: (id, datos) => put(`/accesorios/${id}`, datos),

  // RF 07
  proveedores: () => g('/proveedores'),
  crearProveedor: (datos) => post('/proveedores', datos),
  actualizarProveedor: (id, datos) => put(`/proveedores/${id}`, datos),
  ordenes: (estado) => g('/ordenes-compra', { estado }),
  orden: (id) => g(`/ordenes-compra/${id}`),
  crearOrden: (datos) => post('/ordenes-compra', datos),
  cambiarEstadoOrden: (id, estado) => patch(`/ordenes-compra/${id}/estado`, { estado }),
  recibir: (id, datos) => post(`/ordenes-compra/${id}/recepciones`, datos),

  // RF 05
  cajaActual: () => g('/caja/actual'),
  abrirCaja: (montoInicial) => post('/caja/apertura', { montoInicial }),
  retirar: (datos) => post('/caja/retiros', datos),
  cerrarCaja: (datos) => post('/caja/cierre', datos),
  sesionesCaja: () => g('/caja/sesiones'),
  cuadre: (id) => g(`/caja/sesiones/${id}`),

  // RF 04
  vender: (datos) => post('/pos/ventas', datos),
  buscarClientes: (consulta) => g('/pos/clientes', consulta),

  // RF 03 y RN 4
  ventas: (filtros) => g('/ventas', filtros),
  venta: (id) => g(`/ventas/${id}`),
  cobrar: (id, datos) => post(`/ventas/${id}/cobro`, datos),
  entregar: (id) => patch(`/ventas/${id}/entregar`),
  cancelarVenta: (id) => patch(`/ventas/${id}/cancelar`),
  comprobantes: (estado) => g('/comprobantes', { estado }),
  aprobar: (id) => patch(`/comprobantes/${id}/aprobar`),
  rechazar: (id, motivo) => patch(`/comprobantes/${id}/rechazar`, { motivo }),
  archivoComprobante: (id) => api.pedir('GET', `/comprobantes/${id}/archivo`, { crudo: true }),

  // RF 09
  cupones: () => g('/cupones'),
  crearCupon: (datos) => post('/cupones', datos),
  actualizarCupon: (id, datos) => put(`/cupones/${id}`, datos),

  // RF 08
  facturas: (filtros) => g('/facturas', filtros),
  anularFactura: (id, motivo) => patch(`/facturas/${id}/anular`, { motivo }),
  reemitirFactura: (datos) => post('/facturas', datos),

  // RF 10
  reporte: (tipo, filtros) => g(`/reportes/${tipo}`, filtros),

  // RF 01 / PA-3
  crearAdministrador: (datos) => post('/usuarios', datos),
};
