# MotoStore GT · Plan de trabajo

Autor: JeshuaPerez · Aprobado el 2026-11-13.

Las marcas **(PA-n)** señalan puntos abiertos del enunciado. Lo escrito junto a ellas es una propuesta y se confirma antes de la fase que lo usa.

## 1. Trazabilidad

| RF / regla | Módulo | Endpoints principales | Entidades | Pantalla | Prueba (node:test) |
|---|---|---|---|---|---|
| RF 01 Autenticación | `auth` | `POST /api/auth/registro` (solo clientes, PA-3) · `POST /api/auth/login` · `GET /api/auth/perfil` · `POST /api/usuarios` (un admin crea admins) | Usuario | Registro, Login (tienda) · Usuarios (panel) | `auth.test.js`: correo duplicado rechazado, contraseña con bcrypt, JWT válido, rol incorrecto → 403 |
| RF 02 Catálogo | `catalogo` | `GET/POST/PUT /api/marcas` · `/api/modelos` · `GET /api/motocicletas?marca&cilindradaMin&cilindradaMax&precioMin&precioMax` · `GET /api/motocicletas/:id` · `POST/PUT /api/motocicletas` · `PATCH /api/motocicletas/:id/estado` · `GET/POST/PUT /api/accesorios` (PA-1) | Marca, Modelo, Motocicleta, Accesorio | Catálogo y detalle (tienda) · Motocicletas y accesorios (panel) | `catalogo.servicio.test.js`, `fase2.http.test.js`: filtros, estados, accesorios |
| RF 03 Carrito y checkout | `ventas` | `POST /api/checkout/cotizar` · `POST /api/checkout` · `POST /api/ventas/:id/comprobante` | Venta, VentaDetalle, ComprobanteTransferencia, Accesorio (PA-1) | Carrito, Checkout | `checkout.test.js`: totales con Decimal, IVA (PA-6), cupón aplicado |
| RF 04 POS | `pos` | `POST /api/pos/ventas` | Venta (canal POS), VentaDetalle, Cliente | POS (panel) | `pos.test.js`: venta con cliente, vendedor (PA-2), moto y método de pago (PA-5) |
| RF 05 Caja | `caja` | `POST /api/caja/apertura` · `POST /api/caja/cierre` · `GET /api/caja/actual` · `POST /api/caja/retiros` · `GET /api/caja/:id/cuadre` | SesionCaja, MovimientoCaja | Caja (panel) | `caja.test.js`: una sola caja abierta, cuadre = inicial + ingresos − retiros |
| RF 06 Inventario | `inventario` | `GET /api/inventario/resumen` · `GET /api/inventario/alertas` · `GET /api/inventario/motocicletas` · `GET /api/inventario/movimientos` · `POST /api/inventario/ajustes` | MovimientoInventario, Modelo.stockMinimo, Accesorio.stockMinimo | Inventario (panel) | `inventario.servicio.test.js`: alerta si disponibles ≤ mínimo (mínimo 0 = sin alerta), ajustes sin stock negativo |
| RF 07 Proveedores y compras | `compras` | `GET/POST/PUT /api/proveedores` · `GET/POST /api/ordenes-compra` · `PATCH /api/ordenes-compra/:id/estado` · `POST /api/ordenes-compra/:id/recepciones` | Proveedor, OrdenCompra, OrdenCompraDetalle, Recepcion | Proveedores, Órdenes de compra (panel) | `compras.servicio.test.js`, `fase2.bd.test.js`: la recepción crea motos Disponibles y su ENTRADA, no supera lo pedido y es todo o nada |
| RF 08 Facturación | `facturacion` | `POST /api/facturas` · `GET /api/facturas/:id` · `GET /api/mis-facturas` · `PATCH /api/facturas/:id/anular` | Factura, FacturaLinea | Mis compras/facturas (tienda) · Facturación (panel) | `facturacion.test.js`: NIT válido o "CF", correlativo único, una factura por venta |
| RF 09 Cupones | `cupones` | `CRUD /api/cupones` · `POST /api/cupones/validar` | Cupon | Cupones (panel), campo en checkout | `cupones.test.js`: porcentaje, monto fijo, vencido, límite de usos, canal (PA-12) |
| RF 10 Reportes | `reportes` | `GET /api/reportes/ventas?desde&hasta` · `/mas-vendidas` · `/flujo-caja` · `/rendimiento` | Venta, MovimientoCaja, Motocicleta.costoAdquisicion | Reportes (panel) | `reportes.test.js`: sumas por período con datos conocidos |
| RN 1 VIN único | `catalogo`, `compras` | `POST /api/motocicletas`, recepciones | Motocicleta.vin `UNIQUE` | — | `catalogo.servicio.test.js`, `compras.servicio.test.js`, `fase2.bd.test.js`: VIN repetido → 409 |
| RN 2 Solo se vende si está Disponible | `ventas`, `pos` | checkout, `POST /api/pos/ventas` | Motocicleta.estado + bloqueo de fila | — | `rn2-disponible.test.js`: reservada o vendida → 409; dos ventas simultáneas del mismo VIN → solo una pasa |
| RN 3 Checkout exige sesión | `auth` | `POST /api/checkout` | — | Checkout redirige al login | `rn3-checkout-sesion.test.js`: sin token → 401 |
| RN 4 Transferencia validada antes de despachar | `ventas` | `PATCH /api/comprobantes/:id/aprobar` · `/rechazar` · `PATCH /api/ventas/:id/entregar` | ComprobanteTransferencia | Validación de transferencias (panel) | `rn4-transferencia.test.js`: entregar sin aprobación → 409 |
| RN 5 POS exige caja abierta | `pos` | `POST /api/pos/ventas` | SesionCaja | POS bloqueado con caja cerrada | `rn5-caja-abierta.test.js`: caja cerrada → 409 |
| RN 6 Precios en GTQ | todos | — | Columnas `NUMERIC(12,2)` | Formato `Q 1,234.56` | `rn6-gtq.test.js`: montos Decimal sin error de redondeo |
| RN 7 Secretos en .env | `config` | — | — | — | `rn7-config.test.js`: el arranque falla si falta `JWT_SECRET` o `DATABASE_URL` |

