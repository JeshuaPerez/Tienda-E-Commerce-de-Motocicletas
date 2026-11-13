// Sesión del usuario (RF 01): token JWT y datos públicos del usuario, guardados en localStorage.
import { computed, reactive } from 'vue';
import { crearClienteApi } from '../api/cliente.js';

const CLAVE = 'motostore.sesion';

function leer() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE));
    return typeof datos?.token === 'string' && datos.usuario ? datos : { token: null, usuario: null };
  } catch {
    return { token: null, usuario: null };
  }
}

export const sesion = reactive(leer());

function guardar() {
  try {
    if (sesion.token) localStorage.setItem(CLAVE, JSON.stringify({ token: sesion.token, usuario: sesion.usuario }));
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento (modo privado): la sesión dura mientras la pestaña esté abierta.
  }
}

export function cerrarSesion() {
  sesion.token = null;
  sesion.usuario = null;
  guardar();
}

export const api = crearClienteApi({ obtenerToken: () => sesion.token, alNoAutorizado: cerrarSesion });

export const haySesion = computed(() => Boolean(sesion.token));
export const esCliente = computed(() => sesion.usuario?.rol === 'CLIENTE');
export const esAdministrador = computed(() => sesion.usuario?.rol === 'ADMINISTRADOR');

function abrir({ token, usuario }) {
  sesion.token = token;
  sesion.usuario = usuario;
  guardar();
  return usuario;
}

export const iniciarSesion = async (correo, contrasena) => abrir(await api.pedir('POST', '/auth/login', { cuerpo: { correo, contrasena } }));

export const registrarse = async (datos) => abrir(await api.pedir('POST', '/auth/registro', { cuerpo: datos }));

// Al abrir la app, confirma con el servidor que el token sigue siendo válido.
export async function validarSesion() {
  if (!sesion.token) return;
  try {
    const { usuario } = await api.pedir('GET', '/auth/perfil');
    sesion.usuario = usuario;
    guardar();
  } catch (error) {
    if (error.estado === 401) cerrarSesion();
  }
}
