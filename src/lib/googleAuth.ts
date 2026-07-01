/**
 * Autenticación con Google usando Google Identity Services (GIS), en el
 * navegador y sin backend. Se usa el "modelo de token" de OAuth: se obtiene un
 * access token que se guarda en memoria y se usa para llamar a las APIs de
 * Google (Sheets, Drive). El token expira (~1 hora) y se refresca de forma
 * silenciosa cuando es posible.
 */

import type { Usuario } from '@/types'
import type {
  GisTokenClient,
  GisTokenResponse,
} from '@/types/gsi'
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_SCOPES,
  USERINFO_ENDPOINT,
} from './googleConfig'

const GIS_SRC = 'https://accounts.google.com/gsi/client'

/** Resultado de una solicitud de token exitosa. */
export interface TokenResult {
  accessToken: string
  /** Marca de tiempo (ms epoch) en la que el token expira. */
  expiraEn: number
  scope: string
}

let gisPromise: Promise<void> | null = null
let tokenClient: GisTokenClient | null = null

/** Solicitud en curso: enlaza el callback de GIS con la promesa que devolvemos. */
let solicitudPendiente: {
  resolve: (r: TokenResult) => void
  reject: (e: Error) => void
} | null = null

/** Carga el script de Google Identity Services una sola vez. */
export function cargarGis(): Promise<void> {
  if (gisPromise) return gisPromise

  gisPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () =>
      reject(new Error('No se pudo cargar Google Identity Services.'))
    document.head.appendChild(script)
  })

  return gisPromise
}

function resolverExpiracion(resp: GisTokenResponse): number {
  const segundos = Number(resp.expires_in) || 3600
  return Date.now() + segundos * 1000
}

/** Inicializa (una vez) el token client de GIS. */
async function obtenerTokenClient(): Promise<GisTokenClient> {
  await cargarGis()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) {
    throw new Error('Google Identity Services no está disponible.')
  }

  if (!tokenClient) {
    tokenClient = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES.join(' '),
      callback: (resp) => {
        const pendiente = solicitudPendiente
        solicitudPendiente = null
        if (!pendiente) return
        if (resp.error) {
          pendiente.reject(
            new Error(resp.error_description || resp.error),
          )
          return
        }
        pendiente.resolve({
          accessToken: resp.access_token,
          expiraEn: resolverExpiracion(resp),
          scope: resp.scope,
        })
      },
      error_callback: (err) => {
        const pendiente = solicitudPendiente
        solicitudPendiente = null
        pendiente?.reject(new Error(err.type || 'error_oauth'))
      },
    })
  }

  return tokenClient
}

/**
 * Solicita un access token.
 * @param opciones.silencioso Si es `true`, intenta obtener el token sin mostrar
 *   interfaz (reutilizando la sesión de Google existente). Úsalo para refrescar.
 */
export async function solicitarToken(
  opciones: { silencioso?: boolean } = {},
): Promise<TokenResult> {
  const client = await obtenerTokenClient()

  return new Promise<TokenResult>((resolve, reject) => {
    // Si ya hay una solicitud en curso, la cancelamos para evitar cuelgues.
    if (solicitudPendiente) {
      solicitudPendiente.reject(
        new Error('Solicitud de token reemplazada por otra.'),
      )
    }
    solicitudPendiente = { resolve, reject }
    // prompt: '' permite que Google reutilice el consentimiento previo y no
    // muestre interfaz si ya fue concedido (clave para el refresco silencioso).
    client.requestAccessToken({ prompt: opciones.silencioso ? '' : 'consent' })
  })
}

/** Obtiene el perfil (nombre, correo, foto) usando el access token. */
export async function obtenerPerfil(accessToken: string): Promise<Usuario> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error('No se pudo obtener el perfil del usuario.')
  }
  const data = (await res.json()) as {
    sub: string
    name?: string
    email: string
    picture?: string
  }
  return {
    id: data.sub,
    nombre: data.name ?? data.email,
    email: data.email,
    fotoUrl: data.picture,
  }
}

/** Revoca el access token en Google (cierre de sesión completo). */
export function revocarToken(accessToken: string): Promise<void> {
  return new Promise((resolve) => {
    const oauth2 = window.google?.accounts?.oauth2
    if (!oauth2) {
      resolve()
      return
    }
    oauth2.revoke(accessToken, () => resolve())
  })
}
