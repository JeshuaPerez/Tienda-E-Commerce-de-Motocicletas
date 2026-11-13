<script setup>
// Ficha de una motocicleta del catálogo (RF 02). No hay fotos en el modelo de datos, así que la
// cabecera muestra la marca y la cilindrada como identidad visual.
import { computed } from 'vue';
import { formatearQuetzales } from '../logica/formato.js';
import { agregarMoto, estaEnCarrito } from '../estado/carrito.js';

const props = defineProps({ moto: { type: Object, required: true } });
const titulo = computed(() => `${props.moto.modelo.marca.nombre} ${props.moto.modelo.nombre}`);
const enCarrito = computed(() => estaEnCarrito(props.moto.id));

const agregar = () =>
  agregarMoto({ id: props.moto.id, vin: props.moto.vin, titulo: `${titulo.value} ${props.moto.anio} · ${props.moto.color}`, precio: props.moto.precio });
</script>

<template>
  <article class="tarjeta flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
    <RouterLink :to="{ name: 'moto', params: { id: moto.id } }" class="relative block bg-gradient-to-br from-zinc-900 to-zinc-700 px-5 py-6 text-white">
      <p class="text-xs font-semibold tracking-widest text-acento-100 uppercase">{{ moto.modelo.marca.nombre }}</p>
      <p class="mt-1 text-2xl font-extrabold">{{ moto.modelo.nombre }}</p>
      <p class="mt-4 text-4xl font-black text-white/15">{{ moto.modelo.cilindrada }} cc</p>
      <span class="absolute top-4 right-4 rounded-full bg-white/10 px-2 py-0.5 text-xs">{{ moto.anio }}</span>
    </RouterLink>
    <div class="flex flex-1 flex-col gap-3 p-5">
      <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt class="text-zinc-500">Color</dt><dd class="text-right font-medium">{{ moto.color }}</dd>
        <dt class="text-zinc-500">Cilindrada</dt><dd class="text-right font-medium">{{ moto.modelo.cilindrada }} cc</dd>
      </dl>
      <p class="text-2xl font-extrabold">{{ formatearQuetzales(moto.precio) }}</p>
      <div class="mt-auto flex gap-2">
        <RouterLink :to="{ name: 'moto', params: { id: moto.id } }" class="boton-secundario flex-1">Ver detalle</RouterLink>
        <button type="button" class="boton-principal flex-1" :disabled="enCarrito" @click="agregar">
          {{ enCarrito ? 'En el carrito' : 'Agregar' }}
        </button>
      </div>
    </div>
  </article>
</template>
