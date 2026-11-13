// Detecta el tipo real de un archivo por sus primeros bytes ("firma"), sin confiar en el nombre
// ni en el tipo que declara el navegador.
const FIRMAS = [
  { tipo: 'image/jpeg', extension: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { tipo: 'image/png', extension: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { tipo: 'application/pdf', extension: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
];

export function detectarTipoArchivo(contenido) {
  if (!Buffer.isBuffer(contenido)) return null;
  return FIRMAS.find(({ bytes }) => bytes.every((b, i) => contenido[i] === b)) ?? null;
}
