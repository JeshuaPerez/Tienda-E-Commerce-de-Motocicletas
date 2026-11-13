<script setup>
// RF 07: órdenes de compra a proveedores (en GTQ, PA-11) con líneas de modelos de moto o accesorios.
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import { formatearFecha, formatearQuetzales } from '../../logica/formato.js';
import { totalOrden } from '../../logica/panel.js';
import AvisoError from '../../componentes/AvisoError.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const router = useRouter();
const TONOS = { BORRADOR: 'gris', ENVIADA: 'azul', RECIBIDA_PARCIAL: 'ambar', RECIBIDA: 'verde', CANCELADA: 'rojo' };
const ordenes = ref([]);
const estado = ref('');
const proveedores = ref([]);
const modelos = ref([]);
const accesorios = ref([]);
const nueva = ref(null);
const { cargando, error, ejecutar } = usarAccion();
const total = computed(() => (nueva.value ? totalOrden(nueva.value.detalles) : '0.00'));

const linea = () => ({ articulo: '', cantidad: 1, costoUnitario: '' });
const cargar = async () => { ordenes.value = (await panel.ordenes(estado.value)).ordenes; };

async function abrirNueva() {
  await ejecutar(async () => {
    [proveedores.value, modelos.value, accesorios.value] = await Promise.all([
      panel.proveedores().then((r) => r.proveedores.filter((p) => p.activo)),
      panel.modelos().then((r) => r.modelos),
      panel.accesorios().then((r) => r.accesorios),
    ]);
    nueva.value = reactive({ proveedorId: '', notas: '', detalles: [linea()] });
  });
}

async function crear() {
  const n = nueva.value;
  const detalles = n.detalles.map((d) => {
    const [tipo, id] = d.articulo.split(':');
    return { [tipo === 'm' ? 'modeloId' : 'accesorioId']: Number(id), cantidad: Number(d.cantidad), costoUnitario: d.costoUnitario };
  });
  const r = await ejecutar(() => panel.crearOrden({ proveedorId: Number(n.proveedorId), notas: n.notas || undefined, detalles }));
  if (r) router.push({ name: 'panel-orden', params: { id: r.orden.id } });
}

onMounted(() => ejecutar(cargar));
</script>

<template>
  <TituloPanel titulo="Compras" descripcion="Órdenes de compra a proveedores. Al recibir la mercancía se registran las motos con su VIN y se suma el stock de accesorios.">
    <button type="button" class="boton-principal" @click="abrirNueva">Nueva orden</button>
  </TituloPanel>
  <AvisoError :error="error" class="mb-4" />

  <form v-if="nueva" class="tarjeta mb-6 space-y-4 p-5" @submit.prevent="crear">
    <h2 class="font-bold">Nueva orden de compra (GTQ)</h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label class="etiqueta" for="o-prov">Proveedor</label>
        <select id="o-prov" v-model="nueva.proveedorId" class="campo" required>
          <option value="" disabled>Elige…</option>
          <option v-for="p in proveedores" :key="p.id" :value="p.id">{{ p.nombre }} ({{ p.tipo === 'LOCAL' ? 'local' : p.pais }})</option>
        </select>
        <RouterLink v-if="!proveedores.length" to="/panel/proveedores" class="mt-1 block text-sm text-acento-700">Primero registra un proveedor</RouterLink>
      </div>
      <div><label class="etiqueta" for="o-notas">Notas</label><input id="o-notas" v-model="nueva.notas" class="campo" maxlength="1000" /></div>
    </div>

    <fieldset class="space-y-2">
      <legend class="etiqueta">Líneas</legend>
      <div v-for="(d, i) in nueva.detalles" :key="i" class="grid gap-2 sm:grid-cols-[1fr_7rem_9rem_auto]">
        <select v-model="d.articulo" class="campo" required :aria-label="`Artículo de la línea ${i + 1}`">
          <option value="" disabled>Artículo…</option>
          <optgroup label="Modelos de motocicleta"><option v-for="m in modelos" :key="m.id" :value="`m:${m.id}`">{{ m.marca.nombre }} {{ m.nombre }}</option></optgroup>
          <optgroup label="Accesorios"><option v-for="a in accesorios" :key="a.id" :value="`a:${a.id}`">{{ a.nombre }} ({{ a.sku }})</option></optgroup>
        </select>
        <input v-model="d.cantidad" class="campo" type="number" min="1" required :aria-label="`Cantidad de la línea ${i + 1}`" />
        <input v-model="d.costoUnitario" class="campo" inputmode="decimal" required placeholder="Costo Q" :aria-label="`Costo unitario de la línea ${i + 1}`" />
        <button type="button" class="boton-texto" :disabled="nueva.detalles.length === 1" @click="nueva.detalles.splice(i, 1)">Quitar</button>
      </div>
      <button type="button" class="boton-secundario" @click="nueva.detalles.push(linea())">Agregar línea</button>
    </fieldset>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
      <p class="text-lg font-extrabold">Total estimado {{ formatearQuetzales(total) }}</p>
      <div class="flex gap-2">
        <button type="submit" class="boton-principal" :disabled="cargando">Crear orden (borrador)</button>
        <button type="button" class="boton-secundario" @click="nueva = null">Cancelar</button>
      </div>
    </div>
  </form>

  <div class="mb-4">
    <select v-model="estado" class="campo w-auto" aria-label="Estado de la orden" @change="ejecutar(cargar)">
      <option value="">Todas</option><option v-for="e in Object.keys(TONOS)" :key="e" :value="e">{{ e }}</option>
    </select>
  </div>
  <div class="tarjeta overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="border-b border-zinc-200 text-left text-zinc-500"><tr><th class="px-4 py-2">Orden</th><th>Proveedor</th><th>Fecha</th><th class="text-right">Total</th><th class="px-4">Estado</th></tr></thead>
      <tbody class="divide-y divide-zinc-100">
        <tr v-for="o in ordenes" :key="o.id" class="cursor-pointer hover:bg-zinc-50" @click="router.push({ name: 'panel-orden', params: { id: o.id } })">
          <td class="px-4 py-2 font-semibold"><RouterLink :to="{ name: 'panel-orden', params: { id: o.id } }">OC-{{ o.id }}</RouterLink></td>
          <td>{{ o.proveedor.nombre }}</td><td>{{ formatearFecha(o.creadaEn) }}</td>
          <td class="text-right">{{ formatearQuetzales(o.total) }}</td>
          <td class="px-4"><EtiquetaEstado :texto="o.estado" :tono="TONOS[o.estado]" /></td>
        </tr>
      </tbody>
    </table>
    <p v-if="!ordenes.length" class="p-6 text-center text-sm text-zinc-500">Sin órdenes.</p>
  </div>
</template>
