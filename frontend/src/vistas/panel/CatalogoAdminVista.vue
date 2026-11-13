<script setup>
// RF 02 y PA-1: marcas, modelos (cilindrada y stock mínimo) y accesorios con SKU.
import { onMounted, reactive, ref } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import { formatearQuetzales } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import AvisoExito from '../../componentes/AvisoExito.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const marcas = ref([]);
const modelos = ref([]);
const accesorios = ref([]);
const nuevaMarca = ref('');
const modelo = reactive({ marcaId: '', nombre: '', cilindrada: '', stockMinimo: 0 });
const accesorio = reactive({ sku: '', nombre: '', precio: '', stockMinimo: 0, descripcion: '' });
const edicion = ref(null);
const { cargando, error, mensaje, ejecutar } = usarAccion();

async function cargar() {
  [marcas.value, modelos.value, accesorios.value] = await Promise.all([
    panel.marcas().then((r) => r.marcas),
    panel.modelos().then((r) => r.modelos),
    panel.accesorios().then((r) => r.accesorios),
  ]);
}

async function tras(promesa, texto, limpiar) {
  if (await ejecutar(() => promesa(), texto)) {
    limpiar?.();
    await cargar();
  }
}

const crearMarca = () => tras(() => panel.crearMarca({ nombre: nuevaMarca.value }), 'Marca creada.', () => { nuevaMarca.value = ''; });
const crearModelo = () =>
  tras(() => panel.crearModelo({ ...modelo, marcaId: Number(modelo.marcaId), cilindrada: Number(modelo.cilindrada), stockMinimo: Number(modelo.stockMinimo) }),
    'Modelo creado.', () => Object.assign(modelo, { nombre: '', cilindrada: '', stockMinimo: 0 }));
const crearAccesorio = () =>
  tras(() => panel.crearAccesorio({ ...accesorio, stockMinimo: Number(accesorio.stockMinimo), descripcion: accesorio.descripcion || undefined }),
    'Accesorio creado con stock 0. Súmalo con una compra o un ajuste.', () => Object.assign(accesorio, { sku: '', nombre: '', precio: '', stockMinimo: 0, descripcion: '' }));

function editarModelo(m) { edicion.value = { tipo: 'modelo', id: m.id, nombre: m.nombre, cilindrada: m.cilindrada, stockMinimo: m.stockMinimo }; }
function editarAccesorio(a) { edicion.value = { tipo: 'accesorio', id: a.id, nombre: a.nombre, precio: a.precio, stockMinimo: a.stockMinimo }; }

function guardarEdicion() {
  const e = edicion.value;
  const promesa = e.tipo === 'modelo'
    ? () => panel.actualizarModelo(e.id, { nombre: e.nombre, cilindrada: Number(e.cilindrada), stockMinimo: Number(e.stockMinimo) })
    : () => panel.actualizarAccesorio(e.id, { nombre: e.nombre, precio: e.precio, stockMinimo: Number(e.stockMinimo) });
  return tras(promesa, 'Cambios guardados.', () => { edicion.value = null; });
}

// Imagen del modelo (ampliación): JPG, PNG o WebP de hasta 2 MB; el servidor valida el tipo real.
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
function subirImagen(m, evento) {
  const archivo = evento.target.files?.[0];
  evento.target.value = '';
  if (!archivo) return;
  if (!TIPOS_IMAGEN.includes(archivo.type)) { error.value = { message: 'Solo se aceptan imágenes JPG, PNG o WebP.' }; return; }
  if (archivo.size > 2 * 1024 * 1024) { error.value = { message: 'La imagen supera 2 MB.' }; return; }
  return tras(() => panel.subirImagenModelo(m.id, archivo), `Imagen de ${m.marca.nombre} ${m.nombre} actualizada.`);
}
const quitarImagen = (m) => tras(() => panel.quitarImagenModelo(m.id), `Imagen de ${m.marca.nombre} ${m.nombre} quitada.`);

onMounted(() => ejecutar(cargar));
</script>

