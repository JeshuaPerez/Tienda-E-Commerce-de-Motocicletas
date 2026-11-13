<script setup>
// RF 03 y PA-10: carrito sin sesión. El servidor recalcula precios, cupón e IVA (cotización);
// para pagar se pide iniciar sesión (RN 3).
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { tienda } from '../../api/tienda.js';
import { carrito, cambiarCantidad, itemsCarrito, quitarAccesorio, quitarMoto } from '../../estado/carrito.js';
import { esAdministrador, sesion } from '../../estado/sesion.js';
import { formatearQuetzales } from '../../logica/formato.js';
import AvisoError from '../../componentes/AvisoError.vue';
import ResumenTotales from '../../componentes/ResumenTotales.vue';

const router = useRouter();
const cotizacion = ref(null);
const error = ref(null);
const leerCupon = () => { try { return sessionStorage.getItem('motostore.cupon') ?? ''; } catch { return ''; } };
const cupon = ref(leerCupon());
const cuponAplicado = ref(cupon.value);
const cotizando = ref(false);

async function cotizar() {
  error.value = null;
  if (!itemsCarrito.value.length) { cotizacion.value = null; return; }
  cotizando.value = true;
  try {
    cotizacion.value = await tienda.cotizar(itemsCarrito.value, cuponAplicado.value);
  } catch (e) {
    error.value = e;
    cotizacion.value = null;
  } finally {
    cotizando.value = false;
  }
}

function aplicarCupon() {
  cuponAplicado.value = cupon.value.trim();
  try { sessionStorage.setItem('motostore.cupon', cuponAplicado.value); } catch { /* sin almacenamiento */ }
  cotizar();
}

function quitarCupon() {
  cupon.value = '';
  aplicarCupon();
}

function pagar() {
  if (!sesion.token) router.push({ name: 'ingresar', query: { siguiente: '/checkout' } });
  else router.push({ name: 'checkout' });
}

watch(itemsCarrito, cotizar, { deep: true });
onMounted(cotizar);
</script>

<template>
  <h1 class="mb-6 text-3xl font-extrabold tracking-tight">Tu carrito</h1>

  <div v-if="!itemsCarrito.length" class="tarjeta p-10 text-center">
    <p class="text-zinc-600">Tu carrito está vacío.</p>
    <RouterLink to="/" class="boton-principal mt-4">Ver motocicletas</RouterLink>
  </div>

  <div v-else class="grid gap-6 lg:grid-cols-[1fr_22rem]">
    <section class="space-y-3" aria-label="Artículos">
      <article v-for="m in carrito.motos" :key="`m${m.id}`" class="tarjeta flex items-center justify-between gap-4 p-4">
        <div class="min-w-0">
          <RouterLink :to="{ name: 'moto', params: { id: m.id } }" class="font-bold hover:text-acento-700">{{ m.titulo }}</RouterLink>
          <p class="truncate font-mono text-xs text-zinc-500">VIN {{ m.vin }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <span class="font-semibold">{{ formatearQuetzales(m.precio) }}</span>
          <button type="button" class="boton-texto" :aria-label="`Quitar ${m.titulo}`" @click="quitarMoto(m.id)">Quitar</button>
        </div>
      </article>

      <article v-for="a in carrito.accesorios" :key="`a${a.id}`" class="tarjeta flex flex-wrap items-center justify-between gap-4 p-4">
        <div>
          <p class="font-bold">{{ a.nombre }}</p>
          <p class="text-xs text-zinc-500">{{ a.sku }} · {{ formatearQuetzales(a.precio) }} c/u</p>
        </div>
        <div class="flex items-center gap-3">
          <label class="sr-only" :for="`cant-${a.id}`">Cantidad</label>
          <input :id="`cant-${a.id}`" class="campo w-20" type="number" min="0" :max="a.stock" :value="a.cantidad"
                 @change="cambiarCantidad(a.id, Number($event.target.value))" />
          <button type="button" class="boton-texto" @click="quitarAccesorio(a.id)">Quitar</button>
        </div>
      </article>
    </section>

    <aside class="tarjeta h-fit space-y-4 p-5 lg:sticky lg:top-24">
      <h2 class="font-bold">Resumen</h2>
      <AvisoError :error="error" />
      <ResumenTotales v-if="cotizacion" :totales="cotizacion" :class="{ 'opacity-60': cotizando }" />
      <p v-else-if="cotizando" class="text-sm text-zinc-500">Calculando…</p>

      <form class="flex gap-2" @submit.prevent="aplicarCupon">
        <label for="cupon" class="sr-only">Cupón de descuento</label>
        <input id="cupon" v-model="cupon" class="campo uppercase" placeholder="Cupón de descuento" autocomplete="off" />
        <button type="submit" class="boton-secundario">Aplicar</button>
      </form>
      <button v-if="cuponAplicado" type="button" class="boton-texto -mt-2 text-xs" @click="quitarCupon">Quitar cupón</button>

      <p v-if="esAdministrador" class="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        Las compras de la tienda son para cuentas de cliente. Como administrador, registra la venta en el POS del panel.
      </p>
      <button type="button" class="boton-principal w-full" :disabled="!cotizacion || esAdministrador" @click="pagar">
        {{ sesion.token ? 'Continuar al pago' : 'Ingresar para pagar' }}
      </button>
      <p class="text-xs text-zinc-500">El precio y la disponibilidad se confirman al pagar.</p>
    </aside>
  </div>
</template>
