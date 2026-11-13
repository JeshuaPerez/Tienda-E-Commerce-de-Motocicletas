// Detecta el tipo real de un archivo por sus primeros bytes ("firma"), sin confiar en el nombre
// ni en el tipo que declara el navegador. Cada uso indica qué tipos acepta.
const FIRMAS = [
  { tipo: 'image/jpeg', extension: 'jpg', partes: [[0, [0xff, 0xd8, 0xff]]] },
  { tipo: 'image/png', extension: 'png', partes: [[0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]]] },
  { tipo: 'image/webp', extension: 'webp', partes: [[0, [0x52, 0x49, 0x46, 0x46]], [8, [0x57, 0x45, 0x42, 0x50]]] }, // "RIFF" … "WEBP"
  { tipo: 'application/pdf', extension: 'pdf', partes: [[0, [0x25, 0x50, 0x44, 0x46, 0x2d]]] }, // "%PDF-"
];

export function detectarTipoArchivo(contenido, permitidos) {
  if (!Buffer.isBuffer(contenido)) return null;
  const firma = FIRMAS.find(({ partes }) => partes.every(([desde, bytes]) => bytes.every((b, i) => contenido[desde + i] === b)));
  return firma && permitidos.includes(firma.tipo) ? firma : null;
}

// Tipo de contenido con el que se sirve cada extensión guardada por el servidor.
export const TIPO_POR_EXTENSION = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};
