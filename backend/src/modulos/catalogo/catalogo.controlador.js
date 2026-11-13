// Traduce HTTP ↔ servicio de catálogo (RF 02, PA-1). Sin reglas de negocio.
import { leerId } from '../../utils/validacion.js';

export function crearControladorCatalogo(servicio) {
  return {
    listarMarcas: async (_req, res) => res.json({ marcas: await servicio.listarMarcas() }),
    crearMarca: async (req, res) => res.status(201).json({ marca: await servicio.crearMarca(req.body) }),
    actualizarMarca: async (req, res) =>
      res.json({ marca: await servicio.actualizarMarca(leerId(req.params.id), req.body) }),

    listarModelos: async (req, res) => res.json({ modelos: await servicio.listarModelos(req.query) }),
    crearModelo: async (req, res) => res.status(201).json({ modelo: await servicio.crearModelo(req.body) }),
    actualizarModelo: async (req, res) =>
      res.json({ modelo: await servicio.actualizarModelo(leerId(req.params.id), req.body) }),

    listarCatalogo: async (req, res) => res.json(await servicio.listarCatalogo(req.query)),
    obtenerMotocicleta: async (req, res) =>
      res.json({ motocicleta: await servicio.obtenerMotocicleta(leerId(req.params.id)) }),
    crearMotocicleta: async (req, res) =>
      res.status(201).json({ motocicleta: await servicio.crearMotocicleta(req.body, req.usuario.id) }),
    actualizarMotocicleta: async (req, res) =>
      res.json({ motocicleta: await servicio.actualizarMotocicleta(leerId(req.params.id), req.body) }),
    cambiarEstado: async (req, res) =>
      res.json({ motocicleta: await servicio.cambiarEstado(leerId(req.params.id), req.body) }),

    listarAccesorios: async (_req, res) => res.json({ accesorios: await servicio.listarAccesorios() }),
    crearAccesorio: async (req, res) => res.status(201).json({ accesorio: await servicio.crearAccesorio(req.body) }),
    actualizarAccesorio: async (req, res) =>
      res.json({ accesorio: await servicio.actualizarAccesorio(leerId(req.params.id), req.body) }),
  };
}
