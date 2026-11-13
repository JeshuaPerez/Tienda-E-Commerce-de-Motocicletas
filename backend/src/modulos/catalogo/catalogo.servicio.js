// Reglas del catálogo (RF 02): marcas, modelos, motocicletas por VIN (RN 1) y accesorios (PA-1).
// Recibe "datos" (repositorios + transacción); no conoce HTTP ni Prisma.
import { conflicto, datosInvalidos, noEncontrado } from '../../utils/errores.js';
import { crearLector, leerPaginacion, sinIndefinidos } from '../../utils/validacion.js';
import { normalizarVin } from '../../utils/vin.js';
import { ESTADOS_MOTO, leerDatosUnidad, leerVin } from './catalogo.validacion.js';
import { accesorioPublico, marcaPublica, modeloPublico, motoAdmin, motoPublica } from './catalogo.representacion.js';

// Cambios de estado que se pueden hacer a mano. VENDIDA solo la asigna una venta (fase 3).
const TRANSICIONES_MANUALES = {
  DISPONIBLE: ['RESERVADA'],
  RESERVADA: ['DISPONIBLE'],
  VENDIDA: [],
};

const FORMATO_SKU = /^[A-Z0-9][A-Z0-9._-]{0,39}$/;

function leerFiltrosMotos(consulta, { conEstado }) {
  const lector = crearLector(consulta);
  const filtros = sinIndefinidos({
    marcaId: lector.entero('marcaId', { min: 1 }),
    modeloId: lector.entero('modeloId', { min: 1 }),
    cilindradaMin: lector.entero('cilindradaMin', { min: 1 }),
    cilindradaMax: lector.entero('cilindradaMax', { min: 1 }),
    precioMin: lector.monto('precioMin', { permitirCero: true }),
    precioMax: lector.monto('precioMax', { permitirCero: true }),
    estado: conEstado ? lector.opcion('estado', ESTADOS_MOTO) : undefined,
  });
  lector.terminar();
  return filtros;
}

