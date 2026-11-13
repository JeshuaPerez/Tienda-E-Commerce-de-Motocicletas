// Repositorio de usuarios en memoria para probar los servicios sin base de datos.
import { conflicto } from '../../src/utils/errores.js';

export function crearRepositorioUsuariosFalso() {
  const usuarios = [];
  let siguienteId = 1;

  const crear = async (datos, rol) => {
    if (usuarios.some((u) => u.correo === datos.correo)) {
      throw conflicto('El correo ya está registrado');
    }
    const usuario = { id: siguienteId++, activo: true, ...datos, rol };
    usuarios.push(usuario);
    return { ...usuario };
  };

  return {
    usuarios,
    buscarPorCorreo: async (correo) => usuarios.find((u) => u.correo === correo) ?? null,
    buscarPorId: async (id) => usuarios.find((u) => u.id === id) ?? null,
    crearCliente: (datos) => crear(datos, 'CLIENTE'),
    crearAdministrador: (datos) => crear(datos, 'ADMINISTRADOR'),
  };
}
