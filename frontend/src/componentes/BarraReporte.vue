<script setup>
// Fila de un reporte con una barra horizontal proporcional al valor (sin librerías de gráficas).
import { computed } from 'vue';
import { anchoBarra } from '../logica/panel.js';

const props = defineProps({ etiqueta: { type: String, required: true }, valor: { type: String, required: true }, maximo: { type: String, required: true }, texto: { type: String, required: true } });
const ancho = computed(() => anchoBarra(props.valor, props.maximo));
</script>

<template>
  <div class="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_9rem]">
    <span class="truncate text-zinc-700" :title="etiqueta">{{ etiqueta }}</span>
    <span class="h-3 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
      <span class="block h-full rounded-full bg-acento-600" :style="{ width: `${ancho}%` }"></span>
    </span>
    <span class="text-right font-semibold">{{ texto }}</span>
  </div>
</template>
