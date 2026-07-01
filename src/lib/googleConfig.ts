/**
 * Configuración de OAuth de Google (Google Identity Services, sin backend).
 */

/** Client ID de OAuth 2.0 (tipo "Aplicación web"). */
export const GOOGLE_CLIENT_ID =
  '430502472090-ftbnv8mll2imvt0fv6ggor9p86dai4uu.apps.googleusercontent.com'

/**
 * Scopes solicitados.
 * - `spreadsheets` y `drive.file` son los necesarios para leer/escribir la hoja.
 * - `openid email profile` se añaden para poder mostrar el nombre y correo del
 *   usuario (perfil) sin necesidad de un backend.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
]

/** Endpoint para obtener el perfil del usuario a partir del access token. */
export const USERINFO_ENDPOINT =
  'https://www.googleapis.com/oauth2/v3/userinfo'
