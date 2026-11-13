// Almacén de archivos en disco (comprobantes, PA-8, e imágenes de modelos). Los nombres los genera el
// servidor (UUID), nunca el cliente, así que no hay forma de escribir o leer fuera de la carpeta.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function crearAlmacenArchivos(directorio, extensiones = ['jpg', 'png', 'pdf']) {
  const nombreValido = new RegExp(`^[0-9a-f-]{36}\\.(${extensiones.join('|')})$`);
  const ruta = (nombre) => {
    if (!nombreValido.test(nombre)) throw new Error('Nombre de archivo no válido');
    return path.join(directorio, nombre);
  };

  return {
    async guardar(contenido, extension) {
      await mkdir(directorio, { recursive: true });
      const nombre = `${randomUUID()}.${extension}`;
      await writeFile(ruta(nombre), contenido, { flag: 'wx' });
      return nombre;
    },
    // Un nombre con otra forma se trata como inexistente (no se intenta abrir).
    async leer(nombre) {
      if (!nombreValido.test(nombre)) return null;
      try {
        return await readFile(ruta(nombre));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    eliminar: (nombre) => (nombreValido.test(nombre) ? rm(ruta(nombre), { force: true }) : Promise.resolve()),
  };
}
