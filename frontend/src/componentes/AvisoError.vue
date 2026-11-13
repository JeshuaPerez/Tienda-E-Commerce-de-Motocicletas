<script setup>
// Muestra un ErrorApi: mensaje principal y, si los hay, los detalles de validación del servidor.
defineProps({ error: { type: Object, default: null } });
</script>

<template>
  <div v-if="error" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
    <p class="font-semibold">{{ error.message }}</p>
    <ul v-if="error.detalles?.length" class="mt-1 list-inside list-disc">
      <li v-for="detalle in error.detalles" :key="detalle">{{ detalle }}</li>
    </ul>
  </div>
</template>
