<script setup>
// Totales que calcula el servidor: subtotal, descuento del cupón, total e IVA incluido (PA-6).
import { formatearQuetzales } from '../logica/formato.js';

defineProps({ totales: { type: Object, required: true } });
</script>

<template>
  <dl class="space-y-2 text-sm">
    <div class="flex justify-between"><dt class="text-zinc-600">Subtotal</dt><dd>{{ formatearQuetzales(totales.subtotal) }}</dd></div>
    <div v-if="totales.descuento && totales.descuento !== '0.00'" class="flex justify-between text-emerald-700">
      <dt>Descuento{{ totales.cupon ? ` (${totales.cupon.codigo})` : '' }}</dt><dd>-{{ formatearQuetzales(totales.descuento) }}</dd>
    </div>
    <div class="flex justify-between border-t border-zinc-200 pt-2 text-lg font-extrabold"><dt>Total</dt><dd>{{ formatearQuetzales(totales.total) }}</dd></div>
    <div class="flex justify-between text-xs text-zinc-500">
      <dt>Incluye IVA (12 %)</dt><dd>{{ formatearQuetzales(totales.iva) }}</dd>
    </div>
  </dl>
</template>
