// Rutas de la tienda (fase 5) y del panel (fase 6). meta.rol exige sesión con ese rol; Vue Router
// combina la meta de la ruta padre, así que todo /panel exige ADMINISTRADOR.
import { createRouter, createWebHistory } from 'vue-router';
import { sesion } from './estado/sesion.js';

const tienda = (vista) => () => import(`./vistas/tienda/${vista}.vue`);
const panel = (vista) => () => import(`./vistas/panel/${vista}.vue`);

const rutas = [
  {
    path: '/',
    component: () => import('./layouts/TiendaLayout.vue'),
    children: [
      { path: '', name: 'catalogo', component: tienda('CatalogoVista') },
      { path: 'motos/:id', name: 'moto', component: tienda('MotoDetalleVista'), props: true },
      { path: 'carrito', name: 'carrito', component: tienda('CarritoVista') },
      { path: 'checkout', name: 'checkout', component: tienda('CheckoutVista'), meta: { rol: 'CLIENTE' } },
      { path: 'ingresar', name: 'ingresar', component: tienda('IngresarVista') },
      { path: 'registro', name: 'registro', component: tienda('RegistroVista') },
      { path: 'mis-compras', name: 'mis-compras', component: tienda('MisComprasVista'), meta: { rol: 'CLIENTE' } },
      { path: 'mis-compras/:id', name: 'compra', component: tienda('CompraDetalleVista'), props: true, meta: { rol: 'CLIENTE' } },
      { path: 'facturas/:id', name: 'factura', component: tienda('FacturaVista'), props: true, meta: { requiereSesion: true } },
    ],
  },
  {
    path: '/panel',
    component: () => import('./layouts/PanelLayout.vue'),
    meta: { rol: 'ADMINISTRADOR' },
    children: [
      { path: '', name: 'panel', component: panel('TableroVista') },
      { path: 'pos', name: 'panel-pos', component: panel('PosVista') },
      { path: 'caja', name: 'panel-caja', component: panel('CajaVista') },
      { path: 'ventas', name: 'panel-ventas', component: panel('VentasVista') },
      { path: 'ventas/:id', name: 'panel-venta', component: panel('VentaDetalleVista'), props: true },
      { path: 'transferencias', name: 'panel-transferencias', component: panel('TransferenciasVista') },
      { path: 'cupones', name: 'panel-cupones', component: panel('CuponesVista') },
      { path: 'facturas', name: 'panel-facturas', component: panel('FacturasVista') },
      { path: 'facturas/:id', name: 'panel-factura', component: tienda('FacturaVista'), props: true },
      { path: 'inventario', name: 'panel-inventario', component: panel('InventarioVista') },
      { path: 'motocicletas', name: 'panel-motocicletas', component: panel('MotocicletasVista') },
      { path: 'catalogo', name: 'panel-catalogo', component: panel('CatalogoAdminVista') },
      { path: 'compras', name: 'panel-compras', component: panel('ComprasVista') },
      { path: 'compras/:id', name: 'panel-orden', component: panel('OrdenDetalleVista'), props: true },
      { path: 'proveedores', name: 'panel-proveedores', component: panel('ProveedoresVista') },
      { path: 'reportes', name: 'panel-reportes', component: panel('ReportesVista') },
      { path: 'usuarios', name: 'panel-usuarios', component: panel('UsuariosVista') },
    ],
  },
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
  if (destino.meta.rol && sesion.usuario?.rol !== destino.meta.rol) {
    return sesion.usuario?.rol === 'ADMINISTRADOR' ? { name: 'panel' } : { name: 'catalogo' };
  }
  return true;
});
