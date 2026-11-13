<script setup>
// RN 4: el administrador revisa el comprobante subido por el cliente y lo aprueba (la moto queda vendida,
// entra el ingreso a la caja del día y se emite la factura) o lo rechaza con un motivo (se libera la unidad).
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import { formatearFecha, formatearQuetzales } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import AvisoExito from '../../componentes/AvisoExito.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const estado = ref('PENDIENTE');
const comprobantes = ref([]);
const vista = ref(null); // { id, url, tipo }
const motivos = ref({});
const { cargando, error, mensaje, ejecutar } = usarAccion();

const cargar = () => ejecutar(async () => { comprobantes.value = (await panel.comprobantes(estado.value)).comprobantes; });

function cerrarVista() {
  if (vista.value) URL.revokeObjectURL(vista.value.url);
  vista.value = null;
}

async function ver(c) {
  const archivo = await ejecutar(() => panel.archivoComprobante(c.id));
  if (!archivo) return;
  cerrarVista();
  vista.value = { id: c.id, url: URL.createObjectURL(archivo), tipo: c.tipoArchivo };
}

async function aprobar(c) {
  if (await ejecutar(() => panel.aprobar(c.id), `Transferencia de la venta #${c.ventaId} aprobada; la factura quedó emitida.`)) { cerrarVista(); cargar(); }
}

async function rechazar(c) {
  if (await ejecutar(() => panel.rechazar(c.id, motivos.value[c.id] ?? ''), `Comprobante rechazado; la unidad de la venta #${c.ventaId} quedó disponible.`)) { cerrarVista(); cargar(); }
}

onMounted(cargar);
onBeforeUnmount(cerrarVista);
</script>

<template>
  <TituloPanel titulo="Transferencias" descripcion="Aprobar exige la caja del día abierta: el pago entra como ingreso por transferencia.">
    <select v-model="estado" class="campo w-auto" aria-label="Estado" @change="cargar">
      <option value="PENDIENTE">Por validar</option><option value="APROBADO">Aprobadas</option><option value="RECHAZADO">Rechazadas</option>
    </select>
  </TituloPanel>
  <AvisoError :error="error" class="mb-4" />
  <AvisoExito :texto="mensaje" class="mb-4" />

  <div class="grid gap-6 xl:grid-cols-[1fr_28rem]">
    <ul class="space-y-3">
      <li v-for="c in comprobantes" :key="c.id" class="tarjeta space-y-3 p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="font-bold">Venta #{{ c.ventaId }} · {{ formatearQuetzales(c.venta?.total) }}</p>
            <p class="text-sm text-zinc-500">{{ c.venta?.cliente?.nombre }} · subido {{ formatearFecha(c.subidoEn) }} · {{ c.tipoArchivo }}</p>
          </div>
          <EtiquetaEstado :texto="c.estado" :tono="{ PENDIENTE: 'azul', APROBADO: 'verde', RECHAZADO: 'rojo' }[c.estado]" />
        </div>
        <p v-if="c.motivoRechazo" class="text-sm text-red-700">Motivo: {{ c.motivoRechazo }}</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="boton-secundario" @click="ver(c)">Ver comprobante</button>
          <RouterLink :to="{ name: 'panel-venta', params: { id: c.ventaId } }" class="boton-texto">Ver venta</RouterLink>
        </div>
        <div v-if="c.estado === 'PENDIENTE'" class="grid gap-2 border-t border-zinc-100 pt-3 sm:grid-cols-[1fr_auto_auto]">
          <input v-model="motivos[c.id]" class="campo" maxlength="300" placeholder="Motivo (obligatorio para rechazar)" :aria-label="`Motivo de rechazo del comprobante ${c.id}`" />
          <button type="button" class="boton-secundario" :disabled="cargando" @click="rechazar(c)">Rechazar</button>
          <button type="button" class="boton-principal" :disabled="cargando" @click="aprobar(c)">Aprobar</button>
        </div>
      </li>
      <li v-if="!comprobantes.length" class="tarjeta p-8 text-center text-sm text-zinc-500">No hay comprobantes en este estado.</li>
    </ul>

    <aside v-if="vista" class="tarjeta h-fit overflow-hidden xl:sticky xl:top-6">
      <div class="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
        <p class="text-sm font-semibold">Comprobante #{{ vista.id }}</p>
        <button type="button" class="boton-texto" @click="cerrarVista">Cerrar</button>
      </div>
      <img v-if="vista.tipo.startsWith('image/')" :src="vista.url" alt="Comprobante de transferencia" class="max-h-[70vh] w-full object-contain" />
      <iframe v-else :src="vista.url" title="Comprobante de transferencia en PDF" class="h-[70vh] w-full"></iframe>
    </aside>
  </div>
</template>
