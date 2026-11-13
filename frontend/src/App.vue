<script setup>
import EncabezadoTienda from './componentes/EncabezadoTienda.vue';
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <EncabezadoTienda class="no-imprimir" />
    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <RouterView />
    </main>
    <footer class="no-imprimir border-t border-zinc-200 bg-white">
      <div class="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-zinc-500 sm:flex-row sm:justify-between sm:px-6">
        <p>MotoStore GT · Motocicletas nuevas en Guatemala · Precios en quetzales (GTQ), IVA incluido.</p>
        <p>Desarrollado por JeshuaPerez</p>
      </div>
    </footer>
  </div>
</template>
