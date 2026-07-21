import { Link } from 'react-router-dom'
import { useFinanzas, type ProximoPago } from '@/lib/FinanzasContext'
import type { EstadoPago } from '@/lib/calculos'
import { formatCOP } from '@/lib/format'

/** Página de inicio / dashboard mínimo. */
export default function Inicio() {
  const {
    bolsillos,
    saldos,
    total,
    cuadre,
    proximosPagos,
    metas,
    prestamos,
    totalPorCobrar,
    cargando,
    error,
  } = useFinanzas()
  const activos = bolsillos.filter((b) => b.activo && b.tipo !== 'meta')
  const metasActivas = metas.filter((m) => !m.progreso.cumplida).slice(0, 3)

  const prestamosPendientes = prestamos.filter((p) => p.estado !== 'pagado')
  const prestamosTop = prestamosPendientes.slice(0, 3)

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
            {totalPorCobrar > 0 && (
              <p className="mt-2 border-t border-white/20 pt-2 text-xs text-brand-50">
                Patrimonio + por cobrar ={' '}
                <strong>{formatCOP(total + totalPorCobrar)}</strong>{' '}
                <span className="opacity-80">(dato informativo)</span>
              </p>
            )}
          </div>

          {/* Te deben (préstamos por cobrar) — NO forma parte del saldo real */}
          {prestamosPendientes.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Te deben
                  </p>
                  <p className="mt-0.5 text-2xl font-bold text-slate-900">
                    {formatCOP(totalPorCobrar)}
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    No incluido en tu saldo
                  </span>
                </div>
                <Link
                  to="/prestamos"
                  className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                >
                  Ver todos
                </Link>
              </div>

              <ul className="mt-3 space-y-2">
                {prestamosTop.map(({ prestamo, pendiente, estado }) => {
                  const vencido = estado === 'vencido'
                  return (
                    <li
                      key={prestamo.id}
                      className={[
                        'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm',
                        vencido ? 'border-red-300 bg-red-50' : 'border-slate-100',
                      ].join(' ')}
                    >
                      <span className="min-w-0 truncate font-medium text-slate-800">
                        {prestamo.persona}
                        {vencido && (
                          <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                            Vencido
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-900">
                        {formatCOP(pendiente)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

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

          {/* Metas (compacto) */}
          {metasActivas.length > 0 && (
            <>
              <div className="mb-2 mt-8 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Metas
                </h2>
                <Link to="/metas" className="text-xs font-medium text-brand-600 hover:underline">
                  Ver todas
                </Link>
              </div>
              <ul className="space-y-2">
                {metasActivas.map((mc) => {
                  const color = mc.bolsillo?.color ?? '#6366f1'
                  return (
                    <li
                      key={mc.meta.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium text-slate-800">
                          {mc.meta.nombre}
                        </span>
                        <span className="shrink-0 text-slate-500">
                          {formatCOP(mc.progreso.actual)} / {formatCOP(mc.progreso.objetivo)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${mc.progreso.porcentaje}%`, backgroundColor: color }}
                        />
                      </div>
                      <p className="mt-1 text-right text-xs text-slate-400">
                        {mc.progreso.porcentaje.toFixed(0)}%
                      </p>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

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
