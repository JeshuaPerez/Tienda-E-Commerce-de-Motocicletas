// Traduce HTTP ↔ servicio de compras (RF 07). Sin reglas de negocio.
import { leerId } from '../../utils/validacion.js';

export function crearControladorCompras(servicio) {
  return {
    listarProveedores: async (_req, res) => res.json({ proveedores: await servicio.listarProveedores() }),
    obtenerProveedor: async (req, res) => res.json({ proveedor: await servicio.obtenerProveedor(leerId(req.params.id)) }),
    crearProveedor: async (req, res) => res.status(201).json({ proveedor: await servicio.crearProveedor(req.body) }),
    actualizarProveedor: async (req, res) =>
      res.json({ proveedor: await servicio.actualizarProveedor(leerId(req.params.id), req.body) }),

    listarOrdenes: async (req, res) => res.json({ ordenes: await servicio.listarOrdenes(req.query) }),
    obtenerOrden: async (req, res) => res.json({ orden: await servicio.obtenerOrden(leerId(req.params.id)) }),
    crearOrden: async (req, res) => res.status(201).json({ orden: await servicio.crearOrden(req.body, req.usuario.id) }),
    cambiarEstadoOrden: async (req, res) =>
      res.json({ orden: await servicio.cambiarEstadoOrden(leerId(req.params.id), req.body) }),
    recibirMercancia: async (req, res) =>
      res.status(201).json(await servicio.recibirMercancia(leerId(req.params.id), req.body, req.usuario.id)),
  };
}
