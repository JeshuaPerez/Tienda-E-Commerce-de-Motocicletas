<script setup>
// RF 02: todas las unidades (cualquier estado), alta manual por VIN (RN 1), edición y cambio de estado.
import { computed, onMounted, reactive, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import { formatearQuetzales } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import AvisoExito from '../../componentes/AvisoExito.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const TONOS = { DISPONIBLE: 'verde', RESERVADA: 'ambar', VENDIDA: 'gris' };
const lista = ref({ motocicletas: [], total: 0 });
const modelos = ref([]);
const filtros = reactive({ estado: '', modeloId: '', pagina: 1 });
const formulario = ref(null);
const { cargando, error, mensaje, ejecutar } = usarAccion();
const paginas = computed(() => Math.max(1, Math.ceil(lista.value.total / 20)));

const nueva = () => ({ id: null, vin: '', modeloId: '', anio: new Date().getFullYear(), color: '', precio: '', costoAdquisicion: '', descripcion: '' });

async function cargar() {
  await ejecutar(async () => { lista.value = await panel.motocicletas({ ...filtros }); });
}

function editar(m) {
  formulario.value = { id: m.id, vin: m.vin, modeloId: m.modelo.id, anio: m.anio, color: m.color, precio: m.precio, costoAdquisicion: m.costoAdquisicion ?? '', descripcion: m.descripcion ?? '' };
}

async function guardar() {
  const f = formulario.value;
  const datos = {
    modeloId: Number(f.modeloId), anio: Number(f.anio), color: f.color, precio: f.precio,
    costoAdquisicion: f.costoAdquisicion || undefined, descripcion: f.descripcion || undefined,
  };
  const ok = await ejecutar(
    () => (f.id ? panel.actualizarMoto(f.id, datos) : panel.crearMoto({ ...datos, vin: f.vin })),
    f.id ? 'Motocicleta actualizada.' : `Motocicleta ${f.vin.toUpperCase()} registrada como Disponible.`,
  );
  if (ok) {
    formulario.value = null;
    const texto = mensaje.value;
    await cargar();
    mensaje.value = texto;
  }
}

async function cambiarEstado(m, estado) {
  const ok = await ejecutar(() => panel.cambiarEstadoMoto(m.id, estado), `VIN ${m.vin}: ${estado}.`);
  if (ok) Object.assign(m, ok.motocicleta);
}

const filtrar = () => { filtros.pagina = 1; cargar(); };
const irA = (n) => { filtros.pagina = n; cargar(); };

onMounted(async () => {
  cargar();
  modelos.value = (await panel.modelos().catch(() => ({ modelos: [] }))).modelos;
});
</script>

<template>
  <TituloPanel titulo="Motocicletas" descripcion="Cada unidad tiene un VIN único. Las compras a proveedores también registran unidades al recibirlas.">
    <button type="button" class="boton-principal" @click="formulario = nueva()">Registrar unidad</button>
  </TituloPanel>
  <AvisoError :error="error" class="mb-4" />
  <AvisoExito :texto="mensaje" class="mb-4" />

  <form v-if="formulario" class="tarjeta mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4" @submit.prevent="guardar">
    <h2 class="font-bold sm:col-span-2 lg:col-span-4">{{ formulario.id ? `Editar VIN ${formulario.vin}` : 'Nueva unidad' }}</h2>
    <div v-if="!formulario.id" class="sm:col-span-2">
      <label class="etiqueta" for="m-vin">VIN (17 caracteres)</label>
      <input id="m-vin" v-model="formulario.vin" class="campo font-mono uppercase" required minlength="17" maxlength="17" autocomplete="off" />
    </div>
    <div :class="formulario.id ? 'sm:col-span-2' : ''">
      <label class="etiqueta" for="m-modelo">Modelo</label>
      <select id="m-modelo" v-model="formulario.modeloId" class="campo" required>
        <option value="" disabled>Elige…</option>
        <option v-for="mo in modelos" :key="mo.id" :value="mo.id">{{ mo.marca.nombre }} {{ mo.nombre }}</option>
      </select>
    </div>
    <div><label class="etiqueta" for="m-anio">Año</label><input id="m-anio" v-model="formulario.anio" class="campo" type="number" required min="1900" /></div>
    <div><label class="etiqueta" for="m-color">Color</label><input id="m-color" v-model="formulario.color" class="campo" required maxlength="40" /></div>
    <div><label class="etiqueta" for="m-precio">Precio de venta (Q)</label><input id="m-precio" v-model="formulario.precio" class="campo" required inputmode="decimal" placeholder="25999.99" /></div>
    <div><label class="etiqueta" for="m-costo">Costo de adquisición (Q)</label><input id="m-costo" v-model="formulario.costoAdquisicion" class="campo" inputmode="decimal" /></div>
    <div class="sm:col-span-2 lg:col-span-4"><label class="etiqueta" for="m-desc">Descripción</label><textarea id="m-desc" v-model="formulario.descripcion" class="campo" rows="2" maxlength="2000"></textarea></div>
    <div class="flex gap-2 sm:col-span-2 lg:col-span-4">
      <button type="submit" class="boton-principal" :disabled="cargando">Guardar</button>
      <button type="button" class="boton-secundario" @click="formulario = null">Cancelar</button>
    </div>
  </form>

  <div class="mb-4 flex flex-wrap gap-2">
    <select v-model="filtros.estado" class="campo w-auto" aria-label="Estado" @change="filtrar">
      <option value="">Todos los estados</option><option>DISPONIBLE</option><option>RESERVADA</option><option>VENDIDA</option>
    </select>
    <select v-model="filtros.modeloId" class="campo w-auto" aria-label="Modelo" @change="filtrar">
      <option value="">Todos los modelos</option>
      <option v-for="mo in modelos" :key="mo.id" :value="mo.id">{{ mo.marca.nombre }} {{ mo.nombre }}</option>
    </select>
    <span class="self-center text-sm text-zinc-600">{{ lista.total }} unidad(es)</span>
  </div>

  <div class="tarjeta overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="border-b border-zinc-200 text-left text-zinc-500"><tr><th class="px-4 py-2">VIN</th><th>Modelo</th><th>Año · color</th><th class="text-right">Precio</th><th class="text-right">Costo</th><th class="px-4">Estado</th><th></th></tr></thead>
      <tbody class="divide-y divide-zinc-100">
        <tr v-for="m in lista.motocicletas" :key="m.id">
          <td class="px-4 py-2 font-mono text-xs">{{ m.vin }}</td>
          <td>{{ m.modelo.marca.nombre }} {{ m.modelo.nombre }}</td>
          <td>{{ m.anio }} · {{ m.color }}</td>
          <td class="text-right">{{ formatearQuetzales(m.precio) }}</td>
          <td class="text-right text-zinc-600">{{ formatearQuetzales(m.costoAdquisicion) }}</td>
          <td class="px-4"><EtiquetaEstado :texto="m.estado" :tono="TONOS[m.estado]" /></td>
          <td class="pr-4 text-right whitespace-nowrap">
            <template v-if="m.estado !== 'VENDIDA'">
              <button type="button" class="boton-texto" @click="editar(m)">Editar</button>
              <button v-if="m.estado === 'DISPONIBLE'" type="button" class="boton-texto" @click="cambiarEstado(m, 'RESERVADA')">Reservar</button>
              <button v-else type="button" class="boton-texto" @click="cambiarEstado(m, 'DISPONIBLE')">Liberar</button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <nav v-if="paginas > 1" class="mt-4 flex items-center justify-center gap-3" aria-label="Páginas">
    <button type="button" class="boton-secundario" :disabled="filtros.pagina <= 1" @click="irA(filtros.pagina - 1)">Anterior</button>
    <span class="text-sm">Página {{ filtros.pagina }} de {{ paginas }}</span>
    <button type="button" class="boton-secundario" :disabled="filtros.pagina >= paginas" @click="irA(filtros.pagina + 1)">Siguiente</button>
  </nav>
</template>
