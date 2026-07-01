/**
 * Configuración de OAuth de Google (Google Identity Services, sin backend).
 */

/** Client ID de OAuth 2.0 (tipo "Aplicación web"). */
export const GOOGLE_CLIENT_ID =
  '430502472090-ftbnv8mll2imvt0fv6ggor9p86dai4uu.apps.googleusercontent.com'

/**
 * Scopes solicitados (todos NO sensibles, para evitar la pantalla de
 * "app no verificada" y reducir los clics de consentimiento).
 * - `drive.file`: acceso solo a los archivos que la app crea o abre. Es
 *   suficiente para el API de Sheets sobre nuestro propio archivo (crear, leer
 *   y escribir), sin necesitar el scope sensible `spreadsheets`.
 * - `openid email profile`: para mostrar el nombre y correo del usuario.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
]

/** Endpoint para obtener el perfil del usuario a partir del access token. */
export const USERINFO_ENDPOINT =
  'https://www.googleapis.com/oauth2/v3/userinfo'
