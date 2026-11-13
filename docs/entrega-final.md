# MotoStore GT · Verificación final contra el enunciado

Autor: JeshuaPerez · Fecha: 2026-11-13

Resultado de las pruebas al cierre, con PostgreSQL 17 real:

| Suite | Resultado |
|---|---|
| Backend (`backend/`, `npm test`): unitarias, HTTP e integración con PostgreSQL | 227 de 227 |
| Frontend (`frontend/`, `npm test`): lógica de montos, carrito, cliente de la API y panel | 27 de 27 |
| `vite build` del frontend | Sin errores |
| `npm audit` en backend y frontend | 0 vulnerabilidades |

Además se recorrieron a mano la tienda y el panel en el navegador (ver "Qué no se probó" para los límites de ese recorrido).

## Requerimientos funcionales

| RF | Estado | Evidencia (prueba · endpoint · pantalla) |
|---|---|---|
| RF 01 Autenticación y registro | Cumplido | `auth.servicio.test.js`, `auth.http.test.js`, `auth.bd.test.js` (correo único aun con registros simultáneos, bcrypt, JWT, 401/403 por rol) · `POST /api/auth/registro`, `/login`, `GET /perfil`, `POST /api/usuarios` · Ingresar, Registro, Panel > Administradores |
| RF 02 Catálogo de motocicletas | Cumplido | `catalogo.servicio.test.js`, `fase2.http.test.js`, `fase2.bd.test.js` · `/api/marcas`, `/api/modelos`, `/api/motocicletas` (filtros), `PATCH /api/motocicletas/:id/estado`, `/api/accesorios` · Catálogo y detalle; Panel > Motocicletas y Marcas/modelos/accesorios |
| RF 03 Carrito y checkout | Cumplido | `ventas-web.test.js`, `cupones-impuestos.test.js`, `fase3.http.test.js` · `POST /api/checkout/cotizar`, `POST /api/checkout`, `POST /api/ventas/:id/comprobante` · Carrito, Checkout, Mis compras |
| RF 04 Punto de venta | Cumplido | `pos.test.js`, `fase3.bd.test.js` (venta POS con base real) · `POST /api/pos/ventas`, `GET /api/pos/clientes` · Panel > Punto de venta |
| RF 05 Control de caja | Cumplido | `caja.test.js`, `fase3.bd.test.js` (una sola caja abierta) · `/api/caja/apertura`, `/actual`, `/retiros`, `/cierre`, `/sesiones` · Panel > Caja |
| RF 06 Inventario | Cumplido | `inventario.servicio.test.js`, `fase2.bd.test.js` · `/api/inventario/resumen`, `/alertas`, `/motocicletas`, `/movimientos`, `/ajustes` · Panel > Inventario y Tablero |
| RF 07 Proveedores y compras | Cumplido | `compras.servicio.test.js`, `fase2.bd.test.js` (recepción todo o nada, recepciones simultáneas) · `/api/proveedores`, `/api/ordenes-compra`, `/:id/estado`, `/:id/recepciones` · Panel > Proveedores y Compras |
| RF 08 Facturación | Cumplido | `facturacion.test.js`, `fase4.http.test.js`, `fase4.bd.test.js` (correlativo sin duplicados) · emisión automática al pagar, `/api/facturas`, `/api/mis-facturas`, `/:id/anular` · Factura imprimible, Panel > Facturación |
| RF 09 Cupones | Cumplido | `cupones-impuestos.test.js`, `pos.test.js`, `fase3.bd.test.js` (uso único concurrente) · `/api/cupones` · Panel > Cupones; campo de cupón en carrito y POS |
| RF 10 Reportes | Cumplido | `reportes.test.js`, `fase4.http.test.js`, `fase4.bd.test.js` · `/api/reportes/ventas`, `/mas-vendidas`, `/flujo-caja`, `/rendimiento` · Panel > Reportes |

## Reglas de negocio

| Regla | Estado | Evidencia |
|---|---|---|
| 1. VIN único e irrepetible | Cumplida | Índice único en `motocicletas.vin`; `catalogo.servicio.test.js`, `compras.servicio.test.js`, `fase2.bd.test.js` (la base rechaza el duplicado aunque se salte el servicio) |
| 2. Solo se vende lo Disponible | Cumplida | `SELECT … FOR UPDATE` sobre la moto; `ventas-web.test.js`, `pos.test.js`, `fase3.bd.test.js` (dos compras web simultáneas y web contra POS: solo una pasa) |
| 3. Checkout con sesión | Cumplida | `fase3.http.test.js` (sin token 401, administrador 403); la ruta `/checkout` de la tienda redirige al ingreso |
| 4. Transferencia validada antes de despachar | Cumplida | `ventas-web.test.js`, `fase3.http.test.js`: despachar sin aprobación responde 409 |
| 5. POS bloqueado con la caja cerrada | Cumplida | `pos.test.js`, `caja.test.js` (también una caja abierta de otro día) · el POS desactiva la venta y muestra el aviso |
| 6. Precios en GTQ | Cumplida | Columnas `NUMERIC(12,2)` y `Prisma.Decimal`; `rn6-gtq.test.js`, totales exactos en compras, ventas e IVA; centavos enteros en el frontend (`formato.test.js`) |
| 7. Credenciales en `.env` | Cumplida | `rn7-config.test.js` (el arranque falla sin las variables obligatorias); `.env` ignorado por git; el historial completo se revisó y no contiene ningún `.env` ni los secretos reales |

