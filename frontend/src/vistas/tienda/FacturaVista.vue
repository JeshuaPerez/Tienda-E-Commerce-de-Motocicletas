<script setup>
// RF 08: factura interna lista para imprimir (emisor, receptor con NIT o CF, líneas, base, IVA y total).
import { onMounted, ref } from 'vue';
import { tienda } from '../../api/tienda.js';
import { etiquetaEstadoFactura, formatearFecha, formatearQuetzales } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';

const props = defineProps({ id: { type: String, required: true } });
const factura = ref(null);
const error = ref(null);
const imprimir = () => window.print();

onMounted(async () => {
  try {
    factura.value = (await tienda.obtenerFactura(props.id)).factura;
  } catch (e) {
    error.value = e;
  }
});
</script>

<template>
  <div class="no-imprimir mb-4 flex items-center justify-between">
    <button type="button" class="boton-texto -ml-2" @click="$router.back()">← Volver</button>
    <button v-if="factura" type="button" class="boton-secundario" @click="imprimir">Imprimir</button>
  </div>
  <AvisoError :error="error" />

  <article v-if="factura" class="tarjeta mx-auto max-w-3xl space-y-6 p-6 sm:p-10 print:border-0 print:shadow-none">
    <header class="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6">
      <div>
        <p class="text-2xl font-extrabold">{{ factura.emisor.nombre }}</p>
        <p v-if="factura.emisor.nit" class="text-sm text-zinc-600">NIT {{ factura.emisor.nit }}</p>
        <p v-if="factura.emisor.direccion" class="text-sm text-zinc-600">{{ factura.emisor.direccion }}</p>
      </div>
      <div class="text-right">
        <p class="text-xs tracking-widest text-zinc-500 uppercase">Factura</p>
        <p class="text-xl font-extrabold">{{ factura.numeroCompleto }}</p>
        <p class="text-sm text-zinc-600">{{ formatearFecha(factura.emitidaEn) }}</p>
        <EtiquetaEstado class="mt-1" v-bind="etiquetaEstadoFactura(factura.estado)" />
      </div>
    </header>

    <section class="grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
      <p class="text-zinc-500">NIT</p><p class="font-semibold">{{ factura.receptor.nit }}</p>
      <p class="text-zinc-500">Nombre</p><p>{{ factura.receptor.nombre }}</p>
      <p class="text-zinc-500">Dirección</p><p>{{ factura.receptor.direccion }}</p>
    </section>

    <table class="w-full text-sm">
      <thead class="border-b border-zinc-200 text-left text-zinc-500">
        <tr><th class="py-2 font-medium">Cant.</th><th class="py-2 font-medium">Descripción</th><th class="py-2 text-right font-medium">P. unitario</th><th class="py-2 text-right font-medium">Subtotal</th></tr>
      </thead>
      <tbody class="divide-y divide-zinc-100">
        <tr v-for="(l, i) in factura.lineas" :key="i">
          <td class="py-2">{{ l.cantidad }}</td><td class="py-2">{{ l.descripcion }}</td>
          <td class="py-2 text-right">{{ formatearQuetzales(l.precioUnitario) }}</td><td class="py-2 text-right">{{ formatearQuetzales(l.subtotal) }}</td>
        </tr>
      </tbody>
    </table>

    <dl class="ml-auto max-w-xs space-y-1 text-sm">
      <div class="flex justify-between"><dt class="text-zinc-500">Subtotal</dt><dd>{{ formatearQuetzales(factura.subtotal) }}</dd></div>
      <div v-if="factura.descuento !== '0.00'" class="flex justify-between"><dt class="text-zinc-500">Descuento</dt><dd>-{{ formatearQuetzales(factura.descuento) }}</dd></div>
      <div class="flex justify-between"><dt class="text-zinc-500">Base imponible</dt><dd>{{ formatearQuetzales(factura.baseImponible) }}</dd></div>
      <div class="flex justify-between"><dt class="text-zinc-500">IVA (12 %)</dt><dd>{{ formatearQuetzales(factura.iva) }}</dd></div>
      <div class="flex justify-between border-t border-zinc-200 pt-1 text-base font-extrabold"><dt>Total</dt><dd>{{ formatearQuetzales(factura.total) }}</dd></div>
    </dl>

    <p v-if="factura.estado === 'ANULADA'" class="rounded-lg bg-red-50 p-3 text-sm text-red-800">
      Factura anulada el {{ formatearFecha(factura.anuladaEn) }}. Motivo: {{ factura.motivoAnulacion }}
    </p>
    <p class="border-t border-zinc-200 pt-4 text-xs text-zinc-500">{{ factura.leyenda }}</p>
  </article>
</template>
