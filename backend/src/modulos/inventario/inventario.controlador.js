// Traduce HTTP ↔ servicios de inventario (RF 06). Sin reglas de negocio.
export function crearControladorInventario({ servicioInventario, servicioCatalogo }) {
  return {
    resumen: async (_req, res) => res.json(await servicioInventario.obtenerResumen()),
    alertas: async (_req, res) => res.json(await servicioInventario.obtenerAlertas()),
    motocicletas: async (req, res) => res.json(await servicioCatalogo.listarMotocicletasAdmin(req.query)),
    movimientos: async (req, res) => res.json(await servicioInventario.listarMovimientos(req.query)),
    ajustar: async (req, res) => res.status(201).json(await servicioInventario.ajustarAccesorio(req.body, req.usuario.id)),
  };
}
