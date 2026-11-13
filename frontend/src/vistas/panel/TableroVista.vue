<script setup>
// Tablero (5.2): estado de la caja del día, ventas de hoy, transferencias por validar y alertas de stock.
import { onMounted, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { fechaGuatemala } from '../../logica/panel.js';
import { formatearQuetzales } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const caja = ref(null);
const ventasHoy = ref(null);
const pendientes = ref([]);
const alertas = ref({ modelos: [], accesorios: [] });
const error = ref(null);

onMounted(async () => {
  const hoy = fechaGuatemala();
  try {
    [caja.value, ventasHoy.value, pendientes.value, alertas.value] = await Promise.all([
      panel.cajaActual(),
      panel.reporte('ventas', { desde: hoy, hasta: hoy }),
      panel.comprobantes('PENDIENTE').then((r) => r.comprobantes),
      panel.alertas(),
    ]);
  } catch (e) {
    error.value = e;
  }
});
</script>

<template>
  <TituloPanel titulo="Tablero" :descripcion="`Hoy, ${fechaGuatemala()}`">
    <RouterLink to="/panel/pos" class="boton-principal">Nueva venta</RouterLink>
  </TituloPanel>
  <AvisoError :error="error" class="mb-4" />

  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <RouterLink to="/panel/caja" class="tarjeta p-5 hover:shadow-md">
      <p class="text-sm text-zinc-500">Caja del día</p>
      <p class="mt-1 text-2xl font-extrabold">{{ caja?.caja ? (caja.esDelDia ? 'Abierta' : 'Abierta (otro día)') : 'Cerrada' }}</p>
      <p v-if="caja?.caja" class="text-sm text-zinc-600">Efectivo esperado {{ formatearQuetzales(caja.resumen.efectivoEsperado) }}</p>
      <p v-else class="text-sm text-acento-700">Ábrela para vender en mostrador</p>
    </RouterLink>
    <div class="tarjeta p-5">
      <p class="text-sm text-zinc-500">Ventas cobradas hoy</p>
      <p class="mt-1 text-2xl font-extrabold">{{ formatearQuetzales(ventasHoy?.resumen.total ?? '0') }}</p>
      <p class="text-sm text-zinc-600">{{ ventasHoy?.resumen.cantidadVentas ?? 0 }} venta(s)</p>
    </div>
    <RouterLink to="/panel/transferencias" class="tarjeta p-5 hover:shadow-md">
      <p class="text-sm text-zinc-500">Transferencias por validar</p>
      <p class="mt-1 text-2xl font-extrabold" :class="{ 'text-acento-700': pendientes.length }">{{ pendientes.length }}</p>
      <p class="text-sm text-zinc-600">Ninguna unidad se despacha sin validar</p>
    </RouterLink>
    <RouterLink to="/panel/inventario" class="tarjeta p-5 hover:shadow-md">
      <p class="text-sm text-zinc-500">Alertas de stock</p>
      <p class="mt-1 text-2xl font-extrabold" :class="{ 'text-acento-700': alertas.modelos.length + alertas.accesorios.length }">
        {{ alertas.modelos.length + alertas.accesorios.length }}
      </p>
      <p class="text-sm text-zinc-600">Modelos y accesorios en el mínimo</p>
    </RouterLink>
  </div>

  <section v-if="alertas.modelos.length || alertas.accesorios.length" class="tarjeta mt-6 p-5">
    <h2 class="mb-3 font-bold">Stock bajo</h2>
    <ul class="divide-y divide-zinc-100 text-sm">
      <li v-for="m in alertas.modelos" :key="`m${m.id}`" class="flex justify-between py-2">
        <span>{{ m.marca.nombre }} {{ m.nombre }}</span><span>{{ m.disponibles }} disponibles · mínimo {{ m.stockMinimo }}</span>
      </li>
      <li v-for="a in alertas.accesorios" :key="`a${a.id}`" class="flex justify-between py-2">
        <span>{{ a.nombre }} ({{ a.sku }})</span><span>{{ a.stock }} en stock · mínimo {{ a.stockMinimo }}</span>
      </li>
    </ul>
  </section>
</template>
