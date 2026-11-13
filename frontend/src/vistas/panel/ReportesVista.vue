<script setup>
// RF 10: ventas por período, motocicletas más vendidas, flujo de caja y rendimiento (margen bruto).
import { computed, onMounted, reactive, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import { rangoMes } from '../../logica/panel.js';
import { aCentavos, desdeCentavos, formatearQuetzales } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import BarraReporte from '../../componentes/BarraReporte.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const rango = reactive({ ...rangoMes(), agrupar: 'dia' });
const datos = ref(null);
const { cargando, error, ejecutar } = usarAccion();
const maximo = (lista, campo) => desdeCentavos(Math.max(0, ...lista.map((x) => aCentavos(x[campo]) ?? 0)));
const maxPeriodo = computed(() => maximo(datos.value?.ventas.periodos ?? [], 'total'));
const maxModelo = computed(() => maximo(datos.value?.masVendidas.modelos ?? [], 'ingresos'));

async function cargar() {
  await ejecutar(async () => {
    const { desde, hasta, agrupar } = rango;
    const [ventas, masVendidas, flujo, rendimiento] = await Promise.all([
      panel.reporte('ventas', { desde, hasta, agrupar }),
      panel.reporte('mas-vendidas', { desde, hasta }),
      panel.reporte('flujo-caja', { desde, hasta }),
      panel.reporte('rendimiento', { desde, hasta }),
    ]);
    datos.value = { ventas, masVendidas, flujo, rendimiento };
  });
}

onMounted(cargar);
</script>

<template>
  <TituloPanel titulo="Reportes" descripcion="Solo cuentan las ventas cobradas, según su fecha de pago (día de Guatemala). Montos en GTQ." />
  <form class="tarjeta mb-6 flex flex-wrap items-end gap-3 p-4" @submit.prevent="cargar">
    <div><label class="etiqueta" for="r-desde">Desde</label><input id="r-desde" v-model="rango.desde" class="campo" type="date" required /></div>
    <div><label class="etiqueta" for="r-hasta">Hasta</label><input id="r-hasta" v-model="rango.hasta" class="campo" type="date" required /></div>
    <div><label class="etiqueta" for="r-agrupar">Agrupar ventas</label><select id="r-agrupar" v-model="rango.agrupar" class="campo"><option value="dia">Por día</option><option value="mes">Por mes</option></select></div>
    <button type="submit" class="boton-principal" :disabled="cargando">Actualizar</button>
  </form>
  <AvisoError :error="error" class="mb-4" />

  <template v-if="datos">
    <div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="tarjeta p-5"><p class="text-sm text-zinc-500">Ventas cobradas</p><p class="text-2xl font-extrabold">{{ formatearQuetzales(datos.ventas.resumen.total) }}</p><p class="text-xs text-zinc-500">{{ datos.ventas.resumen.cantidadVentas }} venta(s) · IVA {{ formatearQuetzales(datos.ventas.resumen.iva) }}</p></div>
      <div class="tarjeta p-5"><p class="text-sm text-zinc-500">Ingresos sin IVA</p><p class="text-2xl font-extrabold">{{ formatearQuetzales(datos.rendimiento.ingresosSinIva) }}</p></div>
      <div class="tarjeta p-5"><p class="text-sm text-zinc-500">Costo de motos vendidas</p><p class="text-2xl font-extrabold">{{ formatearQuetzales(datos.rendimiento.costoMotocicletas) }}</p><p class="text-xs text-zinc-500">{{ datos.rendimiento.motocicletasVendidas }} unidad(es)</p></div>
      <div class="tarjeta p-5"><p class="text-sm text-zinc-500">Margen bruto</p><p class="text-2xl font-extrabold text-emerald-700">{{ formatearQuetzales(datos.rendimiento.margenBruto) }}</p><p class="text-xs text-zinc-500">{{ datos.rendimiento.margenPorcentaje ? `${datos.rendimiento.margenPorcentaje} % de los ingresos sin IVA` : '—' }}</p></div>
    </div>
    <p class="mb-6 rounded-lg bg-zinc-100 p-3 text-xs text-zinc-600">{{ datos.rendimiento.nota }}</p>

    <div class="grid gap-6 xl:grid-cols-2">
      <section class="tarjeta space-y-2 p-5">
        <h2 class="mb-2 font-bold">Ventas por {{ rango.agrupar === 'mes' ? 'mes' : 'día' }}</h2>
        <BarraReporte v-for="p in datos.ventas.periodos" :key="p.periodo" :etiqueta="p.periodo" :valor="p.total" :maximo="maxPeriodo" :texto="formatearQuetzales(p.total)" />
        <p v-if="!datos.ventas.periodos.length" class="text-sm text-zinc-500">Sin ventas en el período.</p>
        <div class="flex flex-wrap gap-4 border-t border-zinc-100 pt-3 text-sm text-zinc-600">
          <span v-for="c in datos.ventas.porCanal" :key="c.canal">{{ c.canal === 'WEB' ? 'Web' : 'Mostrador' }}: {{ formatearQuetzales(c.total) }}</span>
          <span v-for="m in datos.ventas.porMetodo" :key="m.metodo">{{ m.metodo }}: {{ formatearQuetzales(m.total) }}</span>
        </div>
      </section>

      <section class="tarjeta space-y-2 p-5">
        <h2 class="mb-2 font-bold">Motocicletas más vendidas</h2>
        <BarraReporte v-for="m in datos.masVendidas.modelos" :key="m.modeloId" :etiqueta="m.modelo" :valor="m.ingresos" :maximo="maxModelo" :texto="`${m.unidades} u · ${formatearQuetzales(m.ingresos)}`" />
        <p v-if="!datos.masVendidas.modelos.length" class="text-sm text-zinc-500">Sin motos vendidas en el período.</p>
        <h3 v-if="datos.masVendidas.accesorios.length" class="pt-3 font-semibold">Accesorios</h3>
        <p v-for="a in datos.masVendidas.accesorios" :key="a.accesorioId" class="flex justify-between text-sm"><span>{{ a.nombre }}</span><span>{{ a.unidades }} u · {{ formatearQuetzales(a.ingresos) }}</span></p>
      </section>
    </div>

    <section class="tarjeta mt-6 overflow-x-auto p-5">
      <h2 class="mb-3 font-bold">Flujo de caja</h2>
      <table class="w-full text-sm">
        <thead class="text-left text-zinc-500"><tr><th class="py-1">Día</th><th class="text-right">Efectivo</th><th class="text-right">Tarjeta</th><th class="text-right">Transferencias</th><th class="text-right">Retiros</th><th class="text-right">Neto</th><th class="text-right">Diferencia</th></tr></thead>
        <tbody class="divide-y divide-zinc-100">
          <tr v-for="d in datos.flujo.dias" :key="d.fecha">
            <td class="py-2">{{ d.fecha }} <span v-if="d.estado === 'ABIERTA'" class="text-xs text-zinc-500">(abierta)</span></td>
            <td class="text-right">{{ formatearQuetzales(d.ingresosEfectivo) }}</td><td class="text-right">{{ formatearQuetzales(d.ingresosTarjeta) }}</td>
            <td class="text-right">{{ formatearQuetzales(d.ingresosTransferencia) }}</td><td class="text-right">{{ formatearQuetzales(d.retiros) }}</td>
            <td class="text-right font-semibold">{{ formatearQuetzales(d.neto) }}</td><td class="text-right">{{ d.diferenciaEfectivo === null ? '—' : formatearQuetzales(d.diferenciaEfectivo) }}</td>
          </tr>
        </tbody>
        <tfoot class="border-t border-zinc-200 font-bold">
          <tr><td class="py-2">Total</td><td class="text-right">{{ formatearQuetzales(datos.flujo.totales.ingresosEfectivo) }}</td><td class="text-right">{{ formatearQuetzales(datos.flujo.totales.ingresosTarjeta) }}</td>
            <td class="text-right">{{ formatearQuetzales(datos.flujo.totales.ingresosTransferencia) }}</td><td class="text-right">{{ formatearQuetzales(datos.flujo.totales.retiros) }}</td><td class="text-right">{{ formatearQuetzales(datos.flujo.totales.neto) }}</td><td></td></tr>
        </tfoot>
      </table>
      <p v-if="!datos.flujo.dias.length" class="py-4 text-center text-sm text-zinc-500">Sin cajas en el período.</p>
    </section>
  </template>
</template>
