<script setup>
// RF 01: inicio de sesión. Vuelve a la página que pidió la sesión (por ejemplo, el checkout).
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { iniciarSesion } from '../../estado/sesion.js';
import AvisoError from '../../componentes/AvisoError.vue';

const route = useRoute();
const router = useRouter();
const correo = ref('');
const contrasena = ref('');
const error = ref(null);
const enviando = ref(false);

// Solo se acepta volver a rutas internas, para no redirigir a otro sitio.
const destino = () => (typeof route.query.siguiente === 'string' && route.query.siguiente.startsWith('/') && !route.query.siguiente.startsWith('//') ? route.query.siguiente : '/');

async function ingresar() {
  enviando.value = true;
  error.value = null;
  try {
    const usuario = await iniciarSesion(correo.value, contrasena.value);
    const sinDestino = destino() === '/';
    router.replace(usuario.rol === 'ADMINISTRADOR' && sinDestino ? '/panel' : destino());
  } catch (e) {
    error.value = e;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-md">
    <form class="tarjeta space-y-4 p-6 sm:p-8" @submit.prevent="ingresar">
      <h1 class="text-2xl font-extrabold">Ingresar</h1>
      <p v-if="route.query.siguiente === '/checkout'" class="rounded-lg bg-acento-50 p-3 text-sm text-acento-700">
        Inicia sesión para pagar. Tu carrito se mantiene.
      </p>
      <div>
        <label class="etiqueta" for="correo">Correo</label>
        <input id="correo" v-model="correo" class="campo" type="email" required autocomplete="email" />
      </div>
      <div>
        <label class="etiqueta" for="contrasena">Contraseña</label>
        <input id="contrasena" v-model="contrasena" class="campo" type="password" required autocomplete="current-password" />
      </div>
      <AvisoError :error="error" />
      <button type="submit" class="boton-principal w-full" :disabled="enviando">{{ enviando ? 'Ingresando…' : 'Ingresar' }}</button>
      <p class="text-center text-sm text-zinc-600">
        ¿No tienes cuenta?
        <RouterLink :to="{ name: 'registro', query: route.query }" class="font-semibold text-acento-700">Crea una</RouterLink>
      </p>
    </form>
  </div>
</template>
