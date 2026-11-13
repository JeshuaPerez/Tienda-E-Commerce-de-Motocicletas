// RN 7: las credenciales se leen solo de variables de entorno y el arranque falla si faltan.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cargarEntorno, ErrorConfiguracion } from '../../src/config/entorno.js';

const entornoValido = {
  PORT: '3000',
  DATABASE_URL: 'postgresql://usuario:clave@localhost:5432/motostore',
  JWT_SECRET: 'x'.repeat(32),
  JWT_EXPIRA: '8h',
};

describe('RN 7 · configuración por variables de entorno', () => {
  it('carga una configuración completa', () => {
    const entorno = cargarEntorno(entornoValido);
    assert.equal(entorno.PORT, 3000);
    assert.equal(entorno.JWT_EXPIRA, '8h');
    assert.equal(entorno.BCRYPT_COSTO, 12);
    assert.ok(Object.isFrozen(entorno));
  });

  for (const variable of ['PORT', 'DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRA']) {
    it(`falla si falta ${variable}`, () => {
      const incompleto = { ...entornoValido };
      delete incompleto[variable];
      assert.throws(() => cargarEntorno(incompleto), (error) => {
        assert.ok(error instanceof ErrorConfiguracion);
        assert.match(error.message, new RegExp(variable));
        return true;
      });
    });
  }

  it('rechaza un JWT_SECRET de menos de 32 caracteres', () => {
    assert.throws(() => cargarEntorno({ ...entornoValido, JWT_SECRET: 'corto' }), /JWT_SECRET/);
  });

  it('rechaza un PORT que no es número', () => {
    assert.throws(() => cargarEntorno({ ...entornoValido, PORT: 'abc' }), /PORT/);
  });

  it('no incluye valores de secretos en el mensaje de error', () => {
    const secreto = 'clave-super-secreta';
    try {
      cargarEntorno({ ...entornoValido, JWT_SECRET: secreto });
      assert.fail('debía fallar');
    } catch (error) {
      assert.ok(!error.message.includes(secreto));
    }
  });
});
