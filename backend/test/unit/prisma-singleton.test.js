// Patrón Singleton: toda la aplicación comparte una sola instancia de PrismaClient.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { obtenerPrisma, desconectarPrisma } from '../../src/db/prisma.js';

describe('Singleton de Prisma', () => {
  after(() => desconectarPrisma());

  it('devuelve siempre la misma instancia', () => {
    assert.strictEqual(obtenerPrisma(), obtenerPrisma());
  });

  it('expone los modelos del esquema', () => {
    assert.equal(typeof obtenerPrisma().usuario.findUnique, 'function');
  });
});
