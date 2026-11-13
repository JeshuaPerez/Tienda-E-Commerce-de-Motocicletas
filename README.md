# MotoStore GT

Plataforma web de comercio electrónico y gestión operativa para un concesionario de motocicletas nuevas en Guatemala. Une en un solo sistema la **tienda virtual** del cliente (catálogo, carrito, checkout por transferencia o POS) y el **panel del concesionario** (inventario por VIN, punto de venta, caja diaria, compras a proveedores, cupones, validación de transferencias, facturación y reportes).

## Funcionalidades

**Cliente**
- Catálogo público de motocicletas disponibles con filtros por marca, cilindrada y precio; accesorios.
- Carrito en el navegador, sin necesidad de sesión; cupones de descuento.
- Checkout con sesión: transferencia bancaria (con subida del comprobante) o pago con POS al retirar; facturación con NIT o CF.
- Historial de compras con estado de pago y de facturación; factura imprimible.

**Administrador**
- Tablero con caja del día, ventas de hoy, transferencias por validar y alertas de stock.
- Punto de venta con cliente, vendedor, motocicletas y accesorios, cupón y pago en efectivo, tarjeta (voucher) o transferencia.
- Caja diaria: apertura, ingresos por medio, retiros y cierre con cuadre de efectivo y vouchers.
- Inventario por VIN, alertas de stock bajo, ajustes y bitácora de entradas y salidas.
- Proveedores locales e internacionales, órdenes de compra en GTQ y recepción de mercancía por VIN.
- Validación de transferencias, cupones, facturas (anulación y reemisión) y reportes (ventas por período, más vendidas, flujo de caja y margen bruto).

## Tecnología

| Parte | Tecnología |
|---|---|
| Backend | Node.js 22 (ES modules), Express 5, arquitectura Router → Controller → Service → Repository |
| Base de datos | PostgreSQL 17 con Prisma 7 (una sola instancia de PrismaClient: patrón Singleton) |
| Seguridad | JWT, contraseñas con bcrypt, rutas protegidas por rol, secretos en `.env` |
| Frontend | Vue 3 (SPA), Vue Router, Vite y Tailwind CSS 4; diseño responsivo |
| Pruebas | `node:test` (incluido en Node), sin frameworks adicionales |

## Estructura

```
backend/
  prisma/            esquema, migraciones y seed del primer administrador
  src/
    config/          variables de entorno validadas y parámetros de negocio
    db/              Singleton de Prisma y repositorios
    middlewares/     autenticación, roles y manejo de errores
    modulos/         auth, usuarios, catalogo, inventario, compras, cupones, caja, ventas, pos, facturacion, reportes
    utils/           montos en GTQ, NIT, VIN, validación, archivos
  test/              pruebas unitarias, HTTP y de integración con PostgreSQL
frontend/
  src/
    vistas/tienda/   catálogo, carrito, checkout, mis compras, factura
    vistas/panel/    tablero, POS, caja, inventario, compras, reportes…
  test/              pruebas de la lógica (montos, carrito, cliente de la API, panel)
docs/plan.md         trazabilidad de requerimientos, modelo de datos y decisiones
```

## Requisitos

- Node.js 22.12 o superior (probado con 22.23)
- PostgreSQL 17 (probado con 17.11)
- Git

## Instalación desde cero

### 1. Clonar el repositorio

```bash
git clone https://github.com/JeshuaPerez/Tienda-E-Commerce-de-Motocicletas.git
cd Tienda-E-Commerce-de-Motocicletas
```

### 2. Crear el rol y las bases de datos

Reemplaza `TU_CLAVE` por una clave propia. `CREATEDB` lo necesita Prisma para crear su base temporal al desarrollar migraciones.

```bash
psql -U postgres -c "CREATE ROLE motostore WITH LOGIN CREATEDB PASSWORD 'TU_CLAVE';"
psql -U postgres -c "CREATE DATABASE motostore OWNER motostore;"
psql -U postgres -c "CREATE DATABASE motostore_test OWNER motostore;"
```

### 3. Configurar el backend

```bash
cd backend
cp .env.example .env
```

Completa `backend/.env` (ver la tabla de variables). Luego:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

La API queda en `http://localhost:3000/api`. El seed crea el primer administrador con `ADMIN_CORREO`, `ADMIN_NOMBRE` y `ADMIN_CONTRASENA`; se puede repetir sin duplicarlo.

