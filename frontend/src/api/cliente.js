// Cliente HTTP mínimo sobre fetch. En desarrollo, Vite reenvía /api al backend (ver vite.config.js).
export class ErrorApi extends Error {
  constructor(estado, mensaje, detalles = []) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.detalles = detalles;
  }
}

const armarConsulta = (consulta = {}) => {
  const pares = Object.entries(consulta).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return pares.length ? `?${new URLSearchParams(pares.map(([k, v]) => [k, String(v)]))}` : '';
};

export function crearClienteApi({ base = '/api', obtenerToken = () => null, alNoAutorizado = () => {}, fetch = globalThis.fetch } = {}) {
  async function pedir(metodo, ruta, { cuerpo, formulario, consulta, crudo = false } = {}) {
    const headers = {};
    const token = obtenerToken();
    if (token) headers.authorization = `Bearer ${token}`;
    if (cuerpo !== undefined) headers['content-type'] = 'application/json';

    let respuesta;
    try {
      respuesta = await fetch(`${base}${ruta}${armarConsulta(consulta)}`, {
        method: metodo,
        headers,
        body: formulario ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)),
      });
    } catch {
      throw new ErrorApi(0, 'No se pudo conectar con el servidor');
    }

    if (crudo && respuesta.ok) return respuesta.blob();
    const tipo = respuesta.headers.get('content-type') ?? '';
    const datos = tipo.includes('application/json') ? await respuesta.json().catch(() => null) : null;
    if (!respuesta.ok) {
      if (respuesta.status === 401 && token) alNoAutorizado();
      throw new ErrorApi(respuesta.status, datos?.error?.mensaje ?? `Error ${respuesta.status}`, datos?.error?.detalles ?? []);
    }
    return datos;
  }
  return { pedir };
}
