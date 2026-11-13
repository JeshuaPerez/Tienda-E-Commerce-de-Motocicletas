// Inventario (RF 06): resumen por modelo, alertas de stock bajo, bitácora de movimientos y ajustes.
import { conflicto, datosInvalidos, noEncontrado } from '../../utils/errores.js';
import { crearLector, leerPaginacion, sinIndefinidos } from '../../utils/validacion.js';
import { accesorioPublico, marcaPublica } from '../catalogo/catalogo.representacion.js';

export const TIPOS_MOVIMIENTO = ['ENTRADA', 'SALIDA'];
export const MOTIVOS_MOVIMIENTO = ['COMPRA', 'ALTA_MANUAL', 'AJUSTE'];

// Hay alerta cuando lo disponible llega al mínimo o baja de él. Un mínimo de 0 desactiva la alerta.
const enAlerta = (cantidad, minimo) => minimo > 0 && cantidad <= minimo;

const movimientoPublico = (m) => ({
  id: m.id,
  tipo: m.tipo,
  motivo: m.motivo,
  cantidad: m.cantidad,
  motocicletaId: m.motocicletaId ?? null,
  vin: m.motocicleta?.vin ?? null,
  accesorioId: m.accesorioId ?? null,
  sku: m.accesorio?.sku ?? null,
  referencia: m.referencia ?? null,
  usuarioId: m.usuarioId,
  fecha: m.fecha,
});

export function crearServicioInventario({ datos }) {
  const { repos } = datos;

  async function obtenerResumen() {
    const [modelos, conteos, accesorios] = await Promise.all([
      repos.modelos.listar(),
      repos.motocicletas.contarPorModeloYEstado(),
      repos.accesorios.listar({ soloActivos: true }),
    ]);
    const contar = (modeloId, estado) =>
      conteos.find((c) => c.modeloId === modeloId && c.estado === estado)?.cantidad ?? 0;

    return {
      modelos: modelos.map((m) => {
        const disponibles = contar(m.id, 'DISPONIBLE');
        return {
          id: m.id,
          nombre: m.nombre,
          marca: marcaPublica(m.marca),
          cilindrada: m.cilindrada,
          stockMinimo: m.stockMinimo,
          disponibles,
          reservadas: contar(m.id, 'RESERVADA'),
          vendidas: contar(m.id, 'VENDIDA'),
          alerta: enAlerta(disponibles, m.stockMinimo),
        };
      }),
      accesorios: accesorios.map((a) => ({ ...accesorioPublico(a), alerta: enAlerta(a.stock, a.stockMinimo) })),
    };
  }

  return {
    obtenerResumen,

    async obtenerAlertas() {
      const { modelos, accesorios } = await obtenerResumen();
      return { modelos: modelos.filter((m) => m.alerta), accesorios: accesorios.filter((a) => a.alerta) };
    },

    async listarMovimientos(consulta = {}) {
      const lector = crearLector(consulta);
      const filtros = sinIndefinidos({
        tipo: lector.opcion('tipo', TIPOS_MOVIMIENTO),
        motivo: lector.opcion('motivo', MOTIVOS_MOVIMIENTO),
        motocicletaId: lector.entero('motocicletaId', { min: 1 }),
        accesorioId: lector.entero('accesorioId', { min: 1 }),
        desde: lector.fecha('desde'),
        hasta: lector.fecha('hasta'),
      });
      lector.terminar();
      const { pagina, porPagina, saltar, tomar } = leerPaginacion(consulta);
      const { items, total } = await repos.movimientos.listar({ filtros, saltar, tomar });
      return { movimientos: items.map(movimientoPublico), total, pagina, porPagina };
    },

    // Entrada (cantidad > 0) o salida (cantidad < 0) manual de un accesorio, con motivo obligatorio.
    async ajustarAccesorio(entrada, usuarioId) {
      const lector = crearLector(entrada);
      const accesorioId = lector.entero('accesorioId', { obligatorio: true, min: 1 });
      const cantidad = lector.entero('cantidad', { obligatorio: true, min: -100000, max: 100000 });
      const referencia = lector.texto('referencia', { obligatorio: true, max: 200 });
      lector.terminar();
      if (cantidad === 0) throw datosInvalidos(['cantidad: debe ser distinta de cero']);

      return datos.ejecutar(async (r) => {
        const accesorio = await r.accesorios.buscarPorId(accesorioId);
        if (!accesorio) throw noEncontrado('Accesorio no encontrado');
        if (!(await r.accesorios.ajustarStock(accesorioId, cantidad))) {
          throw conflicto(`Stock insuficiente: hay ${accesorio.stock} unidades de ${accesorio.sku}`);
        }
        const movimiento = await r.movimientos.registrar({
          tipo: cantidad > 0 ? 'ENTRADA' : 'SALIDA',
          motivo: 'AJUSTE',
          cantidad: Math.abs(cantidad),
          accesorioId,
          referencia,
          usuarioId,
        });
        return {
          accesorio: accesorioPublico(await r.accesorios.buscarPorId(accesorioId)),
          movimiento: movimientoPublico(movimiento),
        };
      });
    },
  };
}
