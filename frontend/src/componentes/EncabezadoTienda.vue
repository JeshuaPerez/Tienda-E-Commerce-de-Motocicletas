<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { cantidadEnCarrito } from '../estado/carrito.js';
import { cerrarSesion, esAdministrador, esCliente, haySesion, sesion } from '../estado/sesion.js';

const router = useRouter();
const menuAbierto = ref(false);

function salir() {
  cerrarSesion();
  menuAbierto.value = false;
  router.push({ name: 'catalogo' });
}
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
      <RouterLink to="/" class="flex items-center gap-2" @click="menuAbierto = false">
        <span class="grid h-9 w-9 place-items-center rounded-lg bg-acento-600 text-sm font-black text-white">GT</span>
        <span class="text-lg font-extrabold tracking-tight">MotoStore <span class="text-acento-600">GT</span></span>
      </RouterLink>

      <nav class="flex items-center gap-1 sm:gap-2" aria-label="Principal">
        <RouterLink to="/" class="boton-texto hidden sm:inline-flex">Catálogo</RouterLink>
        <RouterLink v-if="esCliente" to="/mis-compras" class="boton-texto hidden sm:inline-flex">Mis compras</RouterLink>
        <RouterLink v-if="esAdministrador" to="/panel" class="boton-texto hidden sm:inline-flex">Panel</RouterLink>

        <RouterLink to="/carrito" class="boton-secundario relative" aria-label="Carrito de compras">
          <svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" />
          </svg>
          <span class="hidden sm:inline">Carrito</span>
          <span v-if="cantidadEnCarrito" class="absolute -top-2 -right-2 grid h-5 min-w-5 place-items-center rounded-full bg-acento-600 px-1 text-xs font-bold text-white">
            {{ cantidadEnCarrito }}
          </span>
        </RouterLink>

        <template v-if="haySesion">
          <span class="hidden max-w-36 truncate text-sm text-zinc-600 md:inline">Hola, {{ sesion.usuario?.nombre }}</span>
          <button type="button" class="boton-texto hidden sm:inline-flex" @click="salir">Salir</button>
        </template>
        <RouterLink v-else to="/ingresar" class="boton-principal hidden sm:inline-flex">Ingresar</RouterLink>

        <button type="button" class="boton-texto sm:hidden" :aria-expanded="menuAbierto" aria-label="Menú" @click="menuAbierto = !menuAbierto">
          <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </nav>
    </div>

    <nav v-if="menuAbierto" class="border-t border-zinc-200 px-4 py-2 sm:hidden" aria-label="Menú móvil">
      <RouterLink to="/" class="block py-2" @click="menuAbierto = false">Catálogo</RouterLink>
      <RouterLink v-if="esCliente" to="/mis-compras" class="block py-2" @click="menuAbierto = false">Mis compras</RouterLink>
      <RouterLink v-if="esAdministrador" to="/panel" class="block py-2" @click="menuAbierto = false">Panel</RouterLink>
      <button v-if="haySesion" type="button" class="block py-2 text-left" @click="salir">Salir</button>
      <RouterLink v-else to="/ingresar" class="block py-2 font-semibold text-acento-700" @click="menuAbierto = false">Ingresar</RouterLink>
    </nav>
  </header>
</template>
