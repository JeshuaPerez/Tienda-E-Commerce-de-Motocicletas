// Gestión de administradores (PA-3): el primero sale del seed y los demás los crea un administrador.
import { conflicto } from '../../utils/errores.js';
import { usuarioPublico, validarDatosCuenta } from './usuarios.validacion.js';

export function crearServicioUsuarios({ repositorioUsuarios, contrasenas }) {
  const crearAdministrador = async (datos) => {
    const { nombre, correo, contrasena } = validarDatosCuenta(datos);
    const hashContrasena = await contrasenas.cifrar(contrasena);
    return usuarioPublico(await repositorioUsuarios.crearAdministrador({ nombre, correo, hashContrasena }));
  };

  return {
    crearAdministrador,

    // Idempotente: si el administrador ya existe, no hace nada. Así el seed se puede repetir.
    async asegurarAdministradorInicial(datos) {
      const { correo } = validarDatosCuenta(datos);
      const existente = await repositorioUsuarios.buscarPorCorreo(correo);
      if (existente) {
        if (existente.rol !== 'ADMINISTRADOR') {
          throw conflicto('El correo del administrador inicial ya pertenece a un cliente');
        }
        return { creado: false, usuario: usuarioPublico(existente) };
      }
      return { creado: true, usuario: await crearAdministrador(datos) };
    },
  };
}
