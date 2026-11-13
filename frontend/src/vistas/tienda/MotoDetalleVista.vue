<script setup>
// RF 02: ficha completa de una unidad (VIN, año, color, cilindrada, precio, descripción y ficha técnica).
import { computed, onMounted, ref } from 'vue';
import { tienda } from '../../api/tienda.js';
import { agregarMoto, estaEnCarrito } from '../../estado/carrito.js';
import { formatearQuetzales } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import EtiquetaEstado from '../../componentes/EtiquetaEstado.vue';

const props = defineProps({ id: { type: String, required: true } });
const moto = ref(null);
const error = ref(null);
const titulo = computed(() => moto.value && `${moto.value.modelo.marca.nombre} ${moto.value.modelo.nombre}`);
const disponible = computed(() => moto.value?.estado === 'DISPONIBLE');
const ficha = computed(() => Object.entries(moto.value?.fichaTecnica ?? {}));

onMounted(async () => {
  try {
    moto.value = (await tienda.obtenerMoto(props.id)).motocicleta;
  } catch (e) {
    error.value = e;
  }
});

const agregar = () =>
  agregarMoto({ id: moto.value.id, vin: moto.value.vin, titulo: `${titulo.value} ${moto.value.anio} · ${moto.value.color}`, precio: moto.value.precio });
</script>

<template>
  <RouterLink to="/" class="boton-texto mb-4 -ml-2">← Volver al catálogo</RouterLink>
  <AvisoError :error="error" />

  <article v-if="moto" class="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
    <div v-if="moto.modelo.imagenUrl" class="overflow-hidden rounded-3xl border border-zinc-200 bg-white">
      <img :src="moto.modelo.imagenUrl" :alt="`${titulo} ${moto.anio}`" class="aspect-[4/3] w-full bg-zinc-100 object-contain p-4" />
      <div class="px-6 py-5">
        <p class="text-sm font-semibold tracking-widest text-acento-700 uppercase">{{ moto.modelo.marca.nombre }}</p>
        <h1 class="mt-1 text-3xl font-black sm:text-4xl">{{ moto.modelo.nombre }} <span class="text-zinc-400">· {{ moto.modelo.cilindrada }} cc</span></h1>
      </div>
    </div>
    <div v-else class="rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-700 p-8 text-white sm:p-10">
      <p class="text-sm font-semibold tracking-widest text-acento-100 uppercase">{{ moto.modelo.marca.nombre }}</p>
      <h1 class="mt-1 text-4xl font-black sm:text-5xl">{{ moto.modelo.nombre }}</h1>
      <p class="mt-10 text-6xl font-black text-white/15 sm:text-7xl">{{ moto.modelo.cilindrada }} cc</p>
    </div>

    <div class="tarjeta flex flex-col gap-5 p-6">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm text-zinc-500">{{ moto.anio }} · {{ moto.color }}</p>
          <p class="mt-1 text-3xl font-extrabold">{{ formatearQuetzales(moto.precio) }}</p>
          <p class="text-xs text-zinc-500">IVA incluido</p>
        </div>
        <EtiquetaEstado :texto="disponible ? 'Disponible' : 'No disponible'" :tono="disponible ? 'verde' : 'gris'" />
      </div>

      <dl class="grid grid-cols-2 gap-y-2 border-y border-zinc-100 py-4 text-sm">
        <dt class="text-zinc-500">Número de chasis (VIN)</dt><dd class="text-right font-mono text-xs sm:text-sm">{{ moto.vin }}</dd>
        <dt class="text-zinc-500">Cilindrada</dt><dd class="text-right font-medium">{{ moto.modelo.cilindrada }} cc</dd>
        <dt class="text-zinc-500">Año</dt><dd class="text-right font-medium">{{ moto.anio }}</dd>
        <dt class="text-zinc-500">Color</dt><dd class="text-right font-medium">{{ moto.color }}</dd>
      </dl>

      <p v-if="moto.descripcion" class="text-zinc-700">{{ moto.descripcion }}</p>

      <section v-if="ficha.length">
        <h2 class="mb-2 font-bold">Ficha técnica</h2>
        <dl class="grid grid-cols-2 gap-y-1 text-sm">
          <template v-for="[clave, valor] in ficha" :key="clave">
            <dt class="text-zinc-500 capitalize">{{ clave }}</dt><dd class="text-right">{{ valor }}</dd>
          </template>
        </dl>
      </section>

      <div class="mt-auto flex flex-col gap-2 sm:flex-row">
        <button type="button" class="boton-principal flex-1" :disabled="!disponible || estaEnCarrito(moto.id)" @click="agregar">
          {{ estaEnCarrito(moto.id) ? 'Ya está en tu carrito' : 'Agregar al carrito' }}
        </button>
        <RouterLink v-if="estaEnCarrito(moto.id)" to="/carrito" class="boton-secundario flex-1">Ir al carrito</RouterLink>
      </div>
    </div>
  </article>
</template>
