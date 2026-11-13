// Lector de datos de entrada: valida campo por campo, junta todos los problemas
// y al final lanza un solo error 400 con la lista completa.
import { datosInvalidos } from './errores.js';
import { leerMonto } from './dinero.js';

const vacio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

export function crearLector(datos) {
  const fuente = datos && typeof datos === 'object' ? datos : {};
  const problemas = [];
  const falta = (campo, obligatorio) => {
    if (obligatorio) problemas.push(`${campo}: obligatorio`);
    return undefined;
  };

  return {
    tiene: (campo) => fuente[campo] !== undefined,

    texto(campo, { obligatorio = false, max = 255 } = {}) {
      const valor = fuente[campo];
      if (vacio(valor)) return falta(campo, obligatorio);
      if (typeof valor !== 'string') return void problemas.push(`${campo}: debe ser texto`);
      const limpio = valor.trim();
      if (limpio.length > max) return void problemas.push(`${campo}: máximo ${max} caracteres`);
      return limpio;
    },

    entero(campo, { obligatorio = false, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
      const valor = fuente[campo];
      if (vacio(valor)) return falta(campo, obligatorio);
      const numero = typeof valor === 'string' && /^-?\d+$/.test(valor.trim()) ? Number(valor) : valor;
      if (!Number.isInteger(numero) || numero < min || numero > max) {
        return void problemas.push(`${campo}: entero entre ${min} y ${max}`);
      }
      return numero;
    },

    monto(campo, { obligatorio = false, permitirCero = false } = {}) {
      const valor = fuente[campo];
      if (vacio(valor)) return falta(campo, obligatorio);
      try {
        return leerMonto(valor, campo, { permitirCero });
      } catch (error) {
        problemas.push(...error.detalles);
        return undefined;
      }
    },

    opcion(campo, opciones, { obligatorio = false } = {}) {
      const valor = fuente[campo];
      if (vacio(valor)) return falta(campo, obligatorio);
      if (!opciones.includes(valor)) return void problemas.push(`${campo}: debe ser ${opciones.join(', ')}`);
      return valor;
    },

    booleano(campo) {
      const valor = fuente[campo];
      if (valor === undefined) return undefined;
      if (typeof valor !== 'boolean') return void problemas.push(`${campo}: debe ser true o false`);
      return valor;
    },

    objeto(campo) {
      const valor = fuente[campo];
      if (valor === undefined || valor === null) return undefined;
      if (typeof valor !== 'object' || Array.isArray(valor)) return void problemas.push(`${campo}: debe ser un objeto`);
      return valor;
    },

    fecha(campo) {
      const valor = fuente[campo];
      if (vacio(valor)) return undefined;
      const fecha = new Date(valor);
      if (Number.isNaN(fecha.getTime())) return void problemas.push(`${campo}: fecha inválida (use AAAA-MM-DD)`);
      return fecha;
    },

    problema: (mensaje) => problemas.push(mensaje),

    terminar() {
      if (problemas.length) throw datosInvalidos(problemas);
    },
  };
}

// Valida el :id de una ruta.
export function leerId(valor, nombre = 'id') {
  const id = Number(valor);
  if (!Number.isInteger(id) || id < 1) throw datosInvalidos([`${nombre}: identificador inválido`]);
  return id;
}

// Paginación común: ?pagina=1&porPagina=20 (máximo 100 por página).
export function leerPaginacion(consulta = {}) {
  const lector = crearLector(consulta);
  const pagina = lector.entero('pagina', { min: 1 }) ?? 1;
  const porPagina = lector.entero('porPagina', { min: 1, max: 100 }) ?? 20;
  lector.terminar();
  return { pagina, porPagina, saltar: (pagina - 1) * porPagina, tomar: porPagina };
}

// Quita las claves con valor undefined (para actualizaciones parciales).
export const sinIndefinidos = (objeto) =>
  Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor !== undefined));
