// Error de aplicación con su código HTTP. El manejador de errores lo convierte en respuesta JSON.
export class ErrorAplicacion extends Error {
  constructor(estado, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorAplicacion';
    this.estado = estado;
    this.detalles = detalles;
  }
}

export const datosInvalidos = (detalles) => new ErrorAplicacion(400, 'Datos inválidos', detalles);
export const noAutenticado = (mensaje = 'Debe iniciar sesión') => new ErrorAplicacion(401, mensaje);
export const sinPermiso = (mensaje = 'No tiene permiso para esta acción') => new ErrorAplicacion(403, mensaje);
export const noEncontrado = (mensaje = 'Recurso no encontrado') => new ErrorAplicacion(404, mensaje);
export const conflicto = (mensaje) => new ErrorAplicacion(409, mensaje);
