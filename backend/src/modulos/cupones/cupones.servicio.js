// Cupones (RF 09): porcentaje o monto fijo, vigencia por días de Guatemala, límite de usos y canal (PA-12).
import { finDelDia, inicioDelDia } from '../../config/negocio.js';
import { conflicto, datosInvalidos, noEncontrado } from '../../utils/errores.js';
import { formatearMonto } from '../../utils/dinero.js';
import { crearLector, sinIndefinidos } from '../../utils/validacion.js';

export const TIPOS_CUPON = ['PORCENTAJE', 'MONTO_FIJO'];
export const CANALES_CUPON = ['WEB', 'POS', 'AMBOS'];
const FORMATO_CODIGO = /^[A-Z0-9_-]{3,40}$/;
const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

export const normalizarCodigo = (codigo) => (typeof codigo === 'string' ? codigo.trim().toUpperCase() : '');

export const cuponPublico = (c) =>
  c && {
    id: c.id,
    codigo: c.codigo,
    tipo: c.tipo,
    valor: formatearMonto(c.valor),
    vigenteDesde: new Date(c.vigenteDesde),
    vigenteHasta: new Date(c.vigenteHasta),
    usosMaximos: c.usosMaximos ?? null,
    usosActuales: c.usosActuales,
    canal: c.canal,
    activo: c.activo,
  };

function leerDia(lector, campo, obligatorio) {
  const texto = lector.texto(campo, { obligatorio, max: 10 });
  if (texto === undefined) return undefined;
  if (!FORMATO_DIA.test(texto) || Number.isNaN(inicioDelDia(texto).getTime())) {
    lector.problema(`${campo}: use el formato AAAA-MM-DD`);
    return undefined;
  }
  return texto;
}

function leerCupon(entrada, { parcial, actual }) {
  const lector = crearLector(entrada);
  const codigo = parcial ? undefined : normalizarCodigo(lector.texto('codigo', { obligatorio: true, max: 40 }));
  if (parcial && lector.tiene('codigo')) lector.problema('codigo: no se puede modificar');
  if (codigo !== undefined && codigo !== '' && !FORMATO_CODIGO.test(codigo)) {
    lector.problema('codigo: de 3 a 40 letras, números, guion o guion bajo, sin espacios');
  }
  const tipo = lector.opcion('tipo', TIPOS_CUPON, { obligatorio: !parcial });
  const valor = lector.monto('valor', { obligatorio: !parcial });
  const desde = leerDia(lector, 'vigenteDesde', !parcial);
  const hasta = leerDia(lector, 'vigenteHasta', !parcial);
  const usosMaximos = entrada?.usosMaximos === null ? null : lector.entero('usosMaximos', { min: 1, max: 1000000 });
  const datos = sinIndefinidos({
    codigo,
    tipo,
    valor,
    vigenteDesde: desde && inicioDelDia(desde),
    vigenteHasta: hasta && finDelDia(hasta),
    usosMaximos,
    canal: lector.opcion('canal', CANALES_CUPON),
    activo: lector.booleano('activo'),
  });
  lector.terminar();

  const final = { ...actual, ...datos };
  if (final.tipo === 'PORCENTAJE' && final.valor !== undefined && Number(final.valor) > 100) {
    throw datosInvalidos(['valor: un porcentaje no puede ser mayor que 100']);
  }
  if (final.vigenteDesde && final.vigenteHasta && new Date(final.vigenteHasta) < new Date(final.vigenteDesde)) {
    throw datosInvalidos(['vigenteHasta: debe ser igual o posterior a vigenteDesde']);
  }
  return datos;
}

// Comprueba que un cupón se pueda usar ahora en el canal dado. Lanza 404/409 si no.
export async function buscarCuponAplicable(repos, codigo, canal, ahora) {
  const cupon = await repos.cupones.buscarPorCodigo(normalizarCodigo(codigo));
  if (!cupon) throw noEncontrado('Cupón no encontrado');
  if (!cupon.activo) throw conflicto('El cupón no está activo');
  if (ahora < new Date(cupon.vigenteDesde) || ahora > new Date(cupon.vigenteHasta)) {
    throw conflicto('El cupón no está vigente');
  }
  if (cupon.canal !== 'AMBOS' && cupon.canal !== canal) {
    throw conflicto(canal === 'WEB' ? 'El cupón solo es válido en la tienda física' : 'El cupón solo es válido en la tienda web');
  }
  if (cupon.usosMaximos !== null && cupon.usosActuales >= cupon.usosMaximos) {
    throw conflicto('El cupón ya alcanzó su límite de usos');
  }
  return cupon;
}

export function crearServicioCupones({ datos }) {
  const { repos } = datos;
  return {
    listarCupones: async () => (await repos.cupones.listar()).map(cuponPublico),

    async crearCupon(entrada) {
      const nuevo = leerCupon(entrada, { parcial: false, actual: {} });
      if (await repos.cupones.buscarPorCodigo(nuevo.codigo)) throw conflicto(`El cupón ${nuevo.codigo} ya existe`);
      return cuponPublico(await repos.cupones.crear(nuevo));
    },

    async actualizarCupon(id, entrada) {
      const actual = await repos.cupones.buscarPorId(id);
      if (!actual) throw noEncontrado('Cupón no encontrado');
      const cambios = leerCupon(entrada, { parcial: true, actual });
      if (cambios.usosMaximos && cambios.usosMaximos < actual.usosActuales) {
        throw conflicto(`El cupón ya se usó ${actual.usosActuales} veces; el límite no puede ser menor`);
      }
      return cuponPublico(await repos.cupones.actualizar(id, cambios));
    },
  };
}
