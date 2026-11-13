<script setup>
// RF 07: proveedores locales (con NIT) e internacionales (con país).
import { onMounted, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import AvisoError from '../../componentes/AvisoError.vue';
import AvisoExito from '../../componentes/AvisoExito.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const proveedores = ref([]);
const formulario = ref(null);
const { cargando, error, mensaje, ejecutar } = usarAccion();
const vacio = () => ({ id: null, nombre: '', tipo: 'LOCAL', nit: '', pais: '', contacto: '', telefono: '', correo: '', activo: true });
const limpiar = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null));

const cargar = async () => { proveedores.value = (await panel.proveedores()).proveedores; };

async function guardar() {
  const { id, tipo, ...resto } = formulario.value;
  const ok = await ejecutar(() => (id ? panel.actualizarProveedor(id, limpiar(resto)) : panel.crearProveedor(limpiar({ tipo, ...resto, activo: undefined }))), 'Proveedor guardado.');
  if (ok) { formulario.value = null; await cargar(); }
}

onMounted(() => ejecutar(cargar));
</script>

<template>
  <TituloPanel titulo="Proveedores" descripcion="Locales e internacionales. Las órdenes de compra se registran en GTQ.">
    <button type="button" class="boton-principal" @click="formulario = vacio()">Nuevo proveedor</button>
  </TituloPanel>
  <AvisoError :error="error" class="mb-4" />
  <AvisoExito :texto="mensaje" class="mb-4" />

  <form v-if="formulario" class="tarjeta mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4" @submit.prevent="guardar">
    <div class="sm:col-span-2"><label class="etiqueta" for="p-nombre">Nombre</label><input id="p-nombre" v-model="formulario.nombre" class="campo" required maxlength="150" /></div>
    <div>
      <label class="etiqueta" for="p-tipo">Tipo</label>
      <select id="p-tipo" v-model="formulario.tipo" class="campo" :disabled="!!formulario.id"><option value="LOCAL">Local</option><option value="INTERNACIONAL">Internacional</option></select>
    </div>
    <div><label class="etiqueta" for="p-nit">{{ formulario.tipo === 'LOCAL' ? 'NIT' : 'Identificación fiscal' }}</label><input id="p-nit" v-model="formulario.nit" class="campo" maxlength="20" /></div>
    <div><label class="etiqueta" for="p-pais">País</label><input id="p-pais" v-model="formulario.pais" class="campo" maxlength="60" :required="formulario.tipo === 'INTERNACIONAL'" :placeholder="formulario.tipo === 'LOCAL' ? 'Guatemala' : ''" /></div>
    <div><label class="etiqueta" for="p-contacto">Contacto</label><input id="p-contacto" v-model="formulario.contacto" class="campo" maxlength="120" /></div>
    <div><label class="etiqueta" for="p-tel">Teléfono</label><input id="p-tel" v-model="formulario.telefono" class="campo" maxlength="30" /></div>
    <div><label class="etiqueta" for="p-correo">Correo</label><input id="p-correo" v-model="formulario.correo" class="campo" type="email" maxlength="150" /></div>
    <label v-if="formulario.id" class="flex items-center gap-2 text-sm"><input v-model="formulario.activo" type="checkbox" class="accent-acento-600" /> Activo</label>
    <div class="flex gap-2 sm:col-span-2 lg:col-span-4">
      <button type="submit" class="boton-principal" :disabled="cargando">Guardar</button>
      <button type="button" class="boton-secundario" @click="formulario = null">Cancelar</button>
    </div>
  </form>

  <div class="tarjeta overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="border-b border-zinc-200 text-left text-zinc-500"><tr><th class="px-4 py-2">Proveedor</th><th>Tipo</th><th>NIT</th><th>País</th><th>Contacto</th><th>Estado</th><th></th></tr></thead>
      <tbody class="divide-y divide-zinc-100">
        <tr v-for="p in proveedores" :key="p.id">
          <td class="px-4 py-2 font-medium">{{ p.nombre }}</td><td>{{ p.tipo }}</td><td>{{ p.nit ?? '—' }}</td><td>{{ p.pais }}</td>
          <td>{{ [p.contacto, p.telefono, p.correo].filter(Boolean).join(' · ') || '—' }}</td>
          <td><EtiquetaEstado :texto="p.activo ? 'Activo' : 'Inactivo'" :tono="p.activo ? 'verde' : 'gris'" /></td>
          <td class="pr-4 text-right"><button type="button" class="boton-texto" @click="formulario = { ...vacio(), ...p, nit: p.nit ?? '', contacto: p.contacto ?? '', telefono: p.telefono ?? '', correo: p.correo ?? '' }">Editar</button></td>
        </tr>
      </tbody>
    </table>
    <p v-if="!proveedores.length" class="p-6 text-center text-sm text-zinc-500">Aún no hay proveedores.</p>
  </div>
</template>