export function crearServicioCatalogo({ datos }) {
  const { repos } = datos;

  const buscarMoto = async (repositorio, id) => {
    const moto = await repositorio.motocicletas.buscarPorId(id);
    if (!moto) throw noEncontrado('Motocicleta no encontrada');
    return moto;
  };

  const exigirNoVendida = (moto) => {
    if (moto.estado === 'VENDIDA') throw conflicto('Una motocicleta vendida no se puede modificar');
  };

  const listarMotos = async (consulta, { publico }) => {
    const filtros = leerFiltrosMotos(consulta, { conEstado: !publico });
    if (publico) filtros.estado = 'DISPONIBLE';
    const { pagina, porPagina, saltar, tomar } = leerPaginacion(consulta);
    const { items, total } = await repos.motocicletas.listar({ filtros, saltar, tomar });
    return { motocicletas: items.map(publico ? motoPublica : motoAdmin), total, pagina, porPagina };
  };

  return {
    // ───── Marcas ─────
    listarMarcas: async () => (await repos.marcas.listar()).map(marcaPublica),

    async crearMarca(entrada) {
      const lector = crearLector(entrada);
      const nombre = lector.texto('nombre', { obligatorio: true, max: 80 });
      lector.terminar();
      if (await repos.marcas.buscarPorNombre(nombre)) throw conflicto('La marca ya existe');
      return marcaPublica(await repos.marcas.crear({ nombre }));
    },

    async actualizarMarca(id, entrada) {
      const lector = crearLector(entrada);
      const nombre = lector.texto('nombre', { obligatorio: true, max: 80 });
      lector.terminar();
      if (!(await repos.marcas.buscarPorId(id))) throw noEncontrado('Marca no encontrada');
      const otra = await repos.marcas.buscarPorNombre(nombre);
      if (otra && otra.id !== id) throw conflicto('La marca ya existe');
      return marcaPublica(await repos.marcas.actualizar(id, { nombre }));
    },

    // ───── Modelos ─────
    async listarModelos(consulta = {}) {
      const lector = crearLector(consulta);
      const marcaId = lector.entero('marcaId', { min: 1 });
      lector.terminar();
      return (await repos.modelos.listar({ marcaId })).map(modeloPublico);
    },

    async crearModelo(entrada) {
      const lector = crearLector(entrada);
      const marcaId = lector.entero('marcaId', { obligatorio: true, min: 1 });
      const nombre = lector.texto('nombre', { obligatorio: true, max: 100 });
      const cilindrada = lector.entero('cilindrada', { obligatorio: true, min: 1, max: 3000 });
      const stockMinimo = lector.entero('stockMinimo', { min: 0, max: 1000 }) ?? 0;
      lector.terminar();

      if (!(await repos.marcas.buscarPorId(marcaId))) throw noEncontrado('Marca no encontrada');
      if (await repos.modelos.buscarPorNombre(marcaId, nombre)) throw conflicto('El modelo ya existe en esa marca');
      const modelo = await repos.modelos.crear({ marcaId, nombre, cilindrada, stockMinimo });
      return modeloPublico(await repos.modelos.buscarPorId(modelo.id));
    },

    async actualizarModelo(id, entrada) {
      const lector = crearLector(entrada);
      const cambios = sinIndefinidos({
        nombre: lector.texto('nombre', { max: 100 }),
        cilindrada: lector.entero('cilindrada', { min: 1, max: 3000 }),
        stockMinimo: lector.entero('stockMinimo', { min: 0, max: 1000 }),
      });
      lector.terminar();

      const modelo = await repos.modelos.buscarPorId(id);
      if (!modelo) throw noEncontrado('Modelo no encontrado');
      if (cambios.nombre) {
        const otro = await repos.modelos.buscarPorNombre(modelo.marcaId, cambios.nombre);
        if (otro && otro.id !== id) throw conflicto('El modelo ya existe en esa marca');
      }
      await repos.modelos.actualizar(id, cambios);
      return modeloPublico(await repos.modelos.buscarPorId(id));
    },

    // ───── Motocicletas ─────
    listarCatalogo: (consulta = {}) => listarMotos(consulta, { publico: true }),
    listarMotocicletasAdmin: (consulta = {}) => listarMotos(consulta, { publico: false }),

    obtenerMotocicleta: async (id, { admin = false } = {}) => {
      const moto = await buscarMoto(repos, id);
      return admin ? motoAdmin(moto) : motoPublica(moto);
    },

    // RN 1: el VIN es obligatorio, válido y único. El alta deja una ENTRADA en el inventario (RF 06).
    async crearMotocicleta(entrada, usuarioId) {
      const lector = crearLector(entrada);
      const vin = leerVin(lector);
      const modeloId = lector.entero('modeloId', { obligatorio: true, min: 1 });
      const unidad = leerDatosUnidad(lector);
      const costoAdquisicion = lector.monto('costoAdquisicion', { permitirCero: true });
      lector.terminar();

      return datos.ejecutar(async (r) => {
        if (!(await r.modelos.buscarPorId(modeloId))) throw noEncontrado('Modelo no encontrado');
        if (await r.motocicletas.buscarPorVin(vin)) throw conflicto(`El VIN ${vin} ya está registrado`);

        const moto = await r.motocicletas.crear(sinIndefinidos({ vin, modeloId, ...unidad, costoAdquisicion }));
        await r.movimientos.registrar({
          tipo: 'ENTRADA', motivo: 'ALTA_MANUAL', cantidad: 1, motocicletaId: moto.id,
          referencia: 'Alta manual de unidad', usuarioId,
        });
        return motoAdmin(await r.motocicletas.buscarPorId(moto.id));
      });
    },

    async actualizarMotocicleta(id, entrada) {
      const lector = crearLector(entrada);
      if (lector.tiene('estado')) lector.problema('estado: use PATCH /api/motocicletas/:id/estado');
      if (lector.tiene('stock')) lector.problema('stock: no aplica a una motocicleta');
      const cambios = sinIndefinidos({
        modeloId: lector.entero('modeloId', { min: 1 }),
        ...leerDatosUnidad(lector, { parcial: true }),
        costoAdquisicion: lector.monto('costoAdquisicion', { permitirCero: true }),
      });
      lector.terminar();

      const moto = await buscarMoto(repos, id);
      if (entrada?.vin !== undefined && normalizarVin(entrada.vin) !== moto.vin) {
        throw datosInvalidos(['vin: el VIN no se puede modificar']);
      }
      exigirNoVendida(moto);
      if (cambios.modeloId && !(await repos.modelos.buscarPorId(cambios.modeloId))) {
        throw noEncontrado('Modelo no encontrado');
      }
      await repos.motocicletas.actualizar(id, cambios);
      return motoAdmin(await repos.motocicletas.buscarPorId(id));
    },

    // Bloquea la fila de la moto para que una venta simultánea no la cambie a la vez.
    async cambiarEstado(id, entrada) {
      const lector = crearLector(entrada);
      const estado = lector.opcion('estado', ESTADOS_MOTO, { obligatorio: true });
      lector.terminar();

      return datos.ejecutar(async (r) => {
        await r.motocicletas.bloquear(id);
        const moto = await buscarMoto(r, id);
        exigirNoVendida(moto);
        if (estado === 'VENDIDA') throw conflicto('Solo una venta puede marcar una motocicleta como vendida');
        if (!TRANSICIONES_MANUALES[moto.estado].includes(estado)) {
          throw conflicto(`No se puede pasar de ${moto.estado} a ${estado}`);
        }
        await r.motocicletas.actualizar(id, { estado });
        return motoAdmin(await r.motocicletas.buscarPorId(id));
      });
    },

    // ───── Accesorios (PA-1) ─────
    listarAccesorios: async ({ soloActivos = true } = {}) =>
      (await repos.accesorios.listar({ soloActivos })).map(accesorioPublico),

    async crearAccesorio(entrada) {
      const lector = crearLector(entrada);
      const skuTexto = lector.texto('sku', { obligatorio: true, max: 40 });
      const sku = skuTexto?.toUpperCase();
      if (sku && !FORMATO_SKU.test(sku)) lector.problema('sku: solo letras, números, punto, guion y guion bajo');
      const nuevo = {
        sku,
        nombre: lector.texto('nombre', { obligatorio: true, max: 120 }),
        descripcion: lector.texto('descripcion', { max: 2000 }),
        precio: lector.monto('precio', { obligatorio: true }),
        stockMinimo: lector.entero('stockMinimo', { min: 0, max: 100000 }) ?? 0,
      };
      lector.terminar();

      if (await repos.accesorios.buscarPorSku(sku)) throw conflicto(`El SKU ${sku} ya existe`);
      return accesorioPublico(await repos.accesorios.crear(sinIndefinidos(nuevo)));
    },

    async actualizarAccesorio(id, entrada) {
      const lector = crearLector(entrada);
      if (lector.tiene('stock')) lector.problema('stock: se modifica con compras o ajustes de inventario');
      if (lector.tiene('sku')) lector.problema('sku: no se puede modificar');
      const cambios = sinIndefinidos({
        nombre: lector.texto('nombre', { max: 120 }),
        descripcion: lector.texto('descripcion', { max: 2000 }),
        precio: lector.monto('precio'),
        stockMinimo: lector.entero('stockMinimo', { min: 0, max: 100000 }),
        activo: lector.booleano('activo'),
      });
      lector.terminar();

      if (!(await repos.accesorios.buscarPorId(id))) throw noEncontrado('Accesorio no encontrado');
      return accesorioPublico(await repos.accesorios.actualizar(id, cambios));
    },
  };
}