## 2. Modelo de datos

Montos: `Decimal @db.Decimal(12,2)` en GTQ. Estados: `enum` de Prisma.

| Entidad | Campos clave | Relaciones | Índices / restricciones |
|---|---|---|---|
| Usuario | correo, hashContrasena, nombre, rol (`CLIENTE`, `ADMINISTRADOR`), activo | 1–0..1 Cliente | `correo UNIQUE` |
| Cliente | nombre, nit, direccion, telefono, usuarioId? | Puede no tener cuenta (mostrador) | índice `nit` · `usuarioId UNIQUE` |
| Marca | nombre | 1–N Modelo | `nombre UNIQUE` |
| Modelo | nombre, cilindrada, stockMinimo | N–1 Marca, 1–N Motocicleta | `UNIQUE(marcaId, nombre)` · índice `cilindrada` |
| Motocicleta | vin, anio, color, precio, costoAdquisicion, descripcion, fichaTecnica (Json), estado (`DISPONIBLE`, `RESERVADA`, `VENDIDA`) | N–1 Modelo, N–0..1 Recepcion | `vin UNIQUE` · índices `estado`, `precio`, `modeloId` |
| Accesorio (PA-1) | sku, nombre, precio, stock, stockMinimo | — | `sku UNIQUE` · `CHECK stock >= 0` |
| MovimientoInventario | tipo (`ENTRADA`, `SALIDA`), motivo, cantidad, referencia | → Motocicleta o Accesorio, → Usuario | índice `fecha` |
| Proveedor | nombre, tipo (`LOCAL`, `INTERNACIONAL`), nit, pais, contacto | 1–N OrdenCompra | índice `nit` |
| OrdenCompra | estado, total (GTQ, PA-11) | N–1 Proveedor, 1–N detalle, 1–N Recepcion | índice `estado` |
| OrdenCompraDetalle | modeloId o accesorioId, cantidad, cantidadRecibida, costoUnitario | — | `CHECK cantidadRecibida <= cantidad` |
| Recepcion | fecha, usuarioId | Crea Motocicletas con VIN y sus ENTRADAS | — |
| Cupon | codigo, tipo (`PORCENTAJE`, `MONTO_FIJO`), valor, vigencia, usosMaximos, usosActuales, activo, canal (PA-12) | 1–N Venta | `codigo UNIQUE` |
| Venta | canal (`WEB`, `POS`), estado, metodoPago (PA-5), subtotal, descuento, iva, total | → Cliente, → vendedor (PA-2), → Cupon?, → SesionCaja? | índices `estado`, `creadaEn`, `clienteId` |
| VentaDetalle | motocicletaId o accesorioId, cantidad, precioUnitario | N–1 Venta | — |
| ComprobanteTransferencia (PA-8) | rutaArchivo, mime, tamano, estado, motivoRechazo, revisadoPor | N–1 Venta | índice `estado` |
| SesionCaja | abiertaEn, montoInicial, cerradaEn, efectivoContado, vouchersContados, esperado, diferencia, estado | 1–N MovimientoCaja | una sola `ABIERTA` (índice único parcial en SQL) |
| MovimientoCaja | tipo (`INGRESO`, `RETIRO`), medio (`EFECTIVO`, `VOUCHER`, `TRANSFERENCIA`), monto, concepto | → SesionCaja, → Venta?, → Usuario | índice `sesionCajaId` |
| Factura (PA-7) | serie, correlativo, nit o "CF", nombre, direccion, subtotal, iva, total, estado | 1–1 Venta, 1–N FacturaLinea | `UNIQUE(serie, correlativo)` · `ventaId UNIQUE` · índice `nit` |
| FacturaLinea | descripcion, cantidad, precioUnitario, subtotal (copia al emitir) | N–1 Factura | — |

