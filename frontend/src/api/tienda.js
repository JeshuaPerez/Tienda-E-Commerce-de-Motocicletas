// Llamadas de la tienda a la API. Cada función corresponde a un endpoint de la trazabilidad (docs/plan.md).
import { api } from '../estado/sesion.js';

export const tienda = {
  // RF 02
  listarMarcas: () => api.pedir('GET', '/marcas'),
  listarMotos: (filtros) => api.pedir('GET', '/motocicletas', { consulta: filtros }),
  obtenerMoto: (id) => api.pedir('GET', `/motocicletas/${id}`),
  listarAccesorios: () => api.pedir('GET', '/accesorios'),

  // RF 03 y RN 3
  cotizar: (items, cuponCodigo) => api.pedir('POST', '/checkout/cotizar', { cuerpo: { items, cuponCodigo: cuponCodigo || undefined } }),
  confirmarCompra: (datos) => api.pedir('POST', '/checkout', { cuerpo: datos }),

  // Historial, comprobantes (RN 4) y facturas (RF 08)
  misCompras: (pagina = 1) => api.pedir('GET', '/mis-compras', { consulta: { pagina } }),
  obtenerCompra: (id) => api.pedir('GET', `/ventas/${id}`),
  cancelarCompra: (id) => api.pedir('PATCH', `/ventas/${id}/cancelar`),
  subirComprobante(id, archivo) {
    const formulario = new FormData();
    formulario.append('comprobante', archivo);
    return api.pedir('POST', `/ventas/${id}/comprobante`, { formulario });
  },
  misFacturas: () => api.pedir('GET', '/mis-facturas'),
  obtenerFactura: (id) => api.pedir('GET', `/facturas/${id}`),
};
