<script setup>
// Detalle de una compra: estado, comprobante de transferencia (RN 4, PA-8), cancelación y facturas (RF 08).
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { tienda } from '../../api/tienda.js';
import { etiquetaEstadoFactura, etiquetaEstadoVenta, formatearFecha, formatearQuetzales, METODOS_PAGO } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';
import ResumenTotales from '../../componentes/ResumenTotales.vue';

const props = defineProps({ id: { type: String, required: true } });
const route = useRoute();
const venta = ref(null);
const error = ref(null);
const archivo = ref(null);
const errorArchivo = ref('');
const subiendo = ref(false);
const MAXIMO = 5 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'application/pdf'];

const esTransferencia = computed(() => venta.value?.metodoPago === 'TRANSFERENCIA');
const puedeSubir = computed(() => esTransferencia.value && venta.value.estado === 'PENDIENTE_PAGO');
const ultimoRechazo = computed(() => [...(venta.value?.comprobantes ?? [])].reverse().find((c) => c.estado === 'RECHAZADO'));

async function cargar() {
  try {
    venta.value = (await tienda.obtenerCompra(props.id)).venta;
  } catch (e) {
    error.value = e;
  }
}

// La validación definitiva (tipo real por su firma y tamaño) la hace el servidor.
function elegir(evento) {
  const elegido = evento.target.files?.[0] ?? null;
  errorArchivo.value = '';
  if (elegido && !TIPOS.includes(elegido.type)) errorArchivo.value = 'Solo se aceptan archivos JPG, PNG o PDF.';
  else if (elegido && elegido.size > MAXIMO) errorArchivo.value = 'El archivo supera 5 MB.';
  archivo.value = errorArchivo.value ? null : elegido;
}

async function subir() {
  subiendo.value = true;
  error.value = null;
  try {
    venta.value = (await tienda.subirComprobante(venta.value.id, archivo.value)).venta;
    archivo.value = null;
  } catch (e) {
    error.value = e;
  } finally {
    subiendo.value = false;
  }
}

async function cancelar() {
  if (!window.confirm('¿Cancelar este pedido? La unidad volverá a estar disponible para otros clientes.')) return;
  try {
    venta.value = (await tienda.cancelarCompra(venta.value.id)).venta;
  } catch (e) {
    error.value = e;
  }
}

onMounted(cargar);
</script>

<template>
  <RouterLink to="/mis-compras" class="boton-texto mb-4 -ml-2">← Mis compras</RouterLink>
  <AvisoError :error="error" class="mb-4" />

  <template v-if="venta">
    <p v-if="route.query.nueva && venta.estado === 'PENDIENTE_PAGO'" class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
      ¡Pedido confirmado! Reservamos tu unidad.
      {{ esTransferencia ? 'Sube el comprobante de la transferencia para que podamos validarlo.' : 'Paga en la tienda al retirarla.' }}
    </p>

    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight">Pedido #{{ venta.id }}</h1>
        <p class="text-sm text-zinc-500">{{ formatearFecha(venta.creadaEn) }} · {{ METODOS_PAGO[venta.metodoPago] }}</p>
      </div>
      <EtiquetaEstado v-bind="etiquetaEstadoVenta(venta.estado)" />
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div class="space-y-6">
        <section class="tarjeta p-5">
          <h2 class="mb-3 font-bold">Artículos</h2>
          <ul class="divide-y divide-zinc-100">
            <li v-for="d in venta.detalles" :key="d.id" class="flex justify-between gap-4 py-2 text-sm">
              <span>{{ d.cantidad > 1 ? `${d.cantidad} × ` : '' }}{{ d.descripcion }}</span>
              <span class="shrink-0 font-semibold">{{ formatearQuetzales(d.subtotal) }}</span>
            </li>
          </ul>
        </section>

        <section v-if="esTransferencia" class="tarjeta space-y-3 p-5">
          <h2 class="font-bold">Comprobante de transferencia</h2>
          <p v-if="venta.estado === 'PENDIENTE_VALIDACION'" class="text-sm text-sky-800">
            Recibimos tu comprobante. Un asesor lo está validando; te entregaremos la unidad cuando quede aprobado.
          </p>
          <p v-else-if="venta.estado === 'RECHAZADA'" class="text-sm text-red-800">
            El comprobante fue rechazado{{ ultimoRechazo?.motivoRechazo ? `: ${ultimoRechazo.motivoRechazo}` : '' }}. El pedido se cerró y la unidad se liberó.
          </p>
          <p v-else-if="['PAGADA', 'ENTREGADA'].includes(venta.estado)" class="text-sm text-emerald-800">Transferencia validada.</p>

          <form v-if="puedeSubir" class="space-y-3" @submit.prevent="subir">
            <p class="text-sm text-zinc-600">Transfiere {{ formatearQuetzales(venta.total) }} y sube la foto o el PDF del comprobante (JPG, PNG o PDF, máximo 5 MB).</p>
            <label class="etiqueta" for="comprobante">Archivo</label>
            <input id="comprobante" type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" class="block w-full text-sm" @change="elegir" />
            <p v-if="errorArchivo" role="alert" class="text-sm text-red-700">{{ errorArchivo }}</p>
            <button type="submit" class="boton-principal" :disabled="!archivo || subiendo">{{ subiendo ? 'Subiendo…' : 'Enviar comprobante' }}</button>
          </form>
        </section>

        <section v-else-if="venta.estado === 'PENDIENTE_PAGO'" class="tarjeta p-5 text-sm text-zinc-700">
          Tu unidad está reservada. Paga en la tienda (efectivo, tarjeta o transferencia) cuando la recojas.
        </section>
      </div>

      <aside class="space-y-6">
        <section class="tarjeta space-y-4 p-5">
          <h2 class="font-bold">Total</h2>
          <ResumenTotales :totales="venta" />
          <button v-if="venta.estado === 'PENDIENTE_PAGO'" type="button" class="boton-secundario w-full" @click="cancelar">Cancelar pedido</button>
        </section>

        <section class="tarjeta space-y-2 p-5">
          <h2 class="font-bold">Facturación</h2>
          <p class="text-sm text-zinc-600">NIT {{ venta.facturacion.nit }} · {{ venta.facturacion.nombre }}</p>
          <p v-if="!venta.facturas.length" class="text-sm text-zinc-500">La factura se emite cuando el pago queda confirmado.</p>
          <ul v-else class="space-y-2">
            <li v-for="f in venta.facturas" :key="f.id" class="flex items-center justify-between gap-2">
              <RouterLink :to="{ name: 'factura', params: { id: f.id } }" class="font-semibold text-acento-700 hover:underline">{{ f.numeroCompleto }}</RouterLink>
              <EtiquetaEstado v-bind="etiquetaEstadoFactura(f.estado)" />
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </template>
</template>
