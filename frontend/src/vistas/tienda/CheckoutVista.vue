<script setup>
// RF 03 + RN 3: checkout con sesión de cliente. Elige el método de pago (transferencia o POS al retirar)
// y los datos de facturación (NIT o CF). El servidor reserva las unidades al confirmar (PA-4).
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { tienda } from '../../api/tienda.js';
import { itemsCarrito, vaciarCarrito } from '../../estado/carrito.js';
import { sesion } from '../../estado/sesion.js';
import AvisoError from '../../componentes/AvisoError.vue';
import ResumenTotales from '../../componentes/ResumenTotales.vue';

const router = useRouter();
const leerCupon = () => { try { return sessionStorage.getItem('motostore.cupon') || undefined; } catch { return undefined; } };
const cuponCodigo = leerCupon();
const cotizacion = ref(null);
const error = ref(null);
const enviando = ref(false);
const datos = reactive({
  metodoPago: 'TRANSFERENCIA',
  conNit: false,
  nit: '',
  nombre: sesion.usuario?.nombre ?? '',
  direccion: '',
});

onMounted(async () => {
  if (!itemsCarrito.value.length) return router.replace({ name: 'carrito' });
  try {
    cotizacion.value = await tienda.cotizar(itemsCarrito.value, cuponCodigo);
  } catch (e) {
    error.value = e;
  }
});

async function confirmar() {
  enviando.value = true;
  error.value = null;
  try {
    const { venta } = await tienda.confirmarCompra({
      items: itemsCarrito.value,
      metodoPago: datos.metodoPago,
      cuponCodigo,
      facturacion: {
        nit: datos.conNit ? datos.nit : 'CF',
        nombre: datos.nombre || undefined,
        direccion: datos.direccion || undefined,
      },
    });
    vaciarCarrito();
    try { sessionStorage.removeItem('motostore.cupon'); } catch { /* sin almacenamiento */ }
    router.replace({ name: 'compra', params: { id: venta.id }, query: { nueva: '1' } });
  } catch (e) {
    error.value = e;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <h1 class="mb-6 text-3xl font-extrabold tracking-tight">Finalizar compra</h1>

  <form class="grid gap-6 lg:grid-cols-[1fr_22rem]" @submit.prevent="confirmar">
    <div class="space-y-6">
      <fieldset class="tarjeta space-y-3 p-5">
        <legend class="px-1 font-bold">Método de pago</legend>
        <label class="flex cursor-pointer gap-3 rounded-xl border p-4 has-[:checked]:border-acento-500 has-[:checked]:bg-acento-50">
          <input v-model="datos.metodoPago" type="radio" value="TRANSFERENCIA" class="mt-1 accent-acento-600" />
          <span>
            <span class="block font-semibold">Transferencia bancaria</span>
            <span class="text-sm text-zinc-600">Después de confirmar, sube la foto o el PDF del comprobante. Un asesor lo valida antes de entregar la moto.</span>
          </span>
        </label>
        <label class="flex cursor-pointer gap-3 rounded-xl border p-4 has-[:checked]:border-acento-500 has-[:checked]:bg-acento-50">
          <input v-model="datos.metodoPago" type="radio" value="POS_AL_RETIRAR" class="mt-1 accent-acento-600" />
          <span>
            <span class="block font-semibold">Pago con POS al retirar</span>
            <span class="text-sm text-zinc-600">Reservamos la unidad y pagas en la tienda (efectivo, tarjeta o transferencia) cuando la recojas.</span>
          </span>
        </label>
      </fieldset>

      <fieldset class="tarjeta space-y-4 p-5">
        <legend class="px-1 font-bold">Datos de facturación</legend>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="datos.conNit" type="checkbox" class="accent-acento-600" />
          Facturar con NIT (si no, se factura a consumidor final, CF)
        </label>
        <div v-if="datos.conNit">
          <label class="etiqueta" for="nit">NIT</label>
          <input id="nit" v-model="datos.nit" class="campo" required placeholder="1234567-8" autocomplete="off" />
        </div>
        <div>
          <label class="etiqueta" for="nombre">Nombre en la factura</label>
          <input id="nombre" v-model="datos.nombre" class="campo" maxlength="150" autocomplete="name" />
        </div>
        <div>
          <label class="etiqueta" for="direccion">Dirección</label>
          <input id="direccion" v-model="datos.direccion" class="campo" maxlength="250" placeholder="Ciudad" autocomplete="street-address" />
        </div>
      </fieldset>
    </div>

    <aside class="tarjeta h-fit space-y-4 p-5 lg:sticky lg:top-24">
      <h2 class="font-bold">Tu pedido</h2>
      <ul v-if="cotizacion" class="space-y-1 text-sm">
        <li v-for="l in cotizacion.lineas" :key="l.descripcion" class="flex justify-between gap-3">
          <span class="text-zinc-700">{{ l.cantidad > 1 ? `${l.cantidad} × ` : '' }}{{ l.descripcion }}</span>
        </li>
      </ul>
      <ResumenTotales v-if="cotizacion" :totales="cotizacion" />
      <AvisoError :error="error" />
      <button type="submit" class="boton-principal w-full" :disabled="!cotizacion || enviando">
        {{ enviando ? 'Confirmando…' : 'Confirmar pedido' }}
      </button>
      <RouterLink to="/carrito" class="boton-texto w-full">Volver al carrito</RouterLink>
    </aside>
  </form>
</template>
