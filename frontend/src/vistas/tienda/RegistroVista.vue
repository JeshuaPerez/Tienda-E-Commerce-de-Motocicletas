<script setup>
// RF 01: registro público de clientes (PA-3: no crea administradores). Al terminar, la sesión queda abierta.
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { registrarse } from '../../estado/sesion.js';
import AvisoError from '../../componentes/AvisoError.vue';

const route = useRoute();
const router = useRouter();
const datos = reactive({ nombre: '', correo: '', contrasena: '' });
const error = ref(null);
const enviando = ref(false);
const destino = () => (typeof route.query.siguiente === 'string' && route.query.siguiente.startsWith('/') && !route.query.siguiente.startsWith('//') ? route.query.siguiente : '/');

async function registrar() {
  enviando.value = true;
  error.value = null;
  try {
    await registrarse({ ...datos });
    router.replace(destino());
  } catch (e) {
    error.value = e;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-md">
    <form class="tarjeta space-y-4 p-6 sm:p-8" @submit.prevent="registrar">
      <h1 class="text-2xl font-extrabold">Crear cuenta</h1>
      <div>
        <label class="etiqueta" for="nombre">Nombre completo</label>
        <input id="nombre" v-model="datos.nombre" class="campo" required maxlength="120" autocomplete="name" />
      </div>
      <div>
        <label class="etiqueta" for="correo">Correo</label>
        <input id="correo" v-model="datos.correo" class="campo" type="email" required autocomplete="email" />
      </div>
      <div>
        <label class="etiqueta" for="contrasena">Contraseña</label>
        <input id="contrasena" v-model="datos.contrasena" class="campo" type="password" required minlength="8" maxlength="72" autocomplete="new-password" />
        <p class="mt-1 text-xs text-zinc-500">Mínimo 8 caracteres.</p>
      </div>
      <AvisoError :error="error" />
      <button type="submit" class="boton-principal w-full" :disabled="enviando">{{ enviando ? 'Creando…' : 'Crear cuenta' }}</button>
      <p class="text-center text-sm text-zinc-600">
        ¿Ya tienes cuenta?
        <RouterLink :to="{ name: 'ingresar', query: route.query }" class="font-semibold text-acento-700">Ingresa</RouterLink>
      </p>
    </form>
  </div>
</template>
