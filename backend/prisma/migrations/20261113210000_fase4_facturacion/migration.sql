-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('EMITIDA', 'ANULADA');

-- CreateTable
CREATE TABLE "series_factura" (
    "serie" VARCHAR(10) NOT NULL,
    "ultimo_numero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "series_factura_pkey" PRIMARY KEY ("serie")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" SERIAL NOT NULL,
    "serie" VARCHAR(10) NOT NULL,
    "numero" INTEGER NOT NULL,
    "venta_id" INTEGER NOT NULL,
    "nit" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "direccion" VARCHAR(250) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "base_imponible" DECIMAL(12,2) NOT NULL,
    "iva" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'EMITIDA',
    "emitida_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anulada_en" TIMESTAMP(3),
    "anulada_por_id" INTEGER,
    "motivo_anulacion" VARCHAR(300),

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas_lineas" (
    "id" SERIAL NOT NULL,
    "factura_id" INTEGER NOT NULL,
    "descripcion" VARCHAR(200) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "facturas_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facturas_nit_idx" ON "facturas"("nit");

-- CreateIndex
CREATE INDEX "facturas_venta_id_idx" ON "facturas"("venta_id");

-- CreateIndex
CREATE INDEX "facturas_emitida_en_idx" ON "facturas"("emitida_en");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_serie_numero_key" ON "facturas"("serie", "numero");

-- CreateIndex
CREATE INDEX "facturas_lineas_factura_id_idx" ON "facturas_lineas"("factura_id");

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_anulada_por_id_fkey" FOREIGN KEY ("anulada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_lineas" ADD CONSTRAINT "facturas_lineas_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restricciones de integridad que Prisma no expresa en el esquema (agregadas a mano).

-- RF 08: una venta puede tener facturas anuladas, pero solo una EMITIDA.
CREATE UNIQUE INDEX "facturas_una_emitida_por_venta" ON "facturas" ("venta_id") WHERE "estado" = 'EMITIDA';

ALTER TABLE "facturas" ADD CONSTRAINT "facturas_numero_positivo" CHECK ("numero" > 0);
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_montos_cuadran"
  CHECK ("total" = "subtotal" - "descuento" AND "total" = "base_imponible" + "iva" AND "iva" >= 0);
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_anulacion_completa"
  CHECK (("estado" = 'ANULADA') = ("anulada_en" IS NOT NULL AND "motivo_anulacion" IS NOT NULL));
ALTER TABLE "facturas_lineas" ADD CONSTRAINT "facturas_lineas_cantidad_positiva" CHECK ("cantidad" > 0);
ALTER TABLE "series_factura" ADD CONSTRAINT "series_ultimo_no_negativo" CHECK ("ultimo_numero" >= 0);
