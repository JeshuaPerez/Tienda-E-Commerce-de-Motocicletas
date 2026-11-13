// Formas públicas de las entidades del catálogo. Los montos salen como texto con 2 decimales (GTQ).
import { formatearMonto } from '../../utils/dinero.js';

export const marcaPublica = (m) => m && { id: m.id, nombre: m.nombre };

export const modeloPublico = (m) =>
  m && {
    id: m.id,
    nombre: m.nombre,
    cilindrada: m.cilindrada,
    stockMinimo: m.stockMinimo,
    imagenUrl: m.imagen ? `/api/imagenes/${m.imagen}` : null,
    marca: marcaPublica(m.marca),
  };

// Lo que ve cualquier visitante del catálogo: sin costo de adquisición ni datos internos.
export const motoPublica = (m) =>
  m && {
    id: m.id,
    vin: m.vin,
    anio: m.anio,
    color: m.color,
    precio: formatearMonto(m.precio),
    descripcion: m.descripcion ?? null,
    fichaTecnica: m.fichaTecnica ?? null,
    estado: m.estado,
    modelo: modeloPublico(m.modelo),
  };

// Lo que ve el administrador: incluye costo y origen de la unidad.
export const motoAdmin = (m) =>
  m && {
    ...motoPublica(m),
    costoAdquisicion: formatearMonto(m.costoAdquisicion),
    recepcionId: m.recepcionId ?? null,
    creadoEn: m.creadoEn,
  };

export const accesorioPublico = (a) =>
  a && {
    id: a.id,
    sku: a.sku,
    nombre: a.nombre,
    descripcion: a.descripcion ?? null,
    precio: formatearMonto(a.precio),
    stock: a.stock,
    stockMinimo: a.stockMinimo,
    activo: a.activo,
  };
