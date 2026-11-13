// Reglas de registro e inicio de sesión (RF 01). No conoce HTTP ni Prisma: recibe sus dependencias.
import { datosInvalidos, noAutenticado, noEncontrado } from '../../utils/errores.js';
import { normalizarCorreo, usuarioPublico, validarDatosCuenta } from '../usuarios/usuarios.validacion.js';

const CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos';

export function crearServicioAuth({ repositorioUsuarios, contrasenas, tokens }) {
  const sesionDe = (usuario) => ({ usuario: usuarioPublico(usuario), token: tokens.firmar(usuario) });

  return {
    // PA-3: el registro público siempre crea un CLIENTE; cualquier "rol" enviado se ignora.
    async registrarCliente(datos) {
      const { nombre, correo, contrasena } = validarDatosCuenta(datos);
      const hashContrasena = await contrasenas.cifrar(contrasena);
      const usuario = await repositorioUsuarios.crearCliente({ nombre, correo, hashContrasena });
      return sesionDe(usuario);
    },

    async iniciarSesion(datos = {}) {
      const correo = normalizarCorreo(datos.correo);
      const contrasena = typeof datos.contrasena === 'string' ? datos.contrasena : '';
      if (!correo || !contrasena) throw datosInvalidos(['correo y contrasena son obligatorios']);

      const usuario = await repositorioUsuarios.buscarPorCorreo(correo);
      // Mismo mensaje para correo inexistente, clave incorrecta o cuenta inactiva:
      // así no se revela qué correos están registrados.
      const valido = usuario && usuario.activo && (await contrasenas.comparar(contrasena, usuario.hashContrasena));
      if (!valido) throw noAutenticado(CREDENCIALES_INVALIDAS);

      return sesionDe(usuario);
    },

    async obtenerPerfil(id) {
      const usuario = await repositorioUsuarios.buscarPorId(id);
      if (!usuario) throw noEncontrado('Usuario no encontrado');
      return usuarioPublico(usuario);
    },
  };
}
