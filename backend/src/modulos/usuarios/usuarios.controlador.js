// Traduce HTTP ↔ servicio de usuarios. Sin reglas de negocio.
export function crearControladorUsuarios(servicioUsuarios) {
  return {
    crearAdministrador: async (req, res) =>
      res.status(201).json({ usuario: await servicioUsuarios.crearAdministrador(req.body) }),
  };
}
