// Acceso a datos de usuarios con Prisma. Es la única capa del módulo que conoce la base de datos.
import { conflicto } from '../../utils/errores.js';

const CODIGO_UNICO_VIOLADO = 'P2002';

// Traduce la violación del índice único de correo (por ejemplo, dos registros simultáneos) a un 409.
async function conCorreoUnico(operacion) {
  try {
    return await operacion();
  } catch (error) {
    if (error?.code === CODIGO_UNICO_VIOLADO) throw conflicto('El correo ya está registrado');
    throw error;
  }
}

export function crearRepositorioUsuarios(prisma) {
  return {
    buscarPorCorreo: (correo) => prisma.usuario.findUnique({ where: { correo } }),

    buscarPorId: (id) => prisma.usuario.findUnique({ where: { id } }),

    // Un cliente registrado tiene también su ficha de Cliente (datos fiscales que completa después).
    crearCliente: ({ nombre, correo, hashContrasena }) =>
      conCorreoUnico(() =>
        prisma.usuario.create({
          data: { nombre, correo, hashContrasena, rol: 'CLIENTE', cliente: { create: { nombre } } },
        }),
      ),

    crearAdministrador: ({ nombre, correo, hashContrasena }) =>
      conCorreoUnico(() =>
        prisma.usuario.create({ data: { nombre, correo, hashContrasena, rol: 'ADMINISTRADOR' } }),
      ),
  };
}
