<script setup>
// RF 09: cupones por porcentaje o monto fijo, con vigencia, límite de usos y canal (PA-12).
import { onMounted, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import { formatearQuetzales } from '../../logica/formato.js';
import { fechaGuatemala, rangoMes } from '../../logica/panel.js';
import AvisoError from '../../componentes/AvisoError.vue';
import AvisoExito from '../../componentes/AvisoExito.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const cupones = ref([]);
const formulario = ref(null);
const { cargando, error, mensaje, ejecutar } = usarAccion();
const CANALES = { WEB: 'Solo tienda web', POS: 'Solo mostrador', AMBOS: 'Web y mostrador' };

const vacio = () => ({ id: null, codigo: '', tipo: 'PORCENTAJE', valor: '', vigenteDesde: fechaGuatemala(), vigenteHasta: rangoMes().hasta, usosMaximos: '', canal: 'AMBOS', activo: true });
const vigente = (c) => c.activo && new Date(c.vigenteDesde) <= new Date() && new Date() <= new Date(c.vigenteHasta) && (c.usosMaximos === null || c.usosActuales < c.usosMaximos);
const dia = (fecha) => fechaGuatemala(new Date(fecha));

const cargar = async () => { cupones.value = (await panel.cupones()).cupones; };

function editar(c) {
  formulario.value = { id: c.id, codigo: c.codigo, tipo: c.tipo, valor: c.valor, vigenteDesde: dia(c.vigenteDesde), vigenteHasta: dia(c.vigenteHasta), usosMaximos: c.usosMaximos ?? '', canal: c.canal, activo: c.activo };
}

async function guardar() {
  const { id, codigo, usosMaximos, ...resto } = formulario.value;
  const datos = { ...resto, usosMaximos: usosMaximos === '' ? null : Number(usosMaximos) };
  const ok = await ejecutar(() => (id ? panel.actualizarCupon(id, datos) : panel.crearCupon({ ...datos, codigo, usosMaximos: datos.usosMaximos ?? undefined })), 'Cupón guardado.');
  if (ok) { formulario.value = null; await cargar(); }
}

async function alternar(c) {
  if (await ejecutar(() => panel.actualizarCupon(c.id, { activo: !c.activo }))) await cargar();
}

onMounted(() => ejecutar(cargar));
</script>

<template>
  <TituloPanel titulo="Cupones" descripcion="La vigencia se cuenta en días de Guatemala. El canal decide si sirve en la tienda web, en el mostrador o en ambos.">
    <button type="button" class="boton-principal" @click="formulario = vacio()">Nuevo cupón</button>
  </TituloPanel>
  <AvisoError :error="error" class="mb-4" />
  <AvisoExito :texto="mensaje" class="mb-4" />

  <form v-if="formulario" class="tarjeta mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4" @submit.prevent="guardar">
    <div><label class="etiqueta" for="cu-cod">Código</label><input id="cu-cod" v-model="formulario.codigo" class="campo uppercase" required minlength="3" maxlength="40" :disabled="!!formulario.id" /></div>
    <div><label class="etiqueta" for="cu-tipo">Tipo</label><select id="cu-tipo" v-model="formulario.tipo" class="campo"><option value="PORCENTAJE">Porcentaje</option><option value="MONTO_FIJO">Monto fijo (Q)</option></select></div>
    <div><label class="etiqueta" for="cu-valor">{{ formulario.tipo === 'PORCENTAJE' ? 'Porcentaje' : 'Monto (Q)' }}</label><input id="cu-valor" v-model="formulario.valor" class="campo" required inputmode="decimal" /></div>
    <div><label class="etiqueta" for="cu-canal">Canal</label><select id="cu-canal" v-model="formulario.canal" class="campo"><option v-for="(t, c) in CANALES" :key="c" :value="c">{{ t }}</option></select></div>
    <div><label class="etiqueta" for="cu-desde">Vigente desde</label><input id="cu-desde" v-model="formulario.vigenteDesde" class="campo" type="date" required /></div>
    <div><label class="etiqueta" for="cu-hasta">Vigente hasta</label><input id="cu-hasta" v-model="formulario.vigenteHasta" class="campo" type="date" required /></div>
    <div><label class="etiqueta" for="cu-usos">Límite de usos (vacío = sin límite)</label><input id="cu-usos" v-model="formulario.usosMaximos" class="campo" type="number" min="1" /></div>
    <label class="flex items-center gap-2 self-end pb-2 text-sm"><input v-model="formulario.activo" type="checkbox" class="accent-acento-600" /> Activo</label>
    <div class="flex gap-2 sm:col-span-2 lg:col-span-4">
      <button type="submit" class="boton-principal" :disabled="cargando">Guardar</button>
      <button type="button" class="boton-secundario" @click="formulario = null">Cancelar</button>
    </div>
  </form>

  <div class="tarjeta overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="border-b border-zinc-200 text-left text-zinc-500"><tr><th class="px-4 py-2">Código</th><th>Descuento</th><th>Vigencia</th><th>Usos</th><th>Canal</th><th>Estado</th><th></th></tr></thead>
      <tbody class="divide-y divide-zinc-100">
        <tr v-for="c in cupones" :key="c.id">
          <td class="px-4 py-2 font-mono font-semibold">{{ c.codigo }}</td>
          <td>{{ c.tipo === 'PORCENTAJE' ? `${Number(c.valor)} %` : formatearQuetzales(c.valor) }}</td>
          <td class="whitespace-nowrap">{{ dia(c.vigenteDesde) }} → {{ dia(c.vigenteHasta) }}</td>
          <td>{{ c.usosActuales }}{{ c.usosMaximos ? ` / ${c.usosMaximos}` : '' }}</td>
          <td>{{ CANALES[c.canal] }}</td>
          <td><EtiquetaEstado :texto="vigente(c) ? 'Vigente' : c.activo ? 'No vigente' : 'Inactivo'" :tono="vigente(c) ? 'verde' : 'gris'" /></td>
          <td class="pr-4 text-right whitespace-nowrap">
            <button type="button" class="boton-texto" @click="editar(c)">Editar</button>
            <button type="button" class="boton-texto" @click="alternar(c)">{{ c.activo ? 'Desactivar' : 'Activar' }}</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!cupones.length" class="p-6 text-center text-sm text-zinc-500">Aún no hay cupones.</p>
  </div>
</template>
