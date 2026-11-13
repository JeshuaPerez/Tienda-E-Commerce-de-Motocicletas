<script setup>
// RF 06: existencias por modelo y accesorio con alertas, ajustes de accesorios y bitácora de entradas/salidas.
import { onMounted, reactive, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import { formatearFecha } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import AvisoExito from '../../componentes/AvisoExito.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const resumen = ref({ modelos: [], accesorios: [] });
const movimientos = ref({ movimientos: [], total: 0 });
const filtroTipo = ref('');
const ajuste = reactive({ accesorioId: '', cantidad: '', referencia: '' });
const { cargando, error, mensaje, ejecutar } = usarAccion();

async function cargar() {
  await ejecutar(async () => {
    [resumen.value, movimientos.value] = await Promise.all([
      panel.resumenInventario(),
      panel.movimientos({ tipo: filtroTipo.value, porPagina: 30 }),
    ]);
  });
}

async function ajustar() {
  const ok = await ejecutar(
    () => panel.ajustarAccesorio({ accesorioId: Number(ajuste.accesorioId), cantidad: Number(ajuste.cantidad), referencia: ajuste.referencia }),
    'Ajuste registrado.',
  );
  if (ok) {
    Object.assign(ajuste, { accesorioId: '', cantidad: '', referencia: '' });
    const texto = mensaje.value;
    await cargar();
    mensaje.value = texto;
  }
}

onMounted(cargar);
</script>

<template>
  <TituloPanel titulo="Inventario" descripcion="Unidades por modelo (por VIN), accesorios y movimientos. La alerta se activa al llegar al stock mínimo." />
  <AvisoError :error="error" class="mb-4" />
  <AvisoExito :texto="mensaje" class="mb-4" />

  <div class="grid gap-6 xl:grid-cols-2">
    <section class="tarjeta overflow-x-auto p-5">
      <h2 class="mb-3 font-bold">Motocicletas por modelo</h2>
      <table class="w-full text-sm">
        <thead class="text-left text-zinc-500"><tr><th class="py-1">Modelo</th><th>Disp.</th><th>Reserv.</th><th>Vend.</th><th>Mín.</th><th></th></tr></thead>
        <tbody class="divide-y divide-zinc-100">
          <tr v-for="m in resumen.modelos" :key="m.id">
            <td class="py-2">{{ m.marca.nombre }} {{ m.nombre }} <span class="text-zinc-500">· {{ m.cilindrada }} cc</span></td>
            <td>{{ m.disponibles }}</td><td>{{ m.reservadas }}</td><td>{{ m.vendidas }}</td><td>{{ m.stockMinimo }}</td>
            <td><EtiquetaEstado v-if="m.alerta" texto="Stock bajo" tono="rojo" /></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="tarjeta overflow-x-auto p-5">
      <h2 class="mb-3 font-bold">Accesorios</h2>
      <table class="w-full text-sm">
        <thead class="text-left text-zinc-500"><tr><th class="py-1">Accesorio</th><th>Stock</th><th>Mín.</th><th></th></tr></thead>
        <tbody class="divide-y divide-zinc-100">
          <tr v-for="a in resumen.accesorios" :key="a.id">
            <td class="py-2">{{ a.nombre }} <span class="text-zinc-500">· {{ a.sku }}</span></td>
            <td>{{ a.stock }}</td><td>{{ a.stockMinimo }}</td>
            <td><EtiquetaEstado v-if="a.alerta" texto="Stock bajo" tono="rojo" /></td>
          </tr>
        </tbody>
      </table>

      <form class="mt-5 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-[1fr_7rem]" @submit.prevent="ajustar">
        <h3 class="font-semibold sm:col-span-2">Ajuste de accesorio</h3>
        <div>
          <label class="etiqueta" for="aj-acc">Accesorio</label>
          <select id="aj-acc" v-model="ajuste.accesorioId" class="campo" required>
            <option value="" disabled>Elige…</option>
            <option v-for="a in resumen.accesorios" :key="a.id" :value="a.id">{{ a.nombre }} ({{ a.stock }})</option>
          </select>
        </div>
        <div>
          <label class="etiqueta" for="aj-cant">Cantidad</label>
          <input id="aj-cant" v-model="ajuste.cantidad" class="campo" type="number" required placeholder="+5 o -2" />
        </div>
        <div class="sm:col-span-2">
          <label class="etiqueta" for="aj-ref">Motivo</label>
          <input id="aj-ref" v-model="ajuste.referencia" class="campo" required maxlength="200" placeholder="Conteo físico, unidad dañada…" />
        </div>
        <button type="submit" class="boton-principal sm:col-span-2" :disabled="cargando">Registrar ajuste</button>
      </form>
    </section>
  </div>

  <section class="tarjeta mt-6 overflow-x-auto p-5">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-bold">Entradas y salidas</h2>
      <select v-model="filtroTipo" class="campo w-auto" aria-label="Tipo de movimiento" @change="cargar">
        <option value="">Todas</option><option value="ENTRADA">Entradas</option><option value="SALIDA">Salidas</option>
      </select>
    </div>
    <table class="w-full text-sm">
      <thead class="text-left text-zinc-500"><tr><th class="py-1">Fecha</th><th>Tipo</th><th>Motivo</th><th>Artículo</th><th>Cant.</th><th>Referencia</th></tr></thead>
      <tbody class="divide-y divide-zinc-100">
        <tr v-for="m in movimientos.movimientos" :key="m.id">
          <td class="py-2 whitespace-nowrap">{{ formatearFecha(m.fecha) }}</td>
          <td><EtiquetaEstado :texto="m.tipo" :tono="m.tipo === 'ENTRADA' ? 'verde' : 'ambar'" /></td>
          <td>{{ m.motivo }}</td>
          <td class="font-mono text-xs">{{ m.vin ?? m.sku }}</td>
          <td>{{ m.cantidad }}</td>
          <td class="text-zinc-600">{{ m.referencia }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="!movimientos.movimientos.length" class="py-4 text-center text-sm text-zinc-500">Sin movimientos.</p>
  </section>
</template>
