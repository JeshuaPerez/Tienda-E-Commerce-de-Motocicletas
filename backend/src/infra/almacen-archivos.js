// Almacén de comprobantes en disco (PA-8). Los nombres los genera el servidor (UUID), nunca el cliente,
// así que no hay forma de escribir o leer fuera de la carpeta.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const NOMBRE_VALIDO = /^[0-9a-f-]{36}\.(jpg|png|pdf)$/;

export function crearAlmacenArchivos(directorio) {
  const ruta = (nombre) => {
    if (!NOMBRE_VALIDO.test(nombre)) throw new Error('Nombre de archivo no válido');
    return path.join(directorio, nombre);
  };

  return {
    async guardar(contenido, extension) {
      await mkdir(directorio, { recursive: true });
      const nombre = `${randomUUID()}.${extension}`;
      await writeFile(ruta(nombre), contenido, { flag: 'wx' });
      return nombre;
    },
    async leer(nombre) {
      try {
        return await readFile(ruta(nombre));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    eliminar: (nombre) => rm(ruta(nombre), { force: true }),
  };
}
