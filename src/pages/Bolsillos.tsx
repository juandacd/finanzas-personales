import { useFinanzas } from '@/lib/FinanzasContext'
import { cicloActual, resumenCicloBolsillo } from '@/lib/calculos'
import { formatCOP } from '@/lib/format'
import type { BolsilloRow } from '@/types/sheets'

export default function Bolsillos() {
  const {
    bolsillos,
    saldos,
    total,
    cuadre,
    movimientos,
    reservas,
    disponibleReal,
    config,
    cargando,
    error,
  } = useFinanzas()
  // Los bolsillos tipo "meta" se gestionan en la página Metas, no aquí.
  const activos = bolsillos.filter((b) => b.activo && b.tipo !== 'meta')
  // Ciclo anclado al ingreso marcado como quincena (no al calendario).
  const ciclo = cicloActual(movimientos, new Date(), config)

  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Bolsillos</h1>

      {/* Resumen: total + cuadre */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Saldo total
          </p>
          <p className="text-2xl font-bold text-slate-900">{formatCOP(total)}</p>
        </div>
        {cuadre.cuadrado ? (
          <span className="rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
            ✓ Cuadrado
          </span>
        ) : (
          <span className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
            Descuadre: {formatCOP(Math.abs(cuadre.diferencia))}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {cargando && !bolsillos.length ? (
        <div className="mt-6 flex items-center gap-3 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
          Cargando bolsillos…
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {activos.map((b) => (
            <li
              key={b.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <span
                  className="h-10 w-10 shrink-0 rounded-full"
                  style={{ backgroundColor: b.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-slate-900">
                      {b.nombre}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {b.porcentaje}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{b.tipo}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-semibold text-slate-900">
                    {formatCOP(saldos.bolsillos[b.id] ?? 0)}
                  </p>
                  {(reservas[b.id] ?? 0) > 0 && (
                    <p className="text-xs font-medium text-amber-600">
                      Disp. real {formatCOP(disponibleReal[b.id] ?? 0)}
                    </p>
                  )}
                </div>
              </div>

              {(reservas[b.id] ?? 0) > 0 && (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                  Reservado para pagos fijos: {formatCOP(reservas[b.id] ?? 0)}
                </p>
              )}

              {b.tipo === 'gasto' && (
                <Velocimetro
                  bolsillo={b}
                  movimientos={movimientos}
                  ciclo={ciclo}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Velocimetro({
  bolsillo,
  movimientos,
  ciclo,
}: {
  bolsillo: BolsilloRow
  movimientos: ReturnType<typeof useFinanzas>['movimientos']
  ciclo: ReturnType<typeof cicloActual>
}) {
  const { ingresado, gastado } = resumenCicloBolsillo(
    movimientos,
    bolsillo.id,
    ciclo.inicio,
    ciclo.fin,
  )
  // Presupuesto de la quincena = lo que entró al bolsillo en el ciclo.
  const presupuesto = ingresado
  const pct =
    presupuesto > 0 ? Math.min(100, Math.round((gastado / presupuesto) * 100)) : 0
  const excedido = presupuesto > 0 && gastado > presupuesto

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Gasto de la quincena ({ciclo.etiqueta})</span>
        <span>
          {presupuesto > 0 ? `${pct}%` : 'sin presupuesto'}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={excedido ? 'h-full bg-red-500' : 'h-full bg-brand-500'}
          style={{ width: `${presupuesto > 0 ? pct : 0}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        Gastado {formatCOP(gastado)}
        {presupuesto > 0 && <> de {formatCOP(presupuesto)} que ingresó</>}
        {excedido && (
          <span className="font-medium text-red-600"> · te pasaste</span>
        )}
      </p>
    </div>
  )
}
