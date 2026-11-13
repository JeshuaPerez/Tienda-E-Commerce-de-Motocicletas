<script setup>
// RF 08: facturas internas emitidas. Búsqueda por NIT, anulación con motivo y reemisión con datos corregidos.
import { computed, onMounted, reactive, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import { etiquetaEstadoFactura, formatearFecha, formatearQuetzales } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import AvisoExito from '../../componentes/AvisoExito.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const filtros = reactive({ nit: '', estado: '', pagina: 1 });
const lista = ref({ facturas: [], total: 0 });
const anulando = ref(null); // { factura, motivo, reemitir, nit, nombre, direccion }
const { cargando, error, mensaje, ejecutar } = usarAccion();
const paginas = computed(() => Math.max(1, Math.ceil(lista.value.total / 20)));

const cargar = () => ejecutar(async () => { lista.value = await panel.facturas({ ...filtros }); });
const buscar = () => { filtros.pagina = 1; cargar(); };

function preparar(f) {
  anulando.value = { factura: f, motivo: '', reemitir: true, nit: f.receptor.nit, nombre: f.receptor.nombre, direccion: f.receptor.direccion };
}

async function confirmar() {
  const a = anulando.value;
  const anulada = await ejecutar(() => panel.anularFactura(a.factura.id, a.motivo), `Factura ${a.factura.numeroCompleto} anulada.`);
  if (!anulada) return;
  if (a.reemitir) {
    await ejecutar(() => panel.reemitirFactura({ ventaId: a.factura.ventaId, nit: a.nit, nombre: a.nombre, direccion: a.direccion }),
      `Factura ${a.factura.numeroCompleto} anulada y reemitida con los datos corregidos.`);
  }
  anulando.value = null;
  const texto = mensaje.value;
  await cargar();
  mensaje.value = texto;
}

onMounted(cargar);
</script>

<template>
  <TituloPanel titulo="Facturación" descripcion="Facturas internas (no FEL). Se emiten solas al quedar pagada cada venta; una emitida no se edita: se anula y se reemite." />
  <AvisoError :error="error" class="mb-4" />
  <AvisoExito :texto="mensaje" class="mb-4" />

  <form v-if="anulando" class="tarjeta mb-6 grid gap-4 p-5 sm:grid-cols-3" @submit.prevent="confirmar">
    <h2 class="font-bold sm:col-span-3">Anular {{ anulando.factura.numeroCompleto }}</h2>
    <div class="sm:col-span-3"><label class="etiqueta" for="f-motivo">Motivo de la anulación</label><input id="f-motivo" v-model="anulando.motivo" class="campo" required maxlength="300" /></div>
    <label class="flex items-center gap-2 text-sm sm:col-span-3"><input v-model="anulando.reemitir" type="checkbox" class="accent-acento-600" /> Reemitir con estos datos fiscales</label>
    <template v-if="anulando.reemitir">
      <div><label class="etiqueta" for="f-nit">NIT o CF</label><input id="f-nit" v-model="anulando.nit" class="campo" required maxlength="20" /></div>
      <div><label class="etiqueta" for="f-nombre">Nombre</label><input id="f-nombre" v-model="anulando.nombre" class="campo" required maxlength="150" /></div>
      <div><label class="etiqueta" for="f-dir">Dirección</label><input id="f-dir" v-model="anulando.direccion" class="campo" required maxlength="250" /></div>
    </template>
    <div class="flex gap-2 sm:col-span-3">
      <button type="submit" class="boton-principal" :disabled="cargando">Confirmar</button>
      <button type="button" class="boton-secundario" @click="anulando = null">Cancelar</button>
    </div>
  </form>

  <form class="mb-4 flex flex-wrap gap-2" @submit.prevent="buscar">
    <label for="f-buscar" class="sr-only">NIT</label>
    <input id="f-buscar" v-model="filtros.nit" class="campo w-48" placeholder="Buscar por NIT o CF" />
    <select v-model="filtros.estado" class="campo w-auto" aria-label="Estado" @change="buscar"><option value="">Todas</option><option value="EMITIDA">Emitidas</option><option value="ANULADA">Anuladas</option></select>
    <button type="submit" class="boton-secundario">Buscar</button>
  </form>

  <div class="tarjeta overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="border-b border-zinc-200 text-left text-zinc-500"><tr><th class="px-4 py-2">Número</th><th>Fecha</th><th>NIT</th><th>Nombre</th><th>Venta</th><th class="text-right">Total</th><th class="text-right">IVA</th><th class="px-4">Estado</th><th></th></tr></thead>
      <tbody class="divide-y divide-zinc-100">
        <tr v-for="f in lista.facturas" :key="f.id">
          <td class="px-4 py-2 font-semibold"><RouterLink :to="{ name: 'panel-factura', params: { id: f.id } }" class="hover:text-acento-700">{{ f.numeroCompleto }}</RouterLink></td>
          <td class="whitespace-nowrap">{{ formatearFecha(f.emitidaEn) }}</td><td>{{ f.receptor.nit }}</td><td>{{ f.receptor.nombre }}</td>
          <td><RouterLink :to="{ name: 'panel-venta', params: { id: f.ventaId } }" class="hover:text-acento-700">#{{ f.ventaId }}</RouterLink></td>
          <td class="text-right">{{ formatearQuetzales(f.total) }}</td><td class="text-right text-zinc-600">{{ formatearQuetzales(f.iva) }}</td>
          <td class="px-4"><EtiquetaEstado v-bind="etiquetaEstadoFactura(f.estado)" /></td>
          <td class="pr-4 text-right"><button v-if="f.estado === 'EMITIDA'" type="button" class="boton-texto" @click="preparar(f)">Anular</button></td>
        </tr>
      </tbody>
    </table>
    <p v-if="!lista.facturas.length" class="p-6 text-center text-sm text-zinc-500">Sin facturas.</p>
  </div>
  <nav v-if="paginas > 1" class="mt-4 flex items-center justify-center gap-3" aria-label="Páginas">
    <button type="button" class="boton-secundario" :disabled="filtros.pagina <= 1" @click="filtros.pagina--; cargar()">Anterior</button>
    <span class="text-sm">Página {{ filtros.pagina }} de {{ paginas }}</span>
    <button type="button" class="boton-secundario" :disabled="filtros.pagina >= paginas" @click="filtros.pagina++; cargar()">Siguiente</button>
  </nav>
</template>
