<script setup>
defineProps({ texto: { type: String, default: '' } });
</script>

<template>
  <p v-if="texto" role="status" class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{{ texto }}</p>
</template>
