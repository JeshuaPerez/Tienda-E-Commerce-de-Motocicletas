<script setup>
// Ventas web y de mostrador, con su estado de pago y facturación.
import { computed, onMounted, reactive, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import { etiquetaEstadoVenta, formatearFecha, formatearQuetzales, METODOS_PAGO } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const filtros = reactive({ estado: '', canal: '', pagina: 1 });
const lista = ref({ ventas: [], total: 0 });
const { error, ejecutar } = usarAccion();
const paginas = computed(() => Math.max(1, Math.ceil(lista.value.total / 20)));
const cargar = () => ejecutar(async () => { lista.value = await panel.ventas({ ...filtros }); });
const filtrar = () => { filtros.pagina = 1; cargar(); };
onMounted(cargar);
</script>

<template>
  <TituloPanel titulo="Ventas y pedidos" descripcion="Pedidos web y ventas de mostrador. Abre una venta para cobrarla, despacharla o cancelarla." />
  <AvisoError :error="error" class="mb-4" />
  <div class="mb-4 flex flex-wrap gap-2">
    <select v-model="filtros.estado" class="campo w-auto" aria-label="Estado" @change="filtrar">
      <option value="">Todos los estados</option>
      <option v-for="e in ['PENDIENTE_PAGO', 'PENDIENTE_VALIDACION', 'PAGADA', 'ENTREGADA', 'RECHAZADA', 'CANCELADA']" :key="e" :value="e">{{ etiquetaEstadoVenta(e).texto }}</option>
    </select>
    <select v-model="filtros.canal" class="campo w-auto" aria-label="Canal" @change="filtrar">
      <option value="">Web y mostrador</option><option value="WEB">Tienda web</option><option value="POS">Mostrador (POS)</option>
    </select>
  </div>
  <div class="tarjeta overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="border-b border-zinc-200 text-left text-zinc-500"><tr><th class="px-4 py-2">Venta</th><th>Fecha</th><th>Canal</th><th>Cliente</th><th>Pago</th><th class="text-right">Total</th><th class="px-4">Estado</th><th>Factura</th></tr></thead>
      <tbody class="divide-y divide-zinc-100">
        <tr v-for="v in lista.ventas" :key="v.id">
          <td class="px-4 py-2 font-semibold"><RouterLink :to="{ name: 'panel-venta', params: { id: v.id } }" class="hover:text-acento-700">#{{ v.id }}</RouterLink></td>
          <td class="whitespace-nowrap">{{ formatearFecha(v.creadaEn) }}</td><td>{{ v.canal }}</td><td>{{ v.cliente?.nombre }}</td>
          <td>{{ METODOS_PAGO[v.metodoPago] }}</td><td class="text-right">{{ formatearQuetzales(v.total) }}</td>
          <td class="px-4"><EtiquetaEstado v-bind="etiquetaEstadoVenta(v.estado)" /></td>
          <td>{{ v.facturas.find((f) => f.estado === 'EMITIDA')?.numeroCompleto ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="!lista.ventas.length" class="p-6 text-center text-sm text-zinc-500">Sin ventas.</p>
  </div>
  <nav v-if="paginas > 1" class="mt-4 flex items-center justify-center gap-3" aria-label="Páginas">
    <button type="button" class="boton-secundario" :disabled="filtros.pagina <= 1" @click="filtros.pagina--; cargar()">Anterior</button>
    <span class="text-sm">Página {{ filtros.pagina }} de {{ paginas }}</span>
    <button type="button" class="boton-secundario" :disabled="filtros.pagina >= paginas" @click="filtros.pagina++; cargar()">Siguiente</button>
  </nav>
</template>
