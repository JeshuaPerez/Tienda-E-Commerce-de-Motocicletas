<script setup>
// 5.1: historial de compras del cliente con su estado de pago y de facturación.
import { computed, onMounted, ref } from 'vue';
import { tienda } from '../../api/tienda.js';
import { etiquetaEstadoVenta, formatearFecha, formatearQuetzales, METODOS_PAGO } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';

const resultado = ref(null);
const error = ref(null);
const pagina = ref(1);
const paginas = computed(() => Math.max(1, Math.ceil((resultado.value?.total ?? 0) / (resultado.value?.porPagina ?? 20))));

async function cargar() {
  try {
    resultado.value = await tienda.misCompras(pagina.value);
  } catch (e) {
    error.value = e;
  }
}

const facturaVigente = (venta) => venta.facturas.find((f) => f.estado === 'EMITIDA');
const cambiarPagina = (n) => { pagina.value = n; cargar(); };
onMounted(cargar);
</script>

<template>
  <h1 class="mb-6 text-3xl font-extrabold tracking-tight">Mis compras</h1>
  <AvisoError :error="error" />

  <div v-if="resultado && !resultado.ventas.length" class="tarjeta p-10 text-center">
    <p class="text-zinc-600">Todavía no tienes compras.</p>
    <RouterLink to="/" class="boton-principal mt-4">Ver motocicletas</RouterLink>
  </div>

  <ul v-if="resultado?.ventas.length" class="space-y-3">
    <li v-for="venta in resultado.ventas" :key="venta.id">
      <RouterLink :to="{ name: 'compra', params: { id: venta.id } }" class="tarjeta flex flex-col gap-3 p-5 transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="font-bold">Pedido #{{ venta.id }}</p>
          <p class="text-sm text-zinc-500">{{ formatearFecha(venta.creadaEn) }} · {{ METODOS_PAGO[venta.metodoPago] }}</p>
          <p class="mt-1 line-clamp-1 text-sm text-zinc-700">{{ venta.detalles.map((d) => d.descripcion).join(' · ') }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <span class="text-lg font-extrabold">{{ formatearQuetzales(venta.total) }}</span>
          <EtiquetaEstado v-bind="etiquetaEstadoVenta(venta.estado)" />
          <span class="text-xs text-zinc-500">
            {{ facturaVigente(venta) ? `Factura ${facturaVigente(venta).numeroCompleto}` : 'Sin factura todavía' }}
          </span>
        </div>
      </RouterLink>
    </li>
  </ul>

  <nav v-if="paginas > 1" class="mt-6 flex items-center justify-center gap-3" aria-label="Páginas">
    <button type="button" class="boton-secundario" :disabled="pagina <= 1" @click="cambiarPagina(pagina - 1)">Anterior</button>
    <span class="text-sm text-zinc-600">Página {{ pagina }} de {{ paginas }}</span>
    <button type="button" class="boton-secundario" :disabled="pagina >= paginas" @click="cambiarPagina(pagina + 1)">Siguiente</button>
  </nav>
</template>
