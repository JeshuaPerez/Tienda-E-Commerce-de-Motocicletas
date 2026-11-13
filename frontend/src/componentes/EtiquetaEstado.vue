<script setup>
const props = defineProps({ texto: { type: String, required: true }, tono: { type: String, default: 'gris' } });
const tonos = {
  verde: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  azul: 'bg-sky-50 text-sky-800 ring-sky-200',
  ambar: 'bg-amber-50 text-amber-800 ring-amber-200',
  rojo: 'bg-red-50 text-red-800 ring-red-200',
  gris: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
};
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1" :class="tonos[props.tono] ?? tonos.gris">
    {{ texto }}
  </span>
</template>