## Pull Requests

| PR | Estado |
|---|---|
| [#1 Fase 1: base del backend y autenticación](https://github.com/JeshuaPerez/Tienda-E-Commerce-de-Motocicletas/pull/1) | Fusionado en `dev` |
| [#2 Fase 2: catálogo, inventario y compras](https://github.com/JeshuaPerez/Tienda-E-Commerce-de-Motocicletas/pull/2) | Fusionado en `dev` |
| [#3 Fase 3: ventas, caja, POS y cupones](https://github.com/JeshuaPerez/Tienda-E-Commerce-de-Motocicletas/pull/3) | Fusionado en `dev` |
| [#4 Fase 4: facturación interna y reportes](https://github.com/JeshuaPerez/Tienda-E-Commerce-de-Motocicletas/pull/4) | Fusionado en `dev` |
| [#5 Fase 5: frontend de la tienda](https://github.com/JeshuaPerez/Tienda-E-Commerce-de-Motocicletas/pull/5) | Fusionado en `dev` |
| [#6 Fase 6: panel de administración y corrección del POS](https://github.com/JeshuaPerez/Tienda-E-Commerce-de-Motocicletas/pull/6) | Fusionado en `dev` |

La fase 7 (este cierre) y el paso de `dev` a `main` se publican con sus propios PR.

## Instalación desde cero

Ver el [README](../README.md): crear el rol y las bases de PostgreSQL, configurar `backend/.env`, migrar, correr el seed y levantar backend y frontend.

## Qué no se probó

- **Navegadores:** el recorrido manual se hizo solo en Chromium (navegador integrado). No se probó en Safari ni en Firefox.
- **Archivos reales del explorador:** al subir comprobantes, el archivo se inyectó por JavaScript en el campo de archivo; el envío y la validación en el servidor sí fueron reales.
- **Interacción del panel con la ventana minimizada:** en la última revisión del panel, varios clics se ejecutaron disparando los mismos eventos del formulario por JavaScript, porque la ventana del navegador no dibujaba la página.
- **Compras y transferencias en pantalla contra PostgreSQL:** se recorrieron en pantalla con la base en memoria; contra la base real las cubren las pruebas de integración.
- **Siete respuestas 500 en la consola del navegador** durante la revisión del panel que no se pudieron rastrear (el navegador ya no guardaba esas peticiones). Lo más probable es que ocurrieran mientras se reiniciaba la API (el proxy de Vite responde 500 si no hay API). Al repetir las 27 consultas del panel todas respondieron 200 y la API no registró errores.
- **Despliegue en un servidor:** el enunciado no lo pide; solo se probó en local.
- **Carga y rendimiento:** no se hicieron pruebas de volumen.

## Puntos abiertos y decisión tomada

| Punto | Decisión |
|---|---|
| PA-1 Accesorios | Entidad aparte con SKU único, precio en GTQ, stock por cantidad y stock mínimo; se compran a proveedores |
| PA-2 Vendedor | Es el administrador autenticado que registra la venta; no hay rol nuevo |
| PA-3 Registro de administradores | El registro público solo crea clientes; el primer administrador sale del seed y los demás los crea un administrador |
| PA-4 Estado "Reservada" | Un pedido web reserva la moto; se libera si se rechaza la transferencia o se cancela el pedido; la reserva no vence sola |
| PA-5 Pagos en mostrador | Efectivo, tarjeta con número de voucher y transferencia con referencia |
| PA-6 Impuestos | IVA del 12 % incluido en el precio publicado; base = total / 1.12 |
| PA-7 Facturación | Factura interna (no FEL) con NIT o CF, nombre, dirección, serie y correlativo; emisión aislada en `backend/src/modulos/facturacion/emisor-interno.js`; sin integración con la SAT |
| PA-8 Comprobantes | Carpeta local fuera de git, máximo 5 MB, JPG, PNG o PDF validados por su firma real |
| PA-9 Tiempo real | Consistencia transaccional con bloqueo de fila; sin WebSockets |
| PA-10 Carrito sin sesión | Vive en el navegador; el checkout exige sesión y el servidor revalida todo |
| PA-11 Compras internacionales | Las órdenes de compra se registran en GTQ |
| PA-12 Cupones | Cada cupón indica su canal: web, mostrador o ambos |

Otras decisiones técnicas por fase están en [`docs/plan.md`](plan.md).

## Autoría y secretos

- Todos los commits del repositorio (37 en todas las ramas al cerrar la fase 6, más los de este cierre) tienen como autor a Jeshua Perez; los de fusión los registra GitHub como committer. Ningún mensaje ni archivo versionado contiene firmas o referencias a herramientas de IA.
- Nunca se versionó un archivo `.env`, comprobantes subidos, bases de datos ni `node_modules`. Se buscaron en todo el historial el secreto JWT, la clave de la base y la clave del administrador reales: no aparecen en ningún commit. Las únicas URLs con credenciales en el código son valores ficticios de prueba (`usuario:clave`, `sin-base:sin-base`).
