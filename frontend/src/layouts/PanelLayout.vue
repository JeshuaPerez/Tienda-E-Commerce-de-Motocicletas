<script setup>
// Panel de administración (5.2): menú lateral con cada módulo; en móvil se abre como cajón.
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { cerrarSesion, sesion } from '../estado/sesion.js';

const route = useRoute();
const router = useRouter();
const abierto = ref(false);
watch(() => route.fullPath, () => { abierto.value = false; });

const secciones = [
  { titulo: 'General', enlaces: [{ a: '/panel', texto: 'Tablero' }] },
  { titulo: 'Ventas', enlaces: [
    { a: '/panel/pos', texto: 'Punto de venta' },
    { a: '/panel/caja', texto: 'Caja' },
    { a: '/panel/ventas', texto: 'Ventas y pedidos' },
    { a: '/panel/transferencias', texto: 'Transferencias' },
    { a: '/panel/cupones', texto: 'Cupones' },
    { a: '/panel/facturas', texto: 'Facturación' },
  ] },
  { titulo: 'Inventario', enlaces: [
    { a: '/panel/inventario', texto: 'Inventario' },
    { a: '/panel/motocicletas', texto: 'Motocicletas' },
    { a: '/panel/catalogo', texto: 'Marcas, modelos y accesorios' },
    { a: '/panel/compras', texto: 'Compras' },
    { a: '/panel/proveedores', texto: 'Proveedores' },
  ] },
  { titulo: 'Análisis', enlaces: [{ a: '/panel/reportes', texto: 'Reportes' }] },
  { titulo: 'Cuentas', enlaces: [{ a: '/panel/usuarios', texto: 'Administradores' }] },
];

function salir() {
  cerrarSesion();
  router.push('/ingresar');
}
</script>

<template>
  <div class="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
    <header class="no-imprimir flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 lg:hidden">
      <RouterLink to="/panel" class="font-extrabold">MotoStore <span class="text-acento-600">GT</span> · Panel</RouterLink>
      <button type="button" class="boton-texto" :aria-expanded="abierto" aria-label="Menú del panel" @click="abierto = !abierto">
        <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
    </header>

    <aside class="no-imprimir fixed inset-y-0 left-0 z-30 w-64 -translate-x-full overflow-y-auto bg-zinc-900 text-zinc-300 transition lg:static lg:w-auto lg:translate-x-0"
           :class="{ 'translate-x-0': abierto }">
      <div class="flex items-center gap-2 px-5 py-5">
        <span class="grid h-9 w-9 place-items-center rounded-lg bg-acento-600 text-sm font-black text-white">GT</span>
        <div>
          <p class="font-extrabold text-white">MotoStore GT</p>
          <p class="text-xs text-zinc-400">Panel de administración</p>
        </div>
      </div>
      <nav class="space-y-5 px-3 pb-6" aria-label="Módulos del panel">
        <div v-for="s in secciones" :key="s.titulo">
          <p class="px-2 pb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase">{{ s.titulo }}</p>
          <RouterLink v-for="e in s.enlaces" :key="e.a" :to="e.a"
                      class="block rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-800 hover:text-white"
                      :class="(e.a === '/panel' ? route.path === '/panel' : route.path.startsWith(e.a)) ? 'bg-zinc-800 text-white' : ''">
            {{ e.texto }}
          </RouterLink>
        </div>
      </nav>
      <div class="border-t border-zinc-800 px-5 py-4 text-sm">
        <p class="truncate text-zinc-400">{{ sesion.usuario?.nombre }}</p>
        <div class="mt-2 flex gap-3">
          <RouterLink to="/" class="hover:text-white">Ver tienda</RouterLink>
          <button type="button" class="hover:text-white" @click="salir">Salir</button>
        </div>
      </div>
    </aside>
    <div v-if="abierto" class="fixed inset-0 z-20 bg-black/40 lg:hidden" aria-hidden="true" @click="abierto = false"></div>

    <main class="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
      <RouterView />
    </main>
  </div>
</template>