<template>
  <TituloPanel titulo="Marcas, modelos y accesorios" descripcion="El stock mínimo de cada modelo y accesorio activa las alertas del inventario." />
  <AvisoError :error="error" class="mb-4" />
  <AvisoExito :texto="mensaje" class="mb-4" />

  <form v-if="edicion" class="tarjeta mb-6 grid gap-3 p-5 sm:grid-cols-4" @submit.prevent="guardarEdicion">
    <h2 class="font-bold sm:col-span-4">Editar {{ edicion.tipo }}</h2>
    <div class="sm:col-span-2"><label class="etiqueta" for="e-nombre">Nombre</label><input id="e-nombre" v-model="edicion.nombre" class="campo" required /></div>
    <div v-if="edicion.tipo === 'modelo'"><label class="etiqueta" for="e-cc">Cilindrada</label><input id="e-cc" v-model="edicion.cilindrada" class="campo" type="number" min="1" required /></div>
    <div v-else><label class="etiqueta" for="e-precio">Precio (Q)</label><input id="e-precio" v-model="edicion.precio" class="campo" inputmode="decimal" required /></div>
    <div><label class="etiqueta" for="e-min">Stock mínimo</label><input id="e-min" v-model="edicion.stockMinimo" class="campo" type="number" min="0" required /></div>
    <div class="flex gap-2 sm:col-span-4">
      <button type="submit" class="boton-principal" :disabled="cargando">Guardar</button>
      <button type="button" class="boton-secundario" @click="edicion = null">Cancelar</button>
    </div>
  </form>

  <div class="grid gap-6 xl:grid-cols-3">
    <section class="tarjeta p-5">
      <h2 class="mb-3 font-bold">Marcas</h2>
      <ul class="mb-4 flex flex-wrap gap-2">
        <li v-for="m in marcas" :key="m.id" class="rounded-full bg-zinc-100 px-3 py-1 text-sm">{{ m.nombre }}</li>
      </ul>
      <form class="flex gap-2" @submit.prevent="crearMarca">
        <label for="n-marca" class="sr-only">Nueva marca</label>
        <input id="n-marca" v-model="nuevaMarca" class="campo" required maxlength="80" placeholder="Nueva marca" />
        <button type="submit" class="boton-principal" :disabled="cargando">Agregar</button>
      </form>
    </section>

    <section class="tarjeta p-5 xl:col-span-2">
      <h2 class="mb-3 font-bold">Modelos</h2>
      <ul class="mb-4 divide-y divide-zinc-100 text-sm">
        <li v-for="m in modelos" :key="m.id" class="flex flex-wrap items-center gap-3 py-2">
          <img v-if="m.imagenUrl" :src="m.imagenUrl" :alt="`${m.marca.nombre} ${m.nombre}`" class="h-12 w-20 rounded-md bg-zinc-100 object-contain" />
          <span v-else class="grid h-12 w-20 place-items-center rounded-md bg-zinc-100 text-xs text-zinc-400">Sin foto</span>
          <span class="flex-1">{{ m.marca.nombre }} {{ m.nombre }} · {{ m.cilindrada }} cc · mínimo {{ m.stockMinimo }}</span>
          <label class="boton-texto cursor-pointer">
            {{ m.imagenUrl ? 'Cambiar foto' : 'Subir foto' }}
            <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="subirImagen(m, $event)" />
          </label>
          <button v-if="m.imagenUrl" type="button" class="boton-texto" @click="quitarImagen(m)">Quitar foto</button>
          <button type="button" class="boton-texto" @click="editarModelo(m)">Editar</button>
        </li>
      </ul>
      <form class="grid gap-2 sm:grid-cols-[1fr_1fr_7rem_7rem_auto]" @submit.prevent="crearModelo">
        <select v-model="modelo.marcaId" class="campo" required aria-label="Marca"><option value="" disabled>Marca…</option><option v-for="m in marcas" :key="m.id" :value="m.id">{{ m.nombre }}</option></select>
        <input v-model="modelo.nombre" class="campo" required placeholder="Nombre del modelo" aria-label="Nombre del modelo" />
        <input v-model="modelo.cilindrada" class="campo" type="number" min="1" required placeholder="cc" aria-label="Cilindrada" />
        <input v-model="modelo.stockMinimo" class="campo" type="number" min="0" placeholder="Mínimo" aria-label="Stock mínimo" />
        <button type="submit" class="boton-principal" :disabled="cargando">Agregar</button>
      </form>
    </section>

    <section class="tarjeta p-5 xl:col-span-3">
      <h2 class="mb-3 font-bold">Accesorios</h2>
      <ul class="mb-4 divide-y divide-zinc-100 text-sm">
        <li v-for="a in accesorios" :key="a.id" class="flex items-center justify-between py-2">
          <span><span class="font-mono text-xs text-zinc-500">{{ a.sku }}</span> {{ a.nombre }} · {{ formatearQuetzales(a.precio) }} · stock {{ a.stock }} · mínimo {{ a.stockMinimo }}</span>
          <button type="button" class="boton-texto" @click="editarAccesorio(a)">Editar</button>
        </li>
      </ul>
      <form class="grid gap-2 sm:grid-cols-[8rem_1fr_8rem_7rem_auto]" @submit.prevent="crearAccesorio">
        <input v-model="accesorio.sku" class="campo uppercase" required maxlength="40" placeholder="SKU" aria-label="SKU" />
        <input v-model="accesorio.nombre" class="campo" required maxlength="120" placeholder="Nombre" aria-label="Nombre del accesorio" />
        <input v-model="accesorio.precio" class="campo" required inputmode="decimal" placeholder="Precio Q" aria-label="Precio" />
        <input v-model="accesorio.stockMinimo" class="campo" type="number" min="0" placeholder="Mínimo" aria-label="Stock mínimo" />
        <button type="submit" class="boton-principal" :disabled="cargando">Agregar</button>
      </form>
    </section>
  </div>
</template>
