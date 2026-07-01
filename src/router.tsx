import { createBrowserRouter } from 'react-router-dom'
import Layout from './components/Layout'
import Inicio from './pages/Inicio'
import Movimientos from './pages/Movimientos'
import RegistrarIngreso from './pages/RegistrarIngreso'
import RegistrarEgreso from './pages/RegistrarEgreso'
import EditarMovimiento from './pages/EditarMovimiento'
import TransferirCuenta from './pages/TransferirCuenta'
import Bolsillos from './pages/Bolsillos'
import Cuentas from './pages/Cuentas'
import Fijos from './pages/Fijos'
import { lazy, Suspense } from 'react'

// Carga diferida: recharts es pesado, así que va en su propio chunk.
const Estadisticas = lazy(() => import('./pages/Estadisticas'))

function CargandoPagina() {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      Cargando…
    </div>
  )
}
import Metas from './pages/Metas'
import Configuracion from './pages/Configuracion'
import Diagnostico from './pages/Diagnostico'
import NoEncontrado from './pages/NoEncontrado'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Inicio /> },
      { path: 'movimientos', element: <Movimientos /> },
      { path: 'movimientos/:id/editar', element: <EditarMovimiento /> },
      { path: 'ingreso', element: <RegistrarIngreso /> },
      { path: 'gasto', element: <RegistrarEgreso /> },
      { path: 'transferir', element: <TransferirCuenta /> },
      { path: 'bolsillos', element: <Bolsillos /> },
      { path: 'cuentas', element: <Cuentas /> },
      { path: 'fijos', element: <Fijos /> },
      {
        path: 'estadisticas',
        element: (
          <Suspense fallback={<CargandoPagina />}>
            <Estadisticas />
          </Suspense>
        ),
      },
      { path: 'metas', element: <Metas /> },
      { path: 'configuracion', element: <Configuracion /> },
      { path: 'diagnostico', element: <Diagnostico /> },
      { path: '*', element: <NoEncontrado /> },
    ],
  },
])
