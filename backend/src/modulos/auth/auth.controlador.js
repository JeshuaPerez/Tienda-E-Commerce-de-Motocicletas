// Traduce HTTP ↔ servicio de autenticación. Sin reglas de negocio.
export function crearControladorAuth(servicioAuth) {
  return {
    registrar: async (req, res) => res.status(201).json(await servicioAuth.registrarCliente(req.body)),
    iniciarSesion: async (req, res) => res.json(await servicioAuth.iniciarSesion(req.body)),
    perfil: async (req, res) => res.json({ usuario: await servicioAuth.obtenerPerfil(req.usuario.id) }),
  };
}
