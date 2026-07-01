import { NavLink, Outlet } from 'react-router-dom'
import { navItems } from './navItems'
import { useAuth } from '@/lib/AuthContext'

/** Encabezado superior para móvil con nombre del usuario y cerrar sesión. */
function MobileHeader() {
  const { usuario, logout } = useAuth()
  if (!usuario) return null

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
          $
        </span>
        <span className="truncate text-sm text-slate-600">
          {usuario.nombre}
        </span>
      </div>
      <button
        type="button"
        onClick={logout}
        className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        Salir
      </button>
    </header>
  )
}

/** Tarjeta con los datos del usuario y botón de cerrar sesión. */
function UsuarioBox() {
  const { usuario, logout } = useAuth()
  if (!usuario) return null

  return (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-3">
        {usuario.fotoUrl ? (
          <img
            src={usuario.fotoUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {usuario.nombre.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">
            {usuario.nombre}
          </p>
          <p className="truncate text-xs text-slate-500">{usuario.email}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={logout}
        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        Cerrar sesión
      </button>
    </div>
  )
}

/**
 * Layout base de la aplicación.
 * - En escritorio (md+): barra de navegación lateral fija a la izquierda.
 * - En móvil: barra de navegación inferior fija.
 */
export default function Layout() {
  return (
    <div className="min-h-full bg-slate-50 text-slate-800">
      {/* Navegación lateral (escritorio) */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-60 md:flex-col md:border-r md:border-slate-200 md:bg-white">
        <div className="flex items-center gap-2 px-6 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold text-white">
            $
          </span>
          <span className="text-lg font-semibold text-slate-900">
            Mis Finanzas
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <UsuarioBox />
      </aside>

      {/* Contenido principal */}
      <div className="md:pl-60">
        {/* Encabezado (móvil): muestra el usuario, ya que la barra inferior
            está ocupada por la navegación. */}
        <MobileHeader />
        <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 md:px-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Navegación inferior (móvil) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-8 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors',
                isActive ? 'text-brand-600' : 'text-slate-500',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5" />
            <span className="leading-none">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
