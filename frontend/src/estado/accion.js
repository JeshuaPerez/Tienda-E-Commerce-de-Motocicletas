// Ejecuta una acción asíncrona del panel con estado de carga, error y mensaje de éxito.
import { ref } from 'vue';

export function usarAccion() {
  const cargando = ref(false);
  const error = ref(null);
  const mensaje = ref('');

  async function ejecutar(funcion, exito = '') {
    cargando.value = true;
    error.value = null;
    mensaje.value = '';
    try {
      const resultado = await funcion();
      mensaje.value = exito;
      return resultado;
    } catch (e) {
      error.value = e;
      return undefined;
    } finally {
      cargando.value = false;
    }
  }

  return { cargando, error, mensaje, ejecutar };
}
