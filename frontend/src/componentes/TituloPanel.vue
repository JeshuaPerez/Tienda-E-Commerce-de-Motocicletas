<script setup>
defineProps({ titulo: { type: String, required: true }, descripcion: { type: String, default: '' } });
</script>

<template>
  <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">{{ titulo }}</h1>
      <p v-if="descripcion" class="mt-1 text-sm text-zinc-600">{{ descripcion }}</p>
    </div>
    <div class="flex flex-wrap gap-2"><slot /></div>
  </div>
</template>