### 4. Configurar el frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. Vite reenvía `/api` al backend, así que no hace falta configurar CORS. Si la API corre en otra dirección, defínela con la variable `MOTOSTORE_API` antes de `npm run dev`.

- Tienda: `http://localhost:5173/`
- Panel: `http://localhost:5173/panel` (ingresa con el administrador del seed)

### Compilar el frontend para producción

```bash
cd frontend
npm run build
npm run preview
```

`npm run build` deja los archivos en `frontend/dist/`; `npm run preview` los sirve con el mismo reenvío de `/api`.

## Variables de entorno (`backend/.env`)

`.env` nunca se sube al repositorio; `backend/.env.example` tiene los nombres sin valores reales.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `PORT` | Sí | Puerto de la API (por ejemplo 3000) |
| `DATABASE_URL` | Sí | Conexión a la base de desarrollo. El usuario es el rol de PostgreSQL (`motostore`) |
| `DATABASE_URL_TEST` | Para pruebas de integración | Conexión a la base de pruebas; su nombre debe terminar en `_test` |
| `JWT_SECRET` | Sí | Secreto para firmar los JWT, mínimo 32 caracteres |
| `JWT_EXPIRA` | Sí | Duración de la sesión, por ejemplo `8h` |
| `BCRYPT_COSTO` | No | Costo de bcrypt entre 4 y 15 (12 por defecto) |
| `ADMIN_CORREO`, `ADMIN_NOMBRE`, `ADMIN_CONTRASENA` | Para el seed | Primer administrador; la contraseña debe tener entre 8 y 72 caracteres |
| `DIRECTORIO_COMPROBANTES` | No | Carpeta de comprobantes de transferencia (por defecto `backend/uploads/comprobantes`, fuera de git) |
| `FACTURA_SERIE` | No | Serie de la factura interna (`A` por defecto) |
| `EMISOR_NOMBRE`, `EMISOR_NIT`, `EMISOR_DIRECCION` | No | Datos del concesionario que se imprimen en cada factura |

Si la aplicación arranca sin una variable obligatoria, se detiene con un mensaje que dice cuál falta (sin mostrar valores secretos).

## Migraciones y seed

| Comando (en `backend/`) | Para qué |
|---|---|
| `npx prisma migrate deploy` | Aplica las migraciones pendientes |
| `npx prisma migrate dev` | Crea una migración nueva durante el desarrollo |
| `npx prisma generate` | Genera el cliente de Prisma (Prisma 7 no lo genera al migrar) |
| `npm run db:seed` | Crea el primer administrador |

Las migraciones incluyen, además del esquema, restricciones que Prisma no expresa: índices únicos parciales (una sola caja abierta, una sola factura vigente por venta) y restricciones `CHECK` (stock no negativo, total = subtotal − descuento, entre otras).

## Pruebas

| Comando | Qué corre |
|---|---|
| `cd backend && npm test` | Toda la suite del backend. Antes migra la base de pruebas (`DATABASE_URL_TEST`); las pruebas de integración se omiten si esa variable no existe |
| `cd backend && npm run test:unit` | Solo pruebas unitarias y HTTP (no necesitan PostgreSQL) |
| `cd frontend && npm test` | Pruebas de la lógica del frontend |

Las pruebas de integración vacían la base de pruebas en cada corrida y se niegan a correr si su nombre no termina en `_test`, para no tocar la base de desarrollo.

## Reglas de negocio implementadas

1. Toda motocicleta se registra con un VIN único e irrepetible (validado en el servicio y con índice único en la base).
2. Solo se vende una motocicleta en estado Disponible; la venta bloquea la fila de la moto, así que la web y el POS no pueden vender el mismo VIN a la vez.
3. El checkout web exige sesión de cliente.
4. Una transferencia debe ser aprobada por el administrador antes de despachar la unidad.
5. El POS no registra ventas con la caja del día cerrada.
6. Todos los montos se manejan en quetzales (GTQ) con aritmética decimal; el IVA del 12 % va incluido en el precio.
7. Las credenciales viven solo en variables de entorno.

El detalle de cada requerimiento (endpoints, entidades, pantallas y pruebas) y las decisiones tomadas en los puntos abiertos están en [`docs/plan.md`](docs/plan.md). La verificación final contra el enunciado está en [`docs/entrega-final.md`](docs/entrega-final.md).

## Flujo de trabajo con Git

- `main`: producción. `dev`: desarrollo.
- Cada fase se trabajó en una rama `feature/fase-N-nombre` creada desde `dev` y se integró con un Pull Request.

## Autor

JeshuaPerez