Decisiones:
- Usuario (acceso) separado de Cliente (datos comerciales y fiscales), porque el POS vende a personas sin cuenta.
- El precio vive en cada unidad (VIN); el stock bajo se calcula por modelo.
- `costoAdquisicion` por moto, copiado de la orden de compra, para el rendimiento financiero.
- Una sola tabla Venta para web y POS, distinguidas por `canal`.
- RN 2: cada venta corre en una transacción que bloquea la fila de la moto (`SELECT … FOR UPDATE`) antes de verificar `DISPONIBLE`.
- El esquema crece por fases, con una migración por fase.

## 3. Fases

| Fase | Rama (desde `dev`) | Alcance | Puntos abiertos |
|---|---|---|---|
| 1 | `feature/fase-1-base-autenticacion` | Capas, configuración desde `.env`, Singleton de Prisma, Usuario y Cliente, migración, seed del primer admin, registro y login (bcrypt, JWT), protección por rol | PA-3 |
| 2 | `feature/fase-2-catalogo-inventario-compras` | Marcas, modelos, motos por VIN, estados, inventario, alertas, proveedores, órdenes de compra, recepción | PA-1, PA-11 |
| 3 | `feature/fase-3-ventas-caja` | Checkout, cupones, IVA, comprobantes, validación de transferencias, caja, POS, retiros, cuadre | PA-2, PA-4, PA-5, PA-6, PA-8, PA-9, PA-12 |
| 4 | `feature/fase-4-facturacion-reportes` | Factura interna aislada en un servicio, reportes | PA-7 |
| 5 | `feature/fase-5-frontend-tienda` | Catálogo con filtros, carrito, checkout, historial, facturas | PA-10 |
| 6 | `feature/fase-6-frontend-panel` | Inventario, caja, POS, compras, cupones, transferencias, facturación, reportes | — |
| 7 | `feature/fase-7-cierre` | Integración, README, verificación final, PR de `dev` a `main` | — |

## 4. Puntos abiertos resueltos

| Punto | Decisión | Fecha |
|---|---|---|
| PA-3 Registro de administradores | El registro público solo crea clientes. El primer administrador sale del seed (`ADMIN_*` en `.env`) y los demás los crea un administrador con `POST /api/usuarios`. | 2026-11-13 |
| PA-1 Accesorios | Entidad aparte con SKU único, precio en GTQ, stock por cantidad y stock mínimo. Se compran a proveedores. | 2026-11-13 |
| PA-11 Moneda de las compras | Todas las órdenes de compra se registran en GTQ, con el costo ya convertido. | 2026-11-13 |

Otras decisiones de la fase 2: el VIN sigue ISO 3779 (17 caracteres, sin I, O ni Q) y no se puede editar; el estado VENDIDA solo lo asigna una venta; los ajustes manuales son solo de accesorios, porque las motos salen del inventario con una venta.
