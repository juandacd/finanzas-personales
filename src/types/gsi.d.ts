/**
 * Tipado mínimo de Google Identity Services (modelo de token OAuth).
 * Solo cubre lo que usamos en la app. Ver:
 * https://developers.google.com/identity/oauth2/web/reference/js-reference
 */

export interface GisTokenResponse {
  access_token: string
  /** Segundos hasta que expira el token. */
  expires_in: number
  scope: string
  token_type: string
  /** Presente si hubo error (p. ej. el usuario canceló). */
  error?: string
  error_description?: string
}

export interface GisErrorResponse {
  type: string
  message?: string
}

export interface GisTokenClientConfig {
  client_id: string
  scope: string
  callback: (response: GisTokenResponse) => void
  error_callback?: (error: GisErrorResponse) => void
  prompt?: '' | 'none' | 'consent' | 'select_account'
}

export interface GisTokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void
}

export interface GisOAuth2 {
  initTokenClient: (config: GisTokenClientConfig) => GisTokenClient
  revoke: (accessToken: string, done?: () => void) => void
}

export interface GoogleAccounts {
  oauth2: GisOAuth2
}

export interface GoogleGis {
  accounts: GoogleAccounts
}

declare global {
  interface Window {
    google?: GoogleGis
  }
}
