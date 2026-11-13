<script setup>
// RF 01 y PA-3: solo un administrador puede crear otra cuenta de administrador (el registro público crea clientes).
import { reactive } from 'vue';
import { panel } from '../../api/panel.js';
import { usarAccion } from '../../estado/accion.js';
import AvisoError from '../../componentes/AvisoError.vue';
import AvisoExito from '../../componentes/AvisoExito.vue';
import TituloPanel from '../../componentes/TituloPanel.vue';

const datos = reactive({ nombre: '', correo: '', contrasena: '' });
const { cargando, error, mensaje, ejecutar } = usarAccion();

async function crear() {
  const r = await ejecutar(() => panel.crearAdministrador({ ...datos }), '');
  if (r) {
    mensaje.value = `Administrador ${r.usuario.correo} creado. Comparte la contraseña por un medio seguro.`;
    Object.assign(datos, { nombre: '', correo: '', contrasena: '' });
  }
}
</script>

<template>
  <TituloPanel titulo="Administradores" descripcion="Personal del concesionario con acceso al panel. Quien registra una venta en el POS queda como vendedor." />
  <AvisoError :error="error" class="mb-4" />
  <AvisoExito :texto="mensaje" class="mb-4" />
  <form class="tarjeta max-w-lg space-y-4 p-5" @submit.prevent="crear">
    <h2 class="font-bold">Nuevo administrador</h2>
    <div><label class="etiqueta" for="u-nombre">Nombre</label><input id="u-nombre" v-model="datos.nombre" class="campo" required maxlength="120" autocomplete="off" /></div>
    <div><label class="etiqueta" for="u-correo">Correo</label><input id="u-correo" v-model="datos.correo" class="campo" type="email" required autocomplete="off" /></div>
    <div><label class="etiqueta" for="u-clave">Contraseña inicial</label><input id="u-clave" v-model="datos.contrasena" class="campo" type="password" required minlength="8" maxlength="72" autocomplete="new-password" /></div>
    <button type="submit" class="boton-principal" :disabled="cargando">Crear administrador</button>
  </form>
</template>
