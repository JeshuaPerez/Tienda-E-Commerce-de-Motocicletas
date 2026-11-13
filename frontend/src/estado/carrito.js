// Carrito reactivo (PA-10): vive en el navegador (localStorage) y no necesita sesión.
import { computed, ref, watch } from 'vue';
import * as logica from '../logica/carrito.js';

const CLAVE = 'motostore.carrito';

function leerGuardado() {
  try {
    return logica.leerCarrito(localStorage.getItem(CLAVE));
  } catch {
    return logica.carritoVacio();
  }
}

export const carrito = ref(leerGuardado());

watch(carrito, (valor) => {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento disponible: el carrito vive solo en esta pestaña.
  }
}, { deep: true });

export const cantidadEnCarrito = computed(() => logica.contarArticulos(carrito.value));
export const subtotalCarrito = computed(() => logica.subtotalEstimado(carrito.value));
export const itemsCarrito = computed(() => logica.aItems(carrito.value));
export const estaEnCarrito = (motoId) => carrito.value.motos.some((m) => m.id === motoId);

export const agregarMoto = (moto) => { carrito.value = logica.agregarMoto(carrito.value, moto); };
export const agregarAccesorio = (accesorio, cantidad = 1) => { carrito.value = logica.agregarAccesorio(carrito.value, accesorio, cantidad); };
export const cambiarCantidad = (id, cantidad) => { carrito.value = logica.cambiarCantidad(carrito.value, id, cantidad); };
export const quitarMoto = (id) => { carrito.value = logica.quitarMoto(carrito.value, id); };
export const quitarAccesorio = (id) => { carrito.value = logica.quitarAccesorio(carrito.value, id); };
export const vaciarCarrito = () => { carrito.value = logica.carritoVacio(); };
