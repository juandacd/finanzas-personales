import { Link } from 'react-router-dom'
import { useFinanzas, type ProximoPago } from '@/lib/FinanzasContext'
import type { EstadoPago } from '@/lib/calculos'
import { formatCOP } from '@/lib/format'

/** Página de inicio / dashboard mínimo. */
export default function Inicio() {
  const { bolsillos, saldos, total, cuadre, proximosPagos, cargando, error } =
    useFinanzas()
  const activos = bolsillos.filter((b) => b.activo)

  // Pagos que requieren atención (vencidos, hoy o dentro de 7 días).
  const pendientes = proximosPagos.filter((p) => p.diasRestantes <= 7)
  const totalPendiente = pendientes.reduce(
    (acc, p) => acc + (Number(p.gasto.monto) || 0),
    0,
  )

  return (
    <section>
      <h1 className="text-3xl font-bold text-slate-900">Mis Finanzas</h1>
      <p className="mt-1 text-slate-600">Bienvenido. Este es el resumen de tu dinero.</p>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {cargando && !bolsillos.length ? (
        <div className="mt-8 flex items-center gap-3 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
          Cargando…
        </div>
      ) : (
        <>
          {/* Patrimonio total */}
          <div className="mt-6 rounded-2xl bg-brand-500 p-6 text-white shadow-sm">
            <p className="text-sm text-brand-50">Patrimonio líquido</p>
            <p className="mt-1 text-3xl font-bold">{formatCOP(total)}</p>
            <p className="mt-2 text-xs text-brand-50">
              {cuadre.cuadrado
                ? '✓ Cuadrado'
                : `Descuadre: ${formatCOP(Math.abs(cuadre.diferencia))}`}
            </p>
          </div>

          {/* Indicador global de pagos próximos (≤ 7 días o vencidos) */}
          {pendientes.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Tienes <strong>{pendientes.length}</strong>{' '}
              {pendientes.length === 1 ? 'pago próximo' : 'pagos próximos'} por{' '}
              <strong>{formatCOP(totalPendiente)}</strong> en los próximos 7 días.
            </div>
          )}

          {/* Accesos rápidos */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link
              to="/ingreso"
              className="rounded-xl bg-brand-500 px-4 py-4 text-center text-base font-semibold text-white shadow-sm hover:bg-brand-600"
            >
              + Ingreso
            </Link>
            <Link
              to="/gasto"
              className="rounded-xl border border-slate-300 bg-white px-4 py-4 text-center text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              + Gasto
            </Link>
          </div>

          {/* Bolsillos en filas compactas */}
          <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Bolsillos
          </h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {activos.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="h-6 w-6 shrink-0 rounded-full"
                  style={{ backgroundColor: b.color }}
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm font-medium text-slate-800">
                  {b.nombre}
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {formatCOP(saldos.bolsillos[b.id] ?? 0)}
                </span>
              </li>
            ))}
          </ul>

          {/* Próximos pagos */}
          {proximosPagos.length > 0 && (
            <>
              <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Próximos pagos
              </h2>
              <ul className="space-y-2">
                {proximosPagos.map((p) => (
                  <FilaProximoPago key={p.gasto.id} pago={p} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  )
}

function FilaProximoPago({ pago }: { pago: ProximoPago }) {
  const { gasto, estado, diasRestantes, proximoPago } = pago
  const resaltar = estado === 'vencido' || estado === 'vence_hoy'
  return (
    <li
      className={[
        'flex items-center justify-between gap-3 rounded-xl border p-4 shadow-sm',
        resaltar ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
      ].join(' ')}
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{gasto.nombre}</p>
        <div className="mt-1 flex items-center gap-2">
          <BadgePago estado={estado} dias={diasRestantes} fecha={proximoPago} />
          <span className="text-sm text-slate-500">{formatCOP(gasto.monto)}</span>
        </div>
      </div>
      <Link
        to="/fijos"
        state={{ pagarId: gasto.id }}
        className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
      >
        Registrar pago
      </Link>
    </li>
  )
}

function BadgePago({
  estado,
  dias,
  fecha,
}: {
  estado: EstadoPago
  dias: number
  fecha: string
}) {
  const estilos: Record<EstadoPago, string> = {
    vencido: 'bg-red-100 text-red-700',
    vence_hoy: 'bg-amber-100 text-amber-700',
    proximo: 'bg-amber-50 text-amber-700',
    futuro: 'bg-slate-100 text-slate-600',
  }
  const texto =
    estado === 'vencido'
      ? 'Vencido'
      : estado === 'vence_hoy'
        ? 'Vence hoy'
        : estado === 'proximo'
          ? `En ${dias} ${dias === 1 ? 'día' : 'días'}`
          : fecha
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estilos[estado]}`}>
      {texto}
    </span>
  )
}
