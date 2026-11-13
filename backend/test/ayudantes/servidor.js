// Levanta la app en un puerto libre y ofrece un cliente fetch mínimo para las pruebas HTTP.
import { crearApp } from '../../src/app.js';

export async function levantarServidor(dependencias) {
  const app = crearApp(dependencias);
  const servidor = await new Promise((resolver) => {
    const s = app.listen(0, () => resolver(s));
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;

  const pedir = async (metodo, ruta, { cuerpo, token, crudo } = {}) => {
    const cabeceras = {};
    if (cuerpo !== undefined || crudo !== undefined) cabeceras['content-type'] = 'application/json';
    if (token) cabeceras.authorization = `Bearer ${token}`;
    const respuesta = await fetch(base + ruta, {
      method: metodo,
      headers: cabeceras,
      body: crudo ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)),
    });
    const texto = await respuesta.text();
    return { estado: respuesta.status, cuerpo: texto ? JSON.parse(texto) : null };
  };

  return {
    pedir,
    cerrar: () => new Promise((resolver) => servidor.close(resolver)),
  };
}
