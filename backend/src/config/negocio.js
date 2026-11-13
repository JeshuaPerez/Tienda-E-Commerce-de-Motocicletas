// Parámetros de negocio confirmados por el usuario. No son secretos, por eso viven en el código.

// PA-6: IVA del 12 %, ya incluido en el precio publicado.
export const TASA_IVA = '0.12';

// RF 05: el "día" de la caja es el día calendario en Guatemala (UTC-6, sin horario de verano).
export const ZONA_HORARIA = 'America/Guatemala';
const DESFASE_GUATEMALA = '-06:00';

const formatoFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit',
});

// Fecha AAAA-MM-DD en Guatemala para un instante dado.
export const fechaGuatemala = (instante) => formatoFecha.format(instante);

// Inicio y fin de un día de Guatemala expresados como instantes.
export const inicioDelDia = (fecha) => new Date(`${fecha}T00:00:00.000${DESFASE_GUATEMALA}`);
export const finDelDia = (fecha) => new Date(`${fecha}T23:59:59.999${DESFASE_GUATEMALA}`);

// PA-8: comprobantes de transferencia.
export const COMPROBANTES = {
  tamanoMaximo: 5 * 1024 * 1024,
  tipos: ['image/jpeg', 'image/png', 'application/pdf'],
};

// Ampliación: imagen por modelo. No se aceptan SVG subidos (pueden llevar scripts).
export const IMAGENES = {
  tamanoMaximo: 2 * 1024 * 1024,
  tipos: ['image/jpeg', 'image/png', 'image/webp'],
};
