import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Usuario } from '@/types'
import {
  cargarGis,
  obtenerPerfil,
  revocarToken,
  solicitarToken,
} from './googleAuth'
import { registrarRefrescador, setAccessToken } from './sheets'

interface AuthContextValor {
  /** Usuario autenticado, o `null` si no hay sesión. */
  usuario: Usuario | null
  /** Access token vigente para llamar a las APIs de Google, o `null`. */
  token: string | null
  /** `true` si hay una sesión activa con token válido. */
  estaAutenticado: boolean
  /** `true` mientras se restaura/intenta la sesión al arrancar la app. */
  inicializando: boolean
  /** `true` mientras se procesa un inicio de sesión manual. */
  cargando: boolean
  /** Último mensaje de error de autenticación, si lo hubo. */
  error: string | null
  /** Inicia sesión con Google (muestra el selector de cuenta/consentimiento). */
  login: () => Promise<void>
  /** Cierra la sesión y revoca el token. */
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValor | null>(null)

/** Refresca el token este número de milisegundos ANTES de que expire. */
const MARGEN_REFRESCO_MS = 60_000

/** Clave en sessionStorage (sobrevive recargas de la pestaña, se limpia al cerrarla). */
const SS_KEY = 'mf_sesion'

interface SesionGuardada {
  access_token: string
  /** Marca de tiempo (ms epoch) en que expira el token. */
  expires_at: number
  usuario: Usuario
}

function leerSesion(): SesionGuardada | null {
  try {
    const raw = sessionStorage.getItem(SS_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SesionGuardada
    if (!s.access_token || !s.expires_at || !s.usuario) return null
    return s
  } catch {
    return null
  }
}

function guardarSesion(s: SesionGuardada): void {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(s))
  } catch {
    /* sessionStorage puede no estar disponible; no es crítico. */
  }
}

function limpiarSesionStorage(): void {
  try {
    sessionStorage.removeItem(SS_KEY)
  } catch {
    /* ignorar */
  }
}

/** ¿La sesión guardada sigue vigente (con margen de seguridad)? */
function sesionVigente(s: SesionGuardada | null): s is SesionGuardada {
  return !!s && s.expires_at - Date.now() > MARGEN_REFRESCO_MS
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restauración síncrona desde sessionStorage: si hay token vigente, lo
  // establecemos en la capa de datos ANTES de que los hijos monten sus efectos.
  const [token, setToken] = useState<string | null>(() => {
    const s = leerSesion()
    if (sesionVigente(s)) {
      setAccessToken(s.access_token)
      return s.access_token
    }
    return null
  })
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const s = leerSesion()
    return sesionVigente(s) ? s.usuario : null
  })
  const [expiresAt, setExpiresAt] = useState<number>(() => {
    const s = leerSesion()
    return sesionVigente(s) ? s.expires_at : 0
  })
  // Solo necesitamos "inicializar" (intento silencioso) si no restauramos token.
  const [inicializando, setInicializando] = useState<boolean>(() => {
    return !sesionVigente(leerSesion())
  })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const limpiarTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const cerrarLocal = useCallback(() => {
    limpiarTimer()
    limpiarSesionStorage()
    setAccessToken(null)
    setToken(null)
    setUsuario(null)
    setExpiresAt(0)
  }, [limpiarTimer])

  /** Aplica una sesión: fija el token (sync en la capa de datos) y el estado. */
  const aplicarSesion = useCallback(
    (accessToken: string, expira: number, user?: Usuario) => {
      setAccessToken(accessToken)
      setToken(accessToken)
      setExpiresAt(expira)
      if (user) setUsuario(user)
    },
    [],
  )

  /**
   * Programa un refresco silencioso del token 60s antes de expirar.
   * Si el refresco silencioso falla, cierra la sesión (pedirá login de nuevo).
   */
  const programarRefresco = useCallback(
    (expira: number) => {
      limpiarTimer()
      const espera = Math.max(0, expira - Date.now() - MARGEN_REFRESCO_MS)
      timerRef.current = setTimeout(async () => {
        try {
          const res = await solicitarToken({ silencioso: true })
          aplicarSesion(res.accessToken, res.expiraEn)
          programarRefresco(res.expiraEn)
        } catch {
          setError('Tu sesión expiró. Por favor inicia sesión de nuevo.')
          cerrarLocal()
        }
      }, espera)
    },
    [limpiarTimer, cerrarLocal, aplicarSesion],
  )

  const login = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await solicitarToken({ silencioso: false })
      const perfil = await obtenerPerfil(res.accessToken)
      aplicarSesion(res.accessToken, res.expiraEn, perfil)
      programarRefresco(res.expiraEn)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.')
      cerrarLocal()
    } finally {
      setCargando(false)
    }
  }, [aplicarSesion, programarRefresco, cerrarLocal])

  const logout = useCallback(async () => {
    const actual = token
    cerrarLocal()
    setError(null)
    if (actual) {
      try {
        await revocarToken(actual)
      } catch {
        /* Aunque falle la revocación remota, la sesión local ya se cerró. */
      }
    }
  }, [token, cerrarLocal])

  // Arranque: precarga GIS y, si no hay token restaurado, intenta un refresco
  // silencioso; solo si falla se mostrará el botón "Entrar con Google".
  useEffect(() => {
    cargarGis().catch(() => {
      /* Se reportará al intentar iniciar sesión. */
    })

    if (token) {
      // Token restaurado y vigente: solo reprogramar el refresco.
      programarRefresco(expiresAt)
      return
    }

    let cancelado = false
    ;(async () => {
      try {
        const res = await solicitarToken({ silencioso: true })
        const perfil = await obtenerPerfil(res.accessToken)
        if (cancelado) return
        aplicarSesion(res.accessToken, res.expiraEn, perfil)
        programarRefresco(res.expiraEn)
      } catch {
        /* Silencioso falló: se mostrará la pantalla de login. */
      } finally {
        if (!cancelado) setInicializando(false)
      }
    })()

    return () => {
      cancelado = true
    }
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persiste la sesión en sessionStorage ante cualquier cambio de token/usuario.
  useEffect(() => {
    if (token && usuario && expiresAt) {
      guardarSesion({ access_token: token, expires_at: expiresAt, usuario })
    }
  }, [token, usuario, expiresAt])

  // Mantiene sincronizado el token con la capa de datos (por si cambia por efecto).
  useEffect(() => {
    setAccessToken(token)
  }, [token])

  // Registra el refresco silencioso que usará la capa de datos ante un 401.
  useEffect(() => {
    registrarRefrescador(async () => {
      try {
        const res = await solicitarToken({ silencioso: true })
        aplicarSesion(res.accessToken, res.expiraEn)
        programarRefresco(res.expiraEn)
        return res.accessToken
      } catch {
        setError('Tu sesión expiró. Por favor inicia sesión de nuevo.')
        cerrarLocal()
        return null
      }
    })
    return () => registrarRefrescador(null)
  }, [aplicarSesion, programarRefresco, cerrarLocal])

  // Limpia el temporizador al desmontar.
  useEffect(() => limpiarTimer, [limpiarTimer])

  const valor: AuthContextValor = {
    usuario,
    token,
    estaAutenticado: Boolean(token && usuario),
    inicializando,
    cargando,
    error,
    login,
    logout,
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

/** Hook para acceder al contexto de autenticación. */
export function useAuth(): AuthContextValor {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  }
  return ctx
}
