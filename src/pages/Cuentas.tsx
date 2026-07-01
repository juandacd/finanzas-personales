import { Link } from 'react-router-dom'
import { useFinanzas } from '@/lib/FinanzasContext'
import { formatCOP } from '@/lib/format'

export default function Cuentas() {
  const { cuentas, saldos, cargando, error } = useFinanzas()
  const activas = cuentas.filter((c) => c.activo)

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Cuentas</h1>
        <Link
          to="/transferir"
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Transferir / Retiro
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {cargando && !cuentas.length ? (
        <div className="mt-6 flex items-center gap-3 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
          Cargando cuentas…
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {activas.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div>
                <p className="font-medium text-slate-900">{c.nombre}</p>
                <p className="text-xs text-slate-400">{c.tipo}</p>
              </div>
              <p className="text-xl font-semibold text-slate-900">
                {formatCOP(saldos.cuentas[c.id] ?? 0)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
