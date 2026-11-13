// Cifrado de contraseñas con bcrypt (RF 01). Nunca se guarda la contraseña en texto plano.
import bcrypt from 'bcrypt';

export function crearServicioContrasenas(costo) {
  return {
    cifrar: (contrasena) => bcrypt.hash(contrasena, costo),
    comparar: (contrasena, hash) => bcrypt.compare(contrasena, hash),
  };
}
