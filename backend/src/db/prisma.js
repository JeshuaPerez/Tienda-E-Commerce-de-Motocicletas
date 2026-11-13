// Patrón Singleton: una sola instancia de PrismaClient para toda la aplicación.
// Prisma 7 exige un driver adapter; para PostgreSQL es @prisma/adapter-pg.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { obtenerEntorno } from '../config/entorno.js';

let instancia = null;

export function obtenerPrisma() {
  if (!instancia) {
    const adaptador = new PrismaPg({ connectionString: obtenerEntorno().DATABASE_URL });
    instancia = new PrismaClient({ adapter: adaptador });
  }
  return instancia;
}

export async function desconectarPrisma() {
  if (instancia) {
    await instancia.$disconnect();
    instancia = null;
  }
}
