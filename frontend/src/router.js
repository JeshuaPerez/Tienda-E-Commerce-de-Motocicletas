// Rutas de la tienda (fase 5). Las que tienen meta.rol exigen sesión con ese rol (RN 3 para el checkout).
import { createRouter, createWebHistory } from 'vue-router';
import { sesion } from './estado/sesion.js';

const rutas = [
  { path: '/', name: 'catalogo', component: () => import('./vistas/tienda/CatalogoVista.vue') },
  { path: '/motos/:id', name: 'moto', component: () => import('./vistas/tienda/MotoDetalleVista.vue'), props: true },
  { path: '/carrito', name: 'carrito', component: () => import('./vistas/tienda/CarritoVista.vue') },
  { path: '/checkout', name: 'checkout', component: () => import('./vistas/tienda/CheckoutVista.vue'), meta: { rol: 'CLIENTE' } },
  { path: '/ingresar', name: 'ingresar', component: () => import('./vistas/tienda/IngresarVista.vue') },
  { path: '/registro', name: 'registro', component: () => import('./vistas/tienda/RegistroVista.vue') },
  { path: '/mis-compras', name: 'mis-compras', component: () => import('./vistas/tienda/MisComprasVista.vue'), meta: { rol: 'CLIENTE' } },
  { path: '/mis-compras/:id', name: 'compra', component: () => import('./vistas/tienda/CompraDetalleVista.vue'), props: true, meta: { rol: 'CLIENTE' } },
  { path: '/facturas/:id', name: 'factura', component: () => import('./vistas/tienda/FacturaVista.vue'), props: true, meta: { requiereSesion: true } },
  { path: '/:ruta(.*)*', name: 'no-encontrada', component: () => import('./vistas/NoEncontradaVista.vue') },
];

export const router = createRouter({
  history: createWebHistory(),
  routes: rutas,
  scrollBehavior: (_a, _de, guardada) => guardada ?? { top: 0 },
});

router.beforeEach((destino) => {
  const necesitaSesion = destino.meta.rol || destino.meta.requiereSesion;
  if (necesitaSesion && !sesion.token) return { name: 'ingresar', query: { siguiente: destino.fullPath } };
  if (destino.meta.rol && sesion.usuario?.rol !== destino.meta.rol) return { name: 'catalogo' };
  return true;
});
