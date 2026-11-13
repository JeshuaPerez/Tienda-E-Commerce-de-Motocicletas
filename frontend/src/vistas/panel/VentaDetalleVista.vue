<script setup>
// Detalle de una venta con sus acciones: cobrar un pedido "POS al retirar" (RN 5), despachar solo si
// está pagada (RN 4) y cancelar un pedido pendiente (libera las unidades, PA-4).
import { onMounted, reactive, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import { etiquetaEstadoFactura, etiquetaEstadoVenta, formatearFecha, formatearQuetzales, METODOS_PAGO } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import AvisoExito from '../../componentes/AvisoExito.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';
import ResumenTotales from '../../componentes/ResumenTotales.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const props = defineProps({ id: { type: String, required: true } });
const venta = ref(null);
const cobro = reactive({ metodo: 'EFECTIVO', referencia: '' });
const { cargando, error, mensaje, ejecutar } = usarAccion();

async function accion(promesa, texto) {
  const r = await ejecutar(promesa, texto);
  if (r) venta.value = r.venta;
}

const cobrar = () => accion(() => panel.cobrar(venta.value.id, { metodo: cobro.metodo, referencia: cobro.referencia || undefined }), 'Pedido cobrado y facturado.');
const entregar = () => accion(() => panel.entregar(venta.value.id), 'Unidad despachada.');
const cancelar = () => window.confirm('¿Cancelar la venta? Se liberarán las unidades reservadas.') && accion(() => panel.cancelarVenta(venta.value.id), 'Venta cancelada.');

onMounted(() => ejecutar(async () => { venta.value = (await panel.venta(props.id)).venta; }));
</script>

<template>
  <RouterLink to="/panel/ventas" class="boton-texto mb-4 -ml-2">← Ventas</RouterLink>
  <AvisoError :error="error" class="mb-4" />
  <AvisoExito :texto="mensaje" class="mb-4" />

  <template v-if="venta">
    <TituloPanel :titulo="`Venta #${venta.id}`" :descripcion="`${venta.canal === 'WEB' ? 'Tienda web' : 'Mostrador'} · ${formatearFecha(venta.creadaEn)} · ${METODOS_PAGO[venta.metodoPago]}`">
      <EtiquetaEstado v-bind="etiquetaEstadoVenta(venta.estado)" />
    </TituloPanel>

    <div class="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div class="space-y-6">
        <section class="tarjeta p-5">
          <h2 class="mb-2 font-bold">Artículos</h2>
          <ul class="divide-y divide-zinc-100 text-sm">
            <li v-for="d in venta.detalles" :key="d.id" class="flex justify-between gap-4 py-2"><span>{{ d.cantidad > 1 ? `${d.cantidad} × ` : '' }}{{ d.descripcion }}</span><span class="font-semibold">{{ formatearQuetzales(d.subtotal) }}</span></li>
          </ul>
        </section>

        <section v-if="venta.metodoPago === 'POS_AL_RETIRAR' && venta.estado === 'PENDIENTE_PAGO'" class="tarjeta space-y-3 p-5">
          <h2 class="font-bold">Cobrar al retirar</h2>
          <div class="grid gap-2 sm:grid-cols-2">
            <select v-model="cobro.metodo" class="campo" aria-label="Método de pago"><option value="EFECTIVO">Efectivo</option><option value="TARJETA">Tarjeta</option><option value="TRANSFERENCIA">Transferencia</option></select>
            <input v-if="cobro.metodo !== 'EFECTIVO'" v-model="cobro.referencia" class="campo" maxlength="100" placeholder="Voucher o referencia" aria-label="Referencia" />
          </div>
          <button type="button" class="boton-principal" :disabled="cargando" @click="cobrar">Cobrar {{ formatearQuetzales(venta.total) }}</button>
        </section>

        <section v-if="venta.comprobantes.length" class="tarjeta p-5">
          <h2 class="mb-2 font-bold">Comprobantes</h2>
          <ul class="space-y-1 text-sm">
            <li v-for="c in venta.comprobantes" :key="c.id">#{{ c.id }} · {{ c.estado }} · {{ formatearFecha(c.subidoEn) }}{{ c.motivoRechazo ? ` · ${c.motivoRechazo}` : '' }}</li>
          </ul>
          <RouterLink v-if="venta.estado === 'PENDIENTE_VALIDACION'" to="/panel/transferencias" class="boton-secundario mt-3">Validar transferencia</RouterLink>
        </section>
      </div>

      <aside class="space-y-6">
        <section class="tarjeta space-y-3 p-5">
          <ResumenTotales :totales="venta" />
          <p class="text-sm text-zinc-600">Cliente: {{ venta.cliente?.nombre }}<br />Facturación: NIT {{ venta.facturacion.nit }} · {{ venta.facturacion.direccion }}</p>
          <button v-if="venta.estado === 'PAGADA'" type="button" class="boton-principal w-full" :disabled="cargando" @click="entregar">Despachar unidad</button>
          <p v-else-if="['PENDIENTE_PAGO', 'PENDIENTE_VALIDACION'].includes(venta.estado)" class="text-xs text-zinc-500">No se puede despachar hasta que el pago esté validado.</p>
          <button v-if="['PENDIENTE_PAGO', 'PENDIENTE_VALIDACION'].includes(venta.estado)" type="button" class="boton-secundario w-full" :disabled="cargando" @click="cancelar">Cancelar venta</button>
        </section>
        <section class="tarjeta space-y-2 p-5">
          <h2 class="font-bold">Facturas</h2>
          <p v-if="!venta.facturas.length" class="text-sm text-zinc-500">Se emite al quedar pagada.</p>
          <div v-for="f in venta.facturas" :key="f.id" class="flex items-center justify-between">
            <RouterLink :to="{ name: 'panel-factura', params: { id: f.id } }" class="font-semibold text-acento-700">{{ f.numeroCompleto }}</RouterLink>
            <EtiquetaEstado v-bind="etiquetaEstadoFactura(f.estado)" />
          </div>
        </section>
      </aside>
    </div>
  </template>
</template>
