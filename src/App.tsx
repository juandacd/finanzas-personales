import { RouterProvider } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { DataProvider } from '@/lib/DataContext'
import { FinanzasProvider } from '@/lib/FinanzasContext'
import { router } from './router'
import Login from './pages/Login'

/**
 * Puerta de acceso:
 * - Sin sesión → pantalla de login.
 * - Con sesión → se ejecuta el bootstrap de datos (DataProvider) y luego se
 *   monta la aplicación completa.
 */
export default function App() {
  const { estaAutenticado, inicializando } = useAuth()

  // Mientras se restaura/intenta la sesión, no mostramos el login todavía.
  if (inicializando && !estaAutenticado) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
        <p className="mt-4 text-sm text-slate-500">Conectando…</p>
      </div>
    )
  }

  if (!estaAutenticado) {
    return <Login />
  }

  return (
    <DataProvider>
      <FinanzasProvider>
        <RouterProvider router={router} />
      </FinanzasProvider>
    </DataProvider>
  )
}
