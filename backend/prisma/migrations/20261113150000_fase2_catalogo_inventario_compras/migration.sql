-- CreateEnum
CREATE TYPE "EstadoMotocicleta" AS ENUM ('DISPONIBLE', 'RESERVADA', 'VENDIDA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "MotivoMovimiento" AS ENUM ('COMPRA', 'ALTA_MANUAL', 'AJUSTE');

-- CreateEnum
CREATE TYPE "TipoProveedor" AS ENUM ('LOCAL', 'INTERNACIONAL');

-- CreateEnum
CREATE TYPE "EstadoOrdenCompra" AS ENUM ('BORRADOR', 'ENVIADA', 'RECIBIDA_PARCIAL', 'RECIBIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "marcas" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marcas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos" (
    "id" SERIAL NOT NULL,
    "marca_id" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "cilindrada" INTEGER NOT NULL,
    "stock_minimo" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modelos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motocicletas" (
    "id" SERIAL NOT NULL,
    "vin" VARCHAR(17) NOT NULL,
    "modelo_id" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "color" VARCHAR(40) NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "costo_adquisicion" DECIMAL(12,2),
    "descripcion" TEXT,
    "ficha_tecnica" JSONB,
    "estado" "EstadoMotocicleta" NOT NULL DEFAULT 'DISPONIBLE',
    "recepcion_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motocicletas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accesorios" (
    "id" SERIAL NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(12,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accesorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "motivo" "MotivoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motocicleta_id" INTEGER,
    "accesorio_id" INTEGER,
    "referencia" VARCHAR(200),
    "usuario_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "tipo" "TipoProveedor" NOT NULL,
    "nit" VARCHAR(20),
    "pais" VARCHAR(60) NOT NULL,
    "contacto" VARCHAR(120),
    "telefono" VARCHAR(30),
    "correo" VARCHAR(150),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_compra" (
    "id" SERIAL NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "estado" "EstadoOrdenCompra" NOT NULL DEFAULT 'BORRADOR',
    "total" DECIMAL(12,2) NOT NULL,
    "notas" TEXT,
    "usuario_id" INTEGER NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_compra_detalle" (
    "id" SERIAL NOT NULL,
    "orden_compra_id" INTEGER NOT NULL,
    "modelo_id" INTEGER,
    "accesorio_id" INTEGER,
    "cantidad" INTEGER NOT NULL,
    "cantidad_recibida" INTEGER NOT NULL DEFAULT 0,
    "costo_unitario" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ordenes_compra_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepciones" (
    "id" SERIAL NOT NULL,
    "orden_compra_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "notas" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recepciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marcas_nombre_key" ON "marcas"("nombre");

-- CreateIndex
CREATE INDEX "modelos_cilindrada_idx" ON "modelos"("cilindrada");

-- CreateIndex
CREATE UNIQUE INDEX "modelos_marca_id_nombre_key" ON "modelos"("marca_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "motocicletas_vin_key" ON "motocicletas"("vin");

-- CreateIndex
CREATE INDEX "motocicletas_estado_idx" ON "motocicletas"("estado");

-- CreateIndex
CREATE INDEX "motocicletas_precio_idx" ON "motocicletas"("precio");

-- CreateIndex
CREATE INDEX "motocicletas_modelo_id_idx" ON "motocicletas"("modelo_id");

-- CreateIndex
CREATE UNIQUE INDEX "accesorios_sku_key" ON "accesorios"("sku");

-- CreateIndex
CREATE INDEX "movimientos_inventario_fecha_idx" ON "movimientos_inventario"("fecha");

-- CreateIndex
CREATE INDEX "movimientos_inventario_motocicleta_id_idx" ON "movimientos_inventario"("motocicleta_id");

-- CreateIndex
CREATE INDEX "movimientos_inventario_accesorio_id_idx" ON "movimientos_inventario"("accesorio_id");

-- CreateIndex
CREATE INDEX "proveedores_nit_idx" ON "proveedores"("nit");

-- CreateIndex
CREATE INDEX "ordenes_compra_estado_idx" ON "ordenes_compra"("estado");

-- CreateIndex
CREATE INDEX "ordenes_compra_detalle_orden_compra_id_idx" ON "ordenes_compra_detalle"("orden_compra_id");

-- CreateIndex
CREATE INDEX "recepciones_orden_compra_id_idx" ON "recepciones"("orden_compra_id");

-- AddForeignKey
ALTER TABLE "modelos" ADD CONSTRAINT "modelos_marca_id_fkey" FOREIGN KEY ("marca_id") REFERENCES "marcas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motocicletas" ADD CONSTRAINT "motocicletas_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motocicletas" ADD CONSTRAINT "motocicletas_recepcion_id_fkey" FOREIGN KEY ("recepcion_id") REFERENCES "recepciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_motocicleta_id_fkey" FOREIGN KEY ("motocicleta_id") REFERENCES "motocicletas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_accesorio_id_fkey" FOREIGN KEY ("accesorio_id") REFERENCES "accesorios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_detalle" ADD CONSTRAINT "ordenes_compra_detalle_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_detalle" ADD CONSTRAINT "ordenes_compra_detalle_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_detalle" ADD CONSTRAINT "ordenes_compra_detalle_accesorio_id_fkey" FOREIGN KEY ("accesorio_id") REFERENCES "accesorios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "ordenes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricciones de integridad que Prisma no expresa en el esquema (agregadas a mano).
ALTER TABLE "modelos" ADD CONSTRAINT "modelos_cilindrada_positiva" CHECK ("cilindrada" > 0);
ALTER TABLE "modelos" ADD CONSTRAINT "modelos_stock_minimo_no_negativo" CHECK ("stock_minimo" >= 0);
ALTER TABLE "motocicletas" ADD CONSTRAINT "motocicletas_precio_positivo" CHECK ("precio" > 0);
ALTER TABLE "motocicletas" ADD CONSTRAINT "motocicletas_costo_no_negativo" CHECK ("costo_adquisicion" IS NULL OR "costo_adquisicion" >= 0);
ALTER TABLE "accesorios" ADD CONSTRAINT "accesorios_precio_positivo" CHECK ("precio" > 0);
ALTER TABLE "accesorios" ADD CONSTRAINT "accesorios_stock_no_negativo" CHECK ("stock" >= 0);
ALTER TABLE "accesorios" ADD CONSTRAINT "accesorios_stock_minimo_no_negativo" CHECK ("stock_minimo" >= 0);
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_cantidad_positiva" CHECK ("cantidad" > 0);
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_un_solo_articulo"
  CHECK (("motocicleta_id" IS NULL) <> ("accesorio_id" IS NULL));
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_total_no_negativo" CHECK ("total" >= 0);
ALTER TABLE "ordenes_compra_detalle" ADD CONSTRAINT "detalle_un_solo_articulo"
  CHECK (("modelo_id" IS NULL) <> ("accesorio_id" IS NULL));
ALTER TABLE "ordenes_compra_detalle" ADD CONSTRAINT "detalle_cantidad_positiva" CHECK ("cantidad" > 0);
ALTER TABLE "ordenes_compra_detalle" ADD CONSTRAINT "detalle_recibido_valido"
  CHECK ("cantidad_recibida" >= 0 AND "cantidad_recibida" <= "cantidad");
ALTER TABLE "ordenes_compra_detalle" ADD CONSTRAINT "detalle_costo_no_negativo" CHECK ("costo_unitario" >= 0);
