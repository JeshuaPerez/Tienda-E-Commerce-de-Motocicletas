-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('CLIENTE', 'ADMINISTRADOR');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "hash_contrasena" VARCHAR(100) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'CLIENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "nit" VARCHAR(20),
    "direccion" VARCHAR(250),
    "telefono" VARCHAR(20),
    "usuario_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_usuario_id_key" ON "clientes"("usuario_id");

-- CreateIndex
CREATE INDEX "clientes_nit_idx" ON "clientes"("nit");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
