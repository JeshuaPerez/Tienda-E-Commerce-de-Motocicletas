<script setup>
// RF 05: apertura y cierre de la caja diaria, retiros, ingresos por medio y cuadre de efectivo y vouchers.
import { onMounted, reactive, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import { formatearFecha, formatearQuetzales } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import AvisoExito from '../../componentes/AvisoExito.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const actual = ref(null);
const sesiones = ref([]);
const cuadreVisto = ref(null);
const montoInicial = ref('');
const retiro = reactive({ monto: '', concepto: '' });
const cierre = reactive({ efectivoContado: '', vouchersContado: '', notas: '' });
const { cargando, error, mensaje, ejecutar } = usarAccion();

async function cargar() {
  [actual.value, sesiones.value] = await Promise.all([panel.cajaActual(), panel.sesionesCaja().then((r) => r.sesiones)]);
}

async function accion(promesa, texto, alTerminar) {
  const r = await ejecutar(promesa, texto);
  if (r) { alTerminar?.(r); await cargar(); }
}

const abrir = () => accion(() => panel.abrirCaja(montoInicial.value || '0'), 'Caja abierta.', () => { montoInicial.value = ''; });
const retirar = () => accion(() => panel.retirar({ ...retiro }), 'Retiro registrado.', () => Object.assign(retiro, { monto: '', concepto: '' }));
const cerrar = () => {
  if (!window.confirm('¿Cerrar la caja? Después de cerrarla no se pueden registrar más ventas en mostrador hoy hasta abrir otra.')) return;
  return accion(() => panel.cerrarCaja({ ...cierre, notas: cierre.notas || undefined }), 'Caja cerrada.', (r) => {
    cuadreVisto.value = r.caja;
    Object.assign(cierre, { efectivoContado: '', vouchersContado: '', notas: '' });
  });
};
const verCuadre = (id) => ejecutar(async () => { cuadreVisto.value = (await panel.cuadre(id)).caja; });

onMounted(() => ejecutar(cargar));
</script>

<template>
  <TituloPanel titulo="Caja" descripcion="Ninguna venta en mostrador se registra con la caja del día cerrada." />
  <AvisoError :error="error" class="mb-4" />
  <AvisoExito :texto="mensaje" class="mb-4" />

  <section v-if="actual && !actual.caja" class="tarjeta mb-6 max-w-md p-5">
    <h2 class="mb-3 font-bold">Abrir la caja de hoy</h2>
    <form class="flex gap-2" @submit.prevent="abrir">
      <label for="c-inicial" class="sr-only">Monto inicial</label>
      <input id="c-inicial" v-model="montoInicial" class="campo" inputmode="decimal" placeholder="Monto inicial en efectivo (Q)" />
      <button type="submit" class="boton-principal" :disabled="cargando">Abrir</button>
    </form>
  </section>

  <template v-if="actual?.caja">
    <p v-if="!actual.esDelDia" class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      La caja abierta es del {{ actual.caja.fechaOperacion }}. Ciérrala para poder abrir la de hoy y volver a vender.
    </p>
    <div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="tarjeta p-5"><p class="text-sm text-zinc-500">Efectivo esperado</p><p class="text-2xl font-extrabold">{{ formatearQuetzales(actual.resumen.efectivoEsperado) }}</p>
        <p class="text-xs text-zinc-500">Inicial {{ formatearQuetzales(actual.resumen.montoInicial) }} + ingresos {{ formatearQuetzales(actual.resumen.ingresosEfectivo) }} − retiros {{ formatearQuetzales(actual.resumen.retirosEfectivo) }}</p></div>
      <div class="tarjeta p-5"><p class="text-sm text-zinc-500">Vouchers de tarjeta</p><p class="text-2xl font-extrabold">{{ formatearQuetzales(actual.resumen.vouchersEsperado) }}</p></div>
      <div class="tarjeta p-5"><p class="text-sm text-zinc-500">Transferencias validadas</p><p class="text-2xl font-extrabold">{{ formatearQuetzales(actual.resumen.transferencias) }}</p></div>
      <div class="tarjeta p-5"><p class="text-sm text-zinc-500">Caja del {{ actual.caja.fechaOperacion }}</p><p class="text-2xl font-extrabold">Abierta</p><p class="text-xs text-zinc-500">desde {{ formatearFecha(actual.caja.abiertaEn) }}</p></div>
    </div>

    <div class="mb-6 grid gap-6 lg:grid-cols-2">
      <form class="tarjeta space-y-3 p-5" @submit.prevent="retirar">
        <h2 class="font-bold">Retiro de efectivo</h2>
        <div class="grid gap-2 sm:grid-cols-[9rem_1fr]">
          <input v-model="retiro.monto" class="campo" inputmode="decimal" required placeholder="Monto Q" aria-label="Monto del retiro" />
          <input v-model="retiro.concepto" class="campo" required maxlength="200" placeholder="Concepto (depósito, gasto…)" aria-label="Concepto" />
        </div>
        <button type="submit" class="boton-secundario" :disabled="cargando || !actual.esDelDia">Registrar retiro</button>
      </form>

      <form class="tarjeta space-y-3 p-5" @submit.prevent="cerrar">
        <h2 class="font-bold">Cierre y cuadre</h2>
        <div class="grid gap-2 sm:grid-cols-2">
          <div><label class="etiqueta" for="c-ef">Efectivo contado (Q)</label><input id="c-ef" v-model="cierre.efectivoContado" class="campo" inputmode="decimal" required /></div>
          <div><label class="etiqueta" for="c-vo">Total de vouchers (Q)</label><input id="c-vo" v-model="cierre.vouchersContado" class="campo" inputmode="decimal" required /></div>
        </div>
        <input v-model="cierre.notas" class="campo" maxlength="500" placeholder="Notas del cierre (opcional)" aria-label="Notas del cierre" />
        <button type="submit" class="boton-principal" :disabled="cargando">Cerrar caja</button>
      </form>
    </div>

    <section class="tarjeta overflow-x-auto p-5">
      <h2 class="mb-3 font-bold">Movimientos de la caja</h2>
      <table class="w-full text-sm">
        <thead class="text-left text-zinc-500"><tr><th class="py-1">Hora</th><th>Tipo</th><th>Medio</th><th>Concepto</th><th>Referencia</th><th class="text-right">Monto</th></tr></thead>
        <tbody class="divide-y divide-zinc-100">
          <tr v-for="m in actual.movimientos" :key="m.id">
            <td class="py-2 whitespace-nowrap">{{ formatearFecha(m.fecha) }}</td>
            <td><EtiquetaEstado :texto="m.tipo" :tono="m.tipo === 'INGRESO' ? 'verde' : 'ambar'" /></td>
            <td>{{ m.medio }}</td><td>{{ m.concepto }}</td><td class="text-zinc-600">{{ m.referencia ?? '—' }}</td>
            <td class="text-right font-medium">{{ m.tipo === 'RETIRO' ? '-' : '' }}{{ formatearQuetzales(m.monto) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!actual.movimientos.length" class="py-4 text-center text-sm text-zinc-500">Sin movimientos todavía.</p>
    </section>
  </template>

  <section v-if="cuadreVisto?.cuadre" class="tarjeta mt-6 p-5">
    <h2 class="mb-3 font-bold">Cuadre de la caja del {{ cuadreVisto.fechaOperacion }}</h2>
    <dl class="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      <div class="flex justify-between"><dt>Efectivo esperado</dt><dd>{{ formatearQuetzales(cuadreVisto.cuadre.efectivoEsperado) }}</dd></div>
      <div class="flex justify-between"><dt>Efectivo contado</dt><dd>{{ formatearQuetzales(cuadreVisto.cuadre.efectivoContado) }}</dd></div>
      <div class="flex justify-between font-bold" :class="cuadreVisto.cuadre.diferenciaEfectivo.startsWith('-') ? 'text-red-700' : 'text-emerald-700'">
        <dt>Diferencia de efectivo</dt><dd>{{ formatearQuetzales(cuadreVisto.cuadre.diferenciaEfectivo) }}</dd></div>
      <div class="flex justify-between"><dt>Vouchers esperados / contados</dt><dd>{{ formatearQuetzales(cuadreVisto.cuadre.vouchersEsperado) }} / {{ formatearQuetzales(cuadreVisto.cuadre.vouchersContado) }}</dd></div>
      <div class="flex justify-between"><dt>Diferencia de vouchers</dt><dd>{{ formatearQuetzales(cuadreVisto.cuadre.diferenciaVouchers) }}</dd></div>
      <div class="flex justify-between"><dt>Transferencias</dt><dd>{{ formatearQuetzales(cuadreVisto.cuadre.transferencias) }}</dd></div>
    </dl>
  </section>

  <section class="tarjeta mt-6 overflow-x-auto p-5">
    <h2 class="mb-3 font-bold">Historial de cajas</h2>
    <table class="w-full text-sm">
      <thead class="text-left text-zinc-500"><tr><th class="py-1">Día</th><th>Estado</th><th>Abierta</th><th>Cerrada</th><th></th></tr></thead>
      <tbody class="divide-y divide-zinc-100">
        <tr v-for="s in sesiones" :key="s.id">
          <td class="py-2">{{ s.fechaOperacion }}</td>
          <td><EtiquetaEstado :texto="s.estado" :tono="s.estado === 'ABIERTA' ? 'verde' : 'gris'" /></td>
          <td>{{ formatearFecha(s.abiertaEn) }}</td><td>{{ formatearFecha(s.cerradaEn) }}</td>
          <td class="text-right"><button v-if="s.estado === 'CERRADA'" type="button" class="boton-texto" @click="verCuadre(s.id)">Ver cuadre</button></td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
