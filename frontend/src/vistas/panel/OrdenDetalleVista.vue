<script setup>
// RF 07: detalle de una orden, envío, cancelación y recepción de mercancía. Cada moto recibida se
// registra con su VIN (RN 1) y queda Disponible; si un VIN falla, no se recibe nada (todo o nada).
import { computed, onMounted, reactive, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import { formatearFecha, formatearQuetzales } from '../../logica/formato.js';
import { leerVins } from '../../logica/panel.js';
import AvisoError from '../../componentes/AvisoError.vue';
import AvisoExito from '../../componentes/AvisoExito.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const props = defineProps({ id: { type: String, required: true } });
const orden = ref(null);
const recepcion = reactive({}); // por línea: { vins, anio, color, precio } o { cantidad }
const { cargando, error, mensaje, ejecutar } = usarAccion();
const recibible = computed(() => ['ENVIADA', 'RECIBIDA_PARCIAL'].includes(orden.value?.estado));

function prepararRecepcion() {
  for (const d of orden.value.detalles) {
    recepcion[d.id] = d.modelo ? { vins: '', anio: new Date().getFullYear(), color: '', precio: '' } : { cantidad: '' };
  }
}

async function cargar() {
  orden.value = (await panel.orden(props.id)).orden;
  prepararRecepcion();
}

const lectura = (d) => leerVins(recepcion[d.id]?.vins);

async function cambiar(estado) {
  const r = await ejecutar(() => panel.cambiarEstadoOrden(orden.value.id, estado), `Orden ${estado.toLowerCase()}.`);
  if (r) { orden.value = r.orden; prepararRecepcion(); }
}

async function recibir() {
  const lineas = [];
  for (const d of orden.value.detalles.filter((x) => x.pendiente > 0)) {
    const r = recepcion[d.id];
    if (d.modelo) {
      const { vins } = lectura(d);
      if (vins.length) lineas.push({ detalleId: d.id, motocicletas: vins.map((vin) => ({ vin, anio: Number(r.anio), color: r.color, precio: r.precio })) });
    } else if (Number(r.cantidad) > 0) {
      lineas.push({ detalleId: d.id, cantidad: Number(r.cantidad) });
    }
  }
  const res = await ejecutar(() => panel.recibir(orden.value.id, { lineas }),
    'Mercancía recibida. Las motos quedaron Disponibles con su costo de adquisición.');
  if (res) { orden.value = res.orden; prepararRecepcion(); }
}

onMounted(() => ejecutar(cargar));
</script>

<template>
  <RouterLink to="/panel/compras" class="boton-texto mb-4 -ml-2">← Compras</RouterLink>
  <template v-if="orden">
    <TituloPanel :titulo="`Orden OC-${orden.id}`" :descripcion="`${orden.proveedor.nombre} · ${formatearFecha(orden.creadaEn)}`">
      <EtiquetaEstado :texto="orden.estado" :tono="{ BORRADOR: 'gris', ENVIADA: 'azul', RECIBIDA_PARCIAL: 'ambar', RECIBIDA: 'verde', CANCELADA: 'rojo' }[orden.estado]" />
      <button v-if="orden.estado === 'BORRADOR'" type="button" class="boton-principal" :disabled="cargando" @click="cambiar('ENVIADA')">Marcar como enviada</button>
      <button v-if="['BORRADOR', 'ENVIADA'].includes(orden.estado)" type="button" class="boton-secundario" :disabled="cargando" @click="cambiar('CANCELADA')">Cancelar orden</button>
    </TituloPanel>
    <AvisoError :error="error" class="mb-4" />
    <AvisoExito :texto="mensaje" class="mb-4" />

    <form class="space-y-4" @submit.prevent="recibir">
      <article v-for="d in orden.detalles" :key="d.id" class="tarjeta p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-bold">{{ d.modelo ? `${d.modelo.marca.nombre} ${d.modelo.nombre}` : `${d.accesorio.nombre} (${d.accesorio.sku})` }}</h2>
          <p class="text-sm text-zinc-600">
            {{ d.cantidadRecibida }} de {{ d.cantidad }} recibidas · {{ formatearQuetzales(d.costoUnitario) }} c/u · subtotal {{ formatearQuetzales(d.subtotal) }}
          </p>
        </div>

        <div v-if="recibible && d.pendiente > 0" class="mt-4 border-t border-zinc-100 pt-4">
          <template v-if="d.modelo">
            <label class="etiqueta" :for="`vins-${d.id}`">VIN de las unidades recibidas (uno por línea, quedan {{ d.pendiente }})</label>
            <textarea :id="`vins-${d.id}`" v-model="recepcion[d.id].vins" class="campo font-mono uppercase" rows="3"></textarea>
            <p v-if="lectura(d).vins.length" class="mt-1 text-xs text-zinc-600">{{ lectura(d).vins.length }} VIN válido(s)</p>
            <p v-if="lectura(d).invalidos.length" class="mt-1 text-xs text-red-700">Inválidos: {{ lectura(d).invalidos.join(', ') }}</p>
            <p v-if="lectura(d).repetidos.length" class="mt-1 text-xs text-red-700">Repetidos: {{ lectura(d).repetidos.join(', ') }}</p>
            <p v-if="lectura(d).vins.length > d.pendiente" class="mt-1 text-xs text-red-700">Hay más VIN que unidades pendientes.</p>
            <div class="mt-3 grid gap-3 sm:grid-cols-3">
              <div><label class="etiqueta" :for="`anio-${d.id}`">Año</label><input :id="`anio-${d.id}`" v-model="recepcion[d.id].anio" class="campo" type="number" min="1900" /></div>
              <div><label class="etiqueta" :for="`color-${d.id}`">Color</label><input :id="`color-${d.id}`" v-model="recepcion[d.id].color" class="campo" maxlength="40" /></div>
              <div><label class="etiqueta" :for="`precio-${d.id}`">Precio de venta (Q)</label><input :id="`precio-${d.id}`" v-model="recepcion[d.id].precio" class="campo" inputmode="decimal" /></div>
            </div>
          </template>
          <div v-else class="max-w-48">
            <label class="etiqueta" :for="`cant-${d.id}`">Cantidad recibida (quedan {{ d.pendiente }})</label>
            <input :id="`cant-${d.id}`" v-model="recepcion[d.id].cantidad" class="campo" type="number" min="0" :max="d.pendiente" />
          </div>
        </div>
      </article>

      <div class="tarjeta flex flex-wrap items-center justify-between gap-3 p-5">
        <p class="text-lg font-extrabold">Total {{ formatearQuetzales(orden.total) }}</p>
        <button v-if="recibible" type="submit" class="boton-principal" :disabled="cargando">Registrar recepción</button>
        <p v-else-if="orden.estado === 'BORRADOR'" class="text-sm text-zinc-600">Márcala como enviada para poder recibir mercancía.</p>
      </div>
    </form>
  </template>
  <AvisoError v-else :error="error" />
</template>
