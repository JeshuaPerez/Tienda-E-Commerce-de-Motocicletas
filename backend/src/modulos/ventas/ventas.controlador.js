// Traduce HTTP ↔ servicio de ventas web (RF 03, RN 3, RN 4). Sin reglas de negocio.
import { datosInvalidos } from '../../utils/errores.js';
import { leerId } from '../../utils/validacion.js';

export function crearControladorVentas(servicio) {
  return {
    cotizar: async (req, res) => res.json(await servicio.cotizar(req.body)),
    checkout: async (req, res) => res.status(201).json({ venta: await servicio.checkout(req.body, req.usuario.id) }),
    misCompras: async (req, res) => res.json(await servicio.misCompras(req.usuario.id, req.query)),

    listar: async (req, res) => res.json(await servicio.listarVentas(req.query)),
    obtener: async (req, res) => res.json({ venta: await servicio.obtenerVenta(leerId(req.params.id), req.usuario) }),

    async subirComprobante(req, res) {
      if (!req.file) throw datosInvalidos(['comprobante: adjunte el archivo en el campo "comprobante"']);
      const archivo = { contenido: req.file.buffer, tamano: req.file.size };
      res.status(201).json({ venta: await servicio.subirComprobante(leerId(req.params.id), archivo, req.usuario) });
    },

    cobrar: async (req, res) => res.json({ venta: await servicio.cobrarEnTienda(leerId(req.params.id), req.body, req.usuario.id) }),
    entregar: async (req, res) => res.json({ venta: await servicio.entregar(leerId(req.params.id)) }),
    cancelar: async (req, res) => res.json({ venta: await servicio.cancelar(leerId(req.params.id), req.usuario) }),

    listarComprobantes: async (req, res) => res.json({ comprobantes: await servicio.listarComprobantes(req.query) }),
    aprobar: async (req, res) => res.json({ venta: await servicio.aprobarComprobante(leerId(req.params.id), req.usuario.id) }),
    rechazar: async (req, res) =>
      res.json({ venta: await servicio.rechazarComprobante(leerId(req.params.id), req.body, req.usuario.id) }),

    // El archivo se envía con su tipo real y "nosniff" para que el navegador no lo interprete como otra cosa.
    async archivo(req, res) {
      const { contenido, tipo } = await servicio.leerArchivoComprobante(leerId(req.params.id), req.usuario);
      res.set({ 'Content-Type': tipo, 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' }).send(contenido);
    },
  };
}
