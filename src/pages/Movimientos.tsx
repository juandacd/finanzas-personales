import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { deleteRowById, deleteRowsByIds } from '@/lib/sheets'
import { useFinanzas } from '@/lib/FinanzasContext'
import { formatCOP } from '@/lib/format'
import type { MovimientoRow, TipoMovimiento } from '@/types/sheets'

interface EstiloTipo {
  etiqueta: string
  icono: string
  color: string
  /** Signo aplicado al monto: 1 positivo (verde), -1 negativo (rojo), 0 neutro. */
  signo: 1 | -1 | 0
}

const ESTILOS: Record<TipoMovimiento, EstiloTipo> = {
  ingreso: { etiqueta: 'Ingreso', icono: '↑', color: 'text-green-600', signo: 1 },
  egreso: { etiqueta: 'Egreso', icono: '↓', color: 'text-red-600', signo: -1 },
  transferencia_cuenta: {
    etiqueta: 'Transf. cuenta',
    icono: '↔',
    color: 'text-blue-600',
    signo: 0,
  },
  transferencia_bolsillo: {
    etiqueta: 'Transf. bolsillo',
    icono: '⇄',
    color: 'text-purple-600',
    signo: 0,
  },
  ajuste: { etiqueta: 'Ajuste', icono: '⚙', color: 'text-slate-500', signo: 0 },
  prestamo_otorgado: {
    etiqueta: 'Préstamo otorgado',
    icono: '↗',
    color: 'text-orange-600',
    signo: -1,
  },
  prestamo_devuelto: {
    etiqueta: 'Préstamo devuelto',
    icono: '↙',
    color: 'text-teal-600',
    signo: 1,
  },
}

