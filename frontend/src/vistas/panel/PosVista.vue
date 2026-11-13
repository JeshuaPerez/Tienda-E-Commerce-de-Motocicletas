<script setup>
// RF 04: venta rápida en mostrador. Asocia cliente (por NIT o nuevo), vendedor (el admin con sesión, PA-2),
// motocicletas Disponibles y accesorios, cupón (PA-12) y método de pago (PA-5). Exige la caja del día (RN 5).
import { computed, onMounted, reactive, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import { sesion } from '../../estado/sesion.js';
import { aCentavos, desdeCentavos, formatearQuetzales } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const caja = ref(null);
const motos = ref([]);
const accesorios = ref([]);
const busqueda = ref('');
const clientesEncontrados = ref([]);
const venta = reactive({ clienteId: null, cliente: { nombre: '', nit: '', direccion: '', telefono: '' }, motos: [], accesorios: {}, cuponCodigo: '', metodo: 'EFECTIVO', referencia: '' });
const resultado = ref(null);
const { cargando, error, ejecutar } = usarAccion();

const cajaLista = computed(() => caja.value?.caja && caja.value.esDelDia);
const elegidas = computed(() => motos.value.filter((m) => venta.motos.includes(m.id)));
const subtotal = computed(() => desdeCentavos(
  elegidas.value.reduce((s, m) => s + aCentavos(m.precio), 0) +
  accesorios.value.reduce((s, a) => s + aCentavos(a.precio) * (Number(venta.accesorios[a.id]) || 0), 0),
));
const items = computed(() => [
  ...venta.motos.map((id) => ({ motocicletaId: id })),
  ...Object.entries(venta.accesorios).filter(([, c]) => Number(c) > 0).map(([id, c]) => ({ accesorioId: Number(id), cantidad: Number(c) })),
]);

async function cargar() {
  [caja.value, motos.value, accesorios.value] = await Promise.all([
    panel.cajaActual(),
    panel.motocicletas({ estado: 'DISPONIBLE', porPagina: 100 }).then((r) => r.motocicletas),
    panel.accesorios().then((r) => r.accesorios),
  ]);
}

async function buscarCliente() {
  const texto = busqueda.value.trim();
  if (!texto) return;
  const porNit = /\d/.test(texto);
  const r = await ejecutar(() => panel.buscarClientes(porNit ? { nit: texto } : { texto }));
  clientesEncontrados.value = r?.clientes ?? [];
}

function elegirCliente(c) {
  venta.clienteId = c.id;
  Object.assign(venta.cliente, { nombre: c.nombre, nit: c.nit ?? '', direccion: c.direccion ?? '', telefono: c.telefono ?? '' });
  clientesEncontrados.value = [];
}

function clienteNuevo() {
  venta.clienteId = null;
  Object.assign(venta.cliente, { nombre: '', nit: '', direccion: '', telefono: '' });
}

async function registrar() {
  const { nombre, nit, direccion, telefono } = venta.cliente;
  const datos = {
    ...(venta.clienteId ? { clienteId: venta.clienteId } : { cliente: { nombre, nit: nit || undefined, direccion: direccion || undefined, telefono: telefono || undefined } }),
    items: items.value,
    cuponCodigo: venta.cuponCodigo || undefined,
    pago: { metodo: venta.metodo, referencia: venta.referencia || undefined },
  };
  const r = await ejecutar(() => panel.vender(datos));
  if (r) {
    resultado.value = r.venta;
    Object.assign(venta, { motos: [], accesorios: {}, cuponCodigo: '', referencia: '' });
    clienteNuevo();
    await cargar();
  }
}

onMounted(() => ejecutar(cargar));
</script>

<template>
  <TituloPanel titulo="Punto de venta" :descripcion="`Vendedor: ${sesion.usuario?.nombre ?? ''}`">
    <RouterLink to="/panel/caja" class="boton-secundario">Ir a caja</RouterLink>
  </TituloPanel>

  <p v-if="caja && !cajaLista" role="alert" class="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
    {{ caja.caja ? `La caja abierta es del ${caja.caja.fechaOperacion}. Ciérrala y abre la de hoy.` : 'La caja del día está cerrada.' }}
    No se pueden registrar ventas en mostrador. <RouterLink to="/panel/caja" class="font-semibold underline">Abrir caja</RouterLink>
  </p>
  <AvisoError :error="error" class="mb-4" />

  <section v-if="resultado" class="tarjeta mb-6 border-emerald-200 p-5">
    <p class="font-bold text-emerald-800">Venta #{{ resultado.id }} registrada · {{ formatearQuetzales(resultado.total) }}</p>
    <p class="text-sm text-zinc-600">{{ resultado.cliente.nombre }} · {{ resultado.metodoPago }}</p>
    <RouterLink v-if="resultado.facturas[0]" :to="{ name: 'panel-factura', params: { id: resultado.facturas[0].id } }" class="boton-secundario mt-3">
      Ver factura {{ resultado.facturas[0].numeroCompleto }}
    </RouterLink>
  </section>

  <form class="grid gap-6 xl:grid-cols-[1fr_24rem]" @submit.prevent="registrar">
    <div class="space-y-6">
      <section class="tarjeta space-y-3 p-5">
        <h2 class="font-bold">Cliente</h2>
        <div class="flex gap-2">
          <label for="pos-buscar" class="sr-only">Buscar cliente</label>
          <input id="pos-buscar" v-model="busqueda" class="campo" placeholder="Buscar por NIT o nombre" @keydown.enter.prevent="buscarCliente" />
          <button type="button" class="boton-secundario" @click="buscarCliente">Buscar</button>
        </div>
        <ul v-if="clientesEncontrados.length" class="divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm">
          <li v-for="c in clientesEncontrados" :key="c.id"><button type="button" class="w-full px-3 py-2 text-left hover:bg-zinc-50" @click="elegirCliente(c)">{{ c.nombre }} · NIT {{ c.nit ?? 'CF' }}</button></li>
        </ul>
        <p v-if="venta.clienteId" class="text-sm">Cliente registrado #{{ venta.clienteId }} · <button type="button" class="text-acento-700 underline" @click="clienteNuevo">usar otro</button></p>
        <div class="grid gap-3 sm:grid-cols-2">
          <div><label class="etiqueta" for="pos-nombre">Nombre</label><input id="pos-nombre" v-model="venta.cliente.nombre" class="campo" required maxlength="150" :disabled="!!venta.clienteId" /></div>
          <div><label class="etiqueta" for="pos-nit">NIT (vacío = CF)</label><input id="pos-nit" v-model="venta.cliente.nit" class="campo" maxlength="20" :disabled="!!venta.clienteId" /></div>
          <div><label class="etiqueta" for="pos-dir">Dirección</label><input id="pos-dir" v-model="venta.cliente.direccion" class="campo" maxlength="250" :disabled="!!venta.clienteId" /></div>
          <div><label class="etiqueta" for="pos-tel">Teléfono</label><input id="pos-tel" v-model="venta.cliente.telefono" class="campo" maxlength="20" :disabled="!!venta.clienteId" /></div>
        </div>
      </section>

      <section class="tarjeta p-5">
        <h2 class="mb-3 font-bold">Motocicletas disponibles</h2>
        <ul class="max-h-80 divide-y divide-zinc-100 overflow-y-auto text-sm">
          <li v-for="m in motos" :key="m.id">
            <label class="flex cursor-pointer items-center gap-3 py-2">
              <input v-model="venta.motos" type="checkbox" :value="m.id" class="accent-acento-600" />
              <span class="flex-1">{{ m.modelo.marca.nombre }} {{ m.modelo.nombre }} {{ m.anio }} · {{ m.color }} <span class="font-mono text-xs text-zinc-500">{{ m.vin }}</span></span>
              <span class="font-semibold">{{ formatearQuetzales(m.precio) }}</span>
            </label>
          </li>
        </ul>
        <p v-if="!motos.length" class="text-sm text-zinc-500">No hay unidades disponibles.</p>
      </section>

      <section class="tarjeta p-5">
        <h2 class="mb-3 font-bold">Accesorios</h2>
        <ul class="divide-y divide-zinc-100 text-sm">
          <li v-for="a in accesorios" :key="a.id" class="flex items-center gap-3 py-2">
            <span class="flex-1">{{ a.nombre }} <span class="text-zinc-500">· stock {{ a.stock }}</span></span>
            <span>{{ formatearQuetzales(a.precio) }}</span>
            <input v-model="venta.accesorios[a.id]" class="campo w-20" type="number" min="0" :max="a.stock" :disabled="!a.stock" :aria-label="`Cantidad de ${a.nombre}`" />
          </li>
        </ul>
      </section>
    </div>

    <aside class="tarjeta h-fit space-y-4 p-5 xl:sticky xl:top-6">
      <h2 class="font-bold">Cobro</h2>
      <p class="flex justify-between text-sm"><span>Subtotal (sin cupón)</span><span class="font-semibold">{{ formatearQuetzales(subtotal) }}</span></p>
      <div><label class="etiqueta" for="pos-cupon">Cupón</label><input id="pos-cupon" v-model="venta.cuponCodigo" class="campo uppercase" maxlength="40" /></div>
      <fieldset>
        <legend class="etiqueta">Método de pago</legend>
        <div class="grid grid-cols-3 gap-2">
          <label v-for="(t, m) in { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' }" :key="m"
                 class="cursor-pointer rounded-lg border p-2 text-center text-sm has-[:checked]:border-acento-500 has-[:checked]:bg-acento-50">
            <input v-model="venta.metodo" type="radio" :value="m" class="sr-only" />{{ t }}
          </label>
        </div>
      </fieldset>
      <div v-if="venta.metodo !== 'EFECTIVO'">
        <label class="etiqueta" for="pos-ref">{{ venta.metodo === 'TARJETA' ? 'Número de voucher' : 'Referencia de la transferencia' }}</label>
        <input id="pos-ref" v-model="venta.referencia" class="campo" required maxlength="100" />
      </div>
      <p class="text-xs text-zinc-500">El total final (cupón e IVA incluido) lo calcula el servidor y queda en la factura.</p>
      <button type="submit" class="boton-principal w-full" :disabled="cargando || !cajaLista || !items.length">Registrar venta</button>
    </aside>
  </form>
</template>
