import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { getSpreadsheetId, inicializarDatos } from './sheets'

interface DataContextValor {
  /** Id del archivo de Google Sheets que actúa como base de datos. */
  spreadsheetId: string | null
  /** `true` cuando el bootstrap terminó y los datos están listos. */
  listo: boolean
  /** `true` mientras se ejecuta el bootstrap. */
  cargando: boolean
  error: string | null
  /** Reintenta el bootstrap tras un error. */
  reintentar: () => void
}

const DataContext = createContext<DataContextValor | null>(null)

/**
 * Ejecuta el bootstrap de la base de datos (Google Sheets) al haber sesión, y
 * muestra una pantalla de carga/errores hasta que esté lista. Solo entonces
 * renderiza a sus hijos.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const { token, usuario } = useAuth()
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(
    getSpreadsheetId(),
  )
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enCurso = useRef(false)

  const userId = usuario?.id ?? ''

  const ejecutarBootstrap = useCallback(async () => {
    if (enCurso.current || !token || !userId) return
    enCurso.current = true
    setCargando(true)
    setError(null)
    try {
      const id = await inicializarDatos(userId)
      setSpreadsheetId(id)
    } catch (e) {
      const mensaje =
        e instanceof Error ? e.message : 'No se pudo preparar la base de datos.'
      setError(mensaje)
    } finally {
      setCargando(false)
      enCurso.current = false
    }
  }, [token, userId])

  useEffect(() => {
    if (token && userId && !spreadsheetId) {
      void ejecutarBootstrap()
    }
  }, [token, userId, spreadsheetId, ejecutarBootstrap])

  const valor: DataContextValor = {
    spreadsheetId,
    listo: Boolean(spreadsheetId),
    cargando,
    error,
    reintentar: () => void ejecutarBootstrap(),
  }

  if (error) {
    return (
      <Pantalla>
        <p className="text-red-700">{error}</p>
        <button
          type="button"
          onClick={valor.reintentar}
          className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Reintentar
        </button>
      </Pantalla>
    )
  }

  if (!spreadsheetId) {
    return (
      <Pantalla>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
        <p className="mt-4 text-sm text-slate-500">Preparando tus datos…</p>
      </Pantalla>
    )
  }

  return <DataContext.Provider value={valor}>{children}</DataContext.Provider>
}

function Pantalla({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      {children}
    </div>
  )
}

/** Hook para acceder al contexto de datos. */
export function useData(): DataContextValor {
  const ctx = useContext(DataContext)
  if (!ctx) {
    throw new Error('useData debe usarse dentro de <DataProvider>.')
  }
  return ctx
}