export default function Movimientos() {
  const location = useLocation()
  const stateMsg = (location.state as { okMsg?: string } | null)?.okMsg ?? null
  const [okMsg, setOkMsg] = useState<string | null>(stateMsg)

  const { movimientos, bolsillos, nombreDe, refrescar, cargando, error } =
    useFinanzas()

  const [filtroTipo, setFiltroTipo] = useState<'' | TipoMovimiento>('')
  const [filtroBolsillo, setFiltroBolsillo] = useState('')
  const [confirmar, setConfirmar] = useState<MovimientoRow | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null)

  const lista = useMemo(() => {
    return movimientos
      .filter((m) => (filtroTipo ? m.tipo === filtroTipo : true))
      .filter((m) =>
        filtroBolsillo
          ? m.bolsillo_id === filtroBolsillo ||
            m.bolsillo_destino_id === filtroBolsillo
          : true,
      )
      .slice()
      .sort((a, b) => {
        const fa = (a.fecha || '').slice(0, 10)
        const fb = (b.fecha || '').slice(0, 10)
        if (fa !== fb) return fa < fb ? 1 : -1
        return a.id < b.id ? 1 : -1
      })
  }, [movimientos, filtroTipo, filtroBolsillo])

  const grupoDe = (m: MovimientoRow): MovimientoRow[] =>
    m.grupo_id ? movimientos.filter((x) => x.grupo_id === m.grupo_id) : [m]

  async function borrar(soloEste: boolean) {
    if (!confirmar) return
    setBorrando(true)
    setErrorBorrar(null)
    try {
      if (!soloEste && confirmar.grupo_id) {
        const ids = grupoDe(confirmar).map((m) => m.id)
        await deleteRowsByIds('Movimientos', ids)
      } else {
        await deleteRowById('Movimientos', confirmar.id)
      }
      await refrescar()
      setConfirmar(null)
      setOkMsg('Movimiento eliminado.')
    } catch (e) {
      setErrorBorrar(
        e instanceof Error ? e.message : 'No se pudo borrar el movimiento.',
      )
    } finally {
      setBorrando(false)
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Movimientos</h1>
        <div className="flex gap-2">
          <Link
            to="/ingreso"
            className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            + Ingreso
          </Link>
          <Link
            to="/gasto"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Gasto
          </Link>
        </div>
      </div>

      {okMsg && (
        <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          ✓ {okMsg}
        </p>
      )}

      {/* Filtros */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as '' | TipoMovimiento)}
          className="min-w-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">Todos los tipos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
          <option value="transferencia_cuenta">Transf. cuenta</option>
          <option value="transferencia_bolsillo">Transf. bolsillo</option>
          <option value="ajuste">Ajustes</option>
        </select>
        <select
          value={filtroBolsillo}
          onChange={(e) => setFiltroBolsillo(e.target.value)}
          className="min-w-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">Todos los bolsillos</option>
          {bolsillos.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {cargando && !movimientos.length ? (
        <div className="mt-6 flex items-center gap-3 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
          Cargando movimientos…
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {lista.map((m) => {
            const est = ESTILOS[m.tipo]
            const signo = est.signo
            const prefijo = signo > 0 ? '+' : signo < 0 ? '−' : ''
            const colorMonto =
              signo > 0
                ? 'text-green-600'
                : signo < 0
                  ? 'text-red-600'
                  : 'text-slate-700'
            return (
              <li
                key={m.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-bold ${est.color}`}>
                        {est.icono}
                      </span>
                      <p className="truncate font-medium text-slate-900">
                        {m.descripcion || nombreDe(m.categoria_id) || est.etiqueta}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {(m.fecha || '').slice(0, 10)} · {est.etiqueta}
                    </p>
                    <p className="text-xs text-slate-400">
                      {descripcionMov(m, nombreDe)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-semibold ${colorMonto}`}>
                      {prefijo}
                      {formatCOP(m.monto)}
                    </p>
                    <div className="mt-1 flex justify-end gap-2 text-xs">
                      <Link
                        to={`/movimientos/${m.id}/editar`}
                        className="text-brand-600 hover:underline"
                      >
                        Editar
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setErrorBorrar(null)
                          setConfirmar(m)
                        }}
                        className="text-red-600 hover:underline"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}

          {lista.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
              No hay movimientos que coincidan.
            </li>
          )}
        </ul>
      )}

      {/* Modal de confirmación de borrado */}
      {confirmar && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">
              Borrar movimiento
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {confirmar.descripcion || ESTILOS[confirmar.tipo].etiqueta} ·{' '}
              {formatCOP(confirmar.monto)}
            </p>

            {confirmar.grupo_id && grupoDe(confirmar).length > 1 ? (
              <>
                <p className="mt-4 text-sm text-slate-500">
                  Este movimiento es parte de un ingreso repartido en{' '}
                  {grupoDe(confirmar).length} bolsillos. ¿Qué quieres borrar?
                </p>
                {errorBorrar && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {errorBorrar}
                  </p>
                )}
                <div className="mt-5 space-y-2">
                  <button
                    type="button"
                    onClick={() => borrar(false)}
                    disabled={borrando}
                    className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Borrar todo el grupo ({grupoDe(confirmar).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => borrar(true)}
                    disabled={borrando}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Solo esta porción
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmar(null)}
                    disabled={borrando}
                    className="w-full px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm text-slate-500">
                  Esta acción no se puede deshacer.
                </p>
                {errorBorrar && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {errorBorrar}
                  </p>
                )}
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmar(null)}
                    disabled={borrando}
                    className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => borrar(true)}
                    disabled={borrando}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {borrando ? 'Borrando…' : 'Borrar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

/** Texto secundario: bolsillo(s), cuenta(s) y categoría de un movimiento. */
function descripcionMov(
  m: MovimientoRow,
  nombreDe: (id: string) => string,
): string {
  const partes: string[] = []
  switch (m.tipo) {
    case 'transferencia_cuenta':
      partes.push(`${nombreDe(m.cuenta_id)} → ${nombreDe(m.cuenta_destino_id)}`)
      break
    case 'transferencia_bolsillo':
      partes.push(
        `${nombreDe(m.bolsillo_id)} → ${nombreDe(m.bolsillo_destino_id)}`,
      )
      break
    default:
      if (m.bolsillo_id) partes.push(nombreDe(m.bolsillo_id))
      if (m.cuenta_id) partes.push(nombreDe(m.cuenta_id))
      if (m.categoria_id) partes.push(nombreDe(m.categoria_id))
  }
  return partes.filter(Boolean).join(' · ')
}
