-- CreateEnum
CREATE TYPE "CanalVenta" AS ENUM ('WEB', 'POS');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('PENDIENTE_PAGO', 'PENDIENTE_VALIDACION', 'PAGADA', 'ENTREGADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('TRANSFERENCIA', 'POS_AL_RETIRAR', 'EFECTIVO', 'TARJETA');

-- CreateEnum
CREATE TYPE "TipoCupon" AS ENUM ('PORCENTAJE', 'MONTO_FIJO');

-- CreateEnum
CREATE TYPE "CanalCupon" AS ENUM ('WEB', 'POS', 'AMBOS');

-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'RETIRO');

-- CreateEnum
CREATE TYPE "MedioCaja" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MotivoMovimiento" ADD VALUE 'VENTA_WEB';
ALTER TYPE "MotivoMovimiento" ADD VALUE 'VENTA_POS';
ALTER TYPE "MotivoMovimiento" ADD VALUE 'LIBERACION';

-- CreateTable
CREATE TABLE "cupones" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "tipo" "TipoCupon" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "vigente_desde" TIMESTAMP(3) NOT NULL,
    "vigente_hasta" TIMESTAMP(3) NOT NULL,
    "usos_maximos" INTEGER,
    "usos_actuales" INTEGER NOT NULL DEFAULT 0,
    "canal" "CanalCupon" NOT NULL DEFAULT 'AMBOS',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cupones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" SERIAL NOT NULL,
    "canal" "CanalVenta" NOT NULL,
    "estado" "EstadoVenta" NOT NULL,
    "metodo_pago" "MetodoPago" NOT NULL,
    "referencia_pago" VARCHAR(100),
    "cliente_id" INTEGER NOT NULL,
    "vendedor_id" INTEGER,
    "cupon_id" INTEGER,
    "sesion_caja_id" INTEGER,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "iva" DECIMAL(12,2) NOT NULL,
    "nit_factura" VARCHAR(20) NOT NULL DEFAULT 'CF',
    "nombre_factura" VARCHAR(150) NOT NULL,
    "direccion_factura" VARCHAR(250) NOT NULL DEFAULT 'Ciudad',
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMP(3) NOT NULL,
    "pagada_en" TIMESTAMP(3),
    "entregada_en" TIMESTAMP(3),

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas_detalle" (
    "id" SERIAL NOT NULL,
    "venta_id" INTEGER NOT NULL,
    "motocicleta_id" INTEGER,
    "accesorio_id" INTEGER,
    "descripcion" VARCHAR(200) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ventas_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes_transferencia" (
    "id" SERIAL NOT NULL,
    "venta_id" INTEGER NOT NULL,
    "ruta_archivo" VARCHAR(200) NOT NULL,
    "tipo_archivo" VARCHAR(50) NOT NULL,
    "tamano" INTEGER NOT NULL,
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'PENDIENTE',
    "motivo_rechazo" VARCHAR(300),
    "revisado_por_id" INTEGER,
    "revisado_en" TIMESTAMP(3),
    "subido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobantes_transferencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_caja" (
    "id" SERIAL NOT NULL,
    "estado" "EstadoCaja" NOT NULL DEFAULT 'ABIERTA',
    "abierta_por_id" INTEGER NOT NULL,
    "abierta_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_operacion" VARCHAR(10) NOT NULL,
    "monto_inicial" DECIMAL(12,2) NOT NULL,
    "cerrada_por_id" INTEGER,
    "cerrada_en" TIMESTAMP(3),
    "efectivo_esperado" DECIMAL(12,2),
    "efectivo_contado" DECIMAL(12,2),
    "vouchers_esperado" DECIMAL(12,2),
    "vouchers_contado" DECIMAL(12,2),
    "transferencias_total" DECIMAL(12,2),
    "notas_cierre" VARCHAR(500),

    CONSTRAINT "sesiones_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_caja" (
    "id" SERIAL NOT NULL,
    "sesion_caja_id" INTEGER NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "medio" "MedioCaja" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "concepto" VARCHAR(200) NOT NULL,
    "referencia" VARCHAR(100),
    "venta_id" INTEGER,
    "usuario_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cupones_codigo_key" ON "cupones"("codigo");

-- CreateIndex
CREATE INDEX "ventas_estado_idx" ON "ventas"("estado");

-- CreateIndex
CREATE INDEX "ventas_creada_en_idx" ON "ventas"("creada_en");

-- CreateIndex
CREATE INDEX "ventas_cliente_id_idx" ON "ventas"("cliente_id");

-- CreateIndex
CREATE INDEX "ventas_nit_factura_idx" ON "ventas"("nit_factura");

-- CreateIndex
CREATE INDEX "ventas_detalle_venta_id_idx" ON "ventas_detalle"("venta_id");

-- CreateIndex
CREATE INDEX "ventas_detalle_motocicleta_id_idx" ON "ventas_detalle"("motocicleta_id");

-- CreateIndex
CREATE INDEX "comprobantes_transferencia_estado_idx" ON "comprobantes_transferencia"("estado");

-- CreateIndex
CREATE INDEX "comprobantes_transferencia_venta_id_idx" ON "comprobantes_transferencia"("venta_id");

-- CreateIndex
CREATE INDEX "sesiones_caja_fecha_operacion_idx" ON "sesiones_caja"("fecha_operacion");

-- CreateIndex
CREATE INDEX "movimientos_caja_sesion_caja_id_idx" ON "movimientos_caja"("sesion_caja_id");

-- CreateIndex
CREATE INDEX "movimientos_caja_fecha_idx" ON "movimientos_caja"("fecha");

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cupon_id_fkey" FOREIGN KEY ("cupon_id") REFERENCES "cupones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_sesion_caja_id_fkey" FOREIGN KEY ("sesion_caja_id") REFERENCES "sesiones_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_motocicleta_id_fkey" FOREIGN KEY ("motocicleta_id") REFERENCES "motocicletas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_accesorio_id_fkey" FOREIGN KEY ("accesorio_id") REFERENCES "accesorios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_transferencia" ADD CONSTRAINT "comprobantes_transferencia_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_transferencia" ADD CONSTRAINT "comprobantes_transferencia_revisado_por_id_fkey" FOREIGN KEY ("revisado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_caja" ADD CONSTRAINT "sesiones_caja_abierta_por_id_fkey" FOREIGN KEY ("abierta_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_caja" ADD CONSTRAINT "sesiones_caja_cerrada_por_id_fkey" FOREIGN KEY ("cerrada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_sesion_caja_id_fkey" FOREIGN KEY ("sesion_caja_id") REFERENCES "sesiones_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricciones de integridad que Prisma no expresa en el esquema (agregadas a mano).

-- RF 05: solo puede haber una caja ABIERTA a la vez.
CREATE UNIQUE INDEX "sesiones_caja_una_abierta" ON "sesiones_caja" ("estado") WHERE "estado" = 'ABIERTA';
ALTER TABLE "sesiones_caja" ADD CONSTRAINT "caja_monto_inicial_no_negativo" CHECK ("monto_inicial" >= 0);

-- RF 09: valores válidos de los cupones.
ALTER TABLE "cupones" ADD CONSTRAINT "cupones_valor_positivo" CHECK ("valor" > 0);
ALTER TABLE "cupones" ADD CONSTRAINT "cupones_porcentaje_maximo" CHECK ("tipo" <> 'PORCENTAJE' OR "valor" <= 100);
ALTER TABLE "cupones" ADD CONSTRAINT "cupones_vigencia_valida" CHECK ("vigente_hasta" >= "vigente_desde");
ALTER TABLE "cupones" ADD CONSTRAINT "cupones_usos_validos"
  CHECK ("usos_actuales" >= 0 AND ("usos_maximos" IS NULL OR ("usos_maximos" > 0 AND "usos_actuales" <= "usos_maximos")));

-- RN 6: montos de la venta coherentes en GTQ.
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_montos_no_negativos"
  CHECK ("subtotal" >= 0 AND "descuento" >= 0 AND "total" >= 0 AND "iva" >= 0);
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_total_cuadra" CHECK ("total" = "subtotal" - "descuento");

ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_un_solo_articulo"
  CHECK (("motocicleta_id" IS NULL) <> ("accesorio_id" IS NULL));
ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_moto_unitaria" CHECK ("motocicleta_id" IS NULL OR "cantidad" = 1);
ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_cantidad_positiva" CHECK ("cantidad" > 0);

ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_monto_positivo" CHECK ("monto" > 0);
ALTER TABLE "comprobantes_transferencia" ADD CONSTRAINT "comprobantes_tamano_maximo" CHECK ("tamano" > 0 AND "tamano" <= 5242880);
