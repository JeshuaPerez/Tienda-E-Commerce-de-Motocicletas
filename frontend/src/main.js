import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router.js';
import { validarSesion } from './estado/sesion.js';
import './estilos.css';

validarSesion();
createApp(App).use(router).mount('#app');
