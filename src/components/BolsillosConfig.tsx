import { useEffect, useMemo, useState } from 'react'
import { appendRow, deleteRowById, generarId, updateRowById } from '@/lib/sheets'
import { useFinanzas } from '@/lib/FinanzasContext'
import { formatCOP, hoyLocal } from '@/lib/format'
import type { BolsilloRow, TipoBolsillo } from '@/types/sheets'

const PALETA = [
  '#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9',
]

/** Porcentaje desde texto (admite decimales con , o .). */
function parsePct(t: string): number {
  const s = t.replace(',', '.').replace(/[^\d.]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

interface Draft {
  key: string
  id: string
  nombre: string
  porcentaje: string
  color: string
  tipo: TipoBolsillo
  nuevo: boolean
  original?: BolsilloRow
}

function aDraft(b: BolsilloRow): Draft {
  return {
    key: b.id,
    id: b.id,
    nombre: b.nombre,
    porcentaje: String(b.porcentaje),
    color: b.color,
    tipo: b.tipo,
    nuevo: false,
    original: b,
  }
}

export default function BolsillosConfig() {
  const { bolsillos, movimientos, saldos, refrescar } = useFinanzas()

  // Solo bolsillos que participan en el reparto: activos y no-meta.
  const participantes = useMemo(
    () => bolsillos.filter((b) => b.activo && b.tipo !== 'meta'),
    [bolsillos],
  )

  const [filas, setFilas] = useState<Draft[]>(() => participantes.map(aDraft))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [aEliminar, setAEliminar] = useState<Draft | null>(null)

  // Re-sincroniza cuando cambian los bolsillos del store (tras guardar/eliminar).
  const firmaIds = participantes.map((b) => b.id).join(',')
  useEffect(() => {
    setFilas(participantes.map(aDraft))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaIds])

  const sumaPct = filas.reduce((a, f) => a + parsePct(f.porcentaje), 0)
  const sumaOk = Math.abs(sumaPct - 100) < 0.001
  const tieneGasto = filas.some((f) => f.tipo === 'gasto')
  const puedeGuardar = sumaOk && tieneGasto && !guardando

  function cambiar(key: string, campo: keyof Draft, valor: string) {
    setOkMsg(null)
    setFilas((prev) =>
      prev.map((f) => (f.key === key ? { ...f, [campo]: valor } : f)),
    )
  }

  function agregar() {
    setOkMsg(null)
    setFilas((prev) => [
      ...prev,
      {
        key: generarId(),
        id: generarId(),
        nombre: '',
        porcentaje: '0',
        color: PALETA[prev.length % PALETA.length],
        tipo: 'acumula',
        nuevo: true,
      },
    ])
  }

  function quitarNuevo(key: string) {
    setFilas((prev) => prev.filter((f) => f.key !== key))
  }

  async function guardar() {
    if (!puedeGuardar) return
    if (filas.some((f) => !f.nombre.trim())) {
      setError('Todos los bolsillos deben tener nombre.')
      return
    }
    setGuardando(true)
    setError(null)
    setOkMsg(null)
    try {
      for (const f of filas) {
        const pct = parsePct(f.porcentaje)
        if (f.nuevo) {
          const nuevo: BolsilloRow = {
            id: f.id,
            nombre: f.nombre.trim(),
            porcentaje: pct,
            tipo: f.tipo,
            color: f.color,
            saldo_inicial: 0,
            activo: true,
          }
          await appendRow('Bolsillos', nuevo)
        } else if (f.original) {
          const o = f.original
          const cambio =
            o.nombre !== f.nombre.trim() ||
            o.porcentaje !== pct ||
            o.color !== f.color ||
            o.tipo !== f.tipo
          if (cambio) {
            await updateRowById('Bolsillos', f.id, {
              ...o,
              nombre: f.nombre.trim(),
              porcentaje: pct,
              color: f.color,
              tipo: f.tipo,
            })
          }
        }
      }
      await refrescar()
      setOkMsg('Cambios guardados.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar los cambios.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Cambiar un porcentaje solo afecta el reparto de <strong>ingresos futuros</strong>;
        los movimientos ya registrados no se recalculan (son históricos).
      </p>

      <div className="space-y-2">
        {filas.map((f) => (
          <div
            key={f.key}
            className="rounded-lg border border-slate-200 p-3"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input
                type="text"
                value={f.nombre}
                onChange={(e) => cambiar(f.key, 'nombre', e.target.value)}
                placeholder="Nombre"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={f.porcentaje}
                  onChange={(e) => cambiar(f.key, 'porcentaje', e.target.value)}
                  className="w-20 rounded-md border border-slate-300 px-2 py-2 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-400">%</span>
              </div>
              <select
                value={f.tipo}
                onChange={(e) => cambiar(f.key, 'tipo', e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="acumula">acumula</option>
                <option value="gasto">gasto</option>
              </select>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                {PALETA.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => cambiar(f.key, 'color', c)}
                    className={[
                      'h-5 w-5 rounded-full',
                      f.color === c ? 'ring-2 ring-slate-900 ring-offset-1' : '',
                    ].join(' ')}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  f.nuevo ? quitarNuevo(f.key) : setAEliminar(f)
                }
                className="text-xs font-medium text-red-600 hover:underline"
              >
                {f.nuevo ? 'Quitar' : 'Eliminar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={agregar}
        className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
      >
        + Agregar bolsillo
      </button>

      {/* Indicador de suma de porcentajes */}
      <div
        className={[
          'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium',
          sumaOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
        ].join(' ')}
      >
        <span>Suma de porcentajes (reparto)</span>
        <span>
          {sumaOk
            ? `✓ ${sumaPct.toFixed(sumaPct % 1 === 0 ? 0 : 1)}%`
            : `${sumaPct.toFixed(sumaPct % 1 === 0 ? 0 : 1)}% (debe ser 100%)`}
        </span>
      </div>

      {!tieneGasto && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Debe existir al menos un bolsillo tipo <strong>gasto</strong> (lo usan el
          velocímetro y las estadísticas de ritmo).
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={!puedeGuardar}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {okMsg && !guardando && (
          <span className="text-sm font-medium text-green-700">✓ {okMsg}</span>
        )}
      </div>

      {aEliminar && aEliminar.original && (
        <ModalEliminar
          bolsillo={aEliminar.original}
          bolsillos={bolsillos}
          saldo={saldos.bolsillos[aEliminar.id] ?? 0}
          tieneMovimientos={movimientos.some(
            (m) =>
              m.bolsillo_id === aEliminar.id ||
              m.bolsillo_destino_id === aEliminar.id,
          )}
          esUltimoGasto={
            aEliminar.original.tipo === 'gasto' &&
            participantes.filter((b) => b.tipo === 'gasto').length <= 1
          }
          onCerrar={() => setAEliminar(null)}
          onHecho={async () => {
            await refrescar()
            setAEliminar(null)
          }}
        />
      )}
    </div>
  )
}

function ModalEliminar({
  bolsillo,
  bolsillos,
  saldo,
  tieneMovimientos,
  esUltimoGasto,
  onCerrar,
  onHecho,
}: {
  bolsillo: BolsilloRow
  bolsillos: BolsilloRow[]
  saldo: number
  tieneMovimientos: boolean
  esUltimoGasto: boolean
  onCerrar: () => void
  onHecho: () => void | Promise<void>
}) {
  const destinos = bolsillos.filter(
    (b) => b.activo && b.tipo !== 'meta' && b.id !== bolsillo.id,
  )
  const [destinoId, setDestinoId] = useState(destinos[0]?.id ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debeMover = saldo > 0
  const borradoFisico = saldo === 0 && !tieneMovimientos
  const puede = !esUltimoGasto && (!debeMover || !!destinoId) && !guardando

  async function confirmar() {
    if (!puede) return
    setGuardando(true)
    setError(null)
    try {
      if (debeMover) {
        await appendRow('Movimientos', {
          id: generarId(),
          fecha: hoyLocal(),
          tipo: 'transferencia_bolsillo',
          monto: saldo,
          bolsillo_id: bolsillo.id,
          bolsillo_destino_id: destinoId,
          cuenta_id: '',
          cuenta_destino_id: '',
          categoria_id: '',
          descripcion: `Cierre de bolsillo ${bolsillo.nombre}`,
          gasto_fijo_id: '',
          origen: 'manual',
          conciliado: false,
          grupo_id: '',
          es_quincena: false,
        })
      }
      if (borradoFisico) {
        await deleteRowById('Bolsillos', bolsillo.id)
      } else {
        // Conserva el historial: se marca inactivo (con saldo ya en 0).
        await updateRowById('Bolsillos', bolsillo.id, { ...bolsillo, activo: false })
      }
      await onHecho()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el bolsillo.')
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">Eliminar bolsillo</h2>
        <p className="mt-2 text-sm text-slate-600">{bolsillo.nombre}</p>

        {esUltimoGasto ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No puedes eliminarlo: es el único bolsillo de tipo <strong>gasto</strong>.
            Crea otro de tipo gasto primero.
          </p>
        ) : (
          <>
            {debeMover ? (
              <>
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Tiene {formatCOP(saldo)} guardados. Se moverán a otro bolsillo
                  antes de eliminarlo (no se pierde dinero).
                </p>
                <label className="mt-3 block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Mover el saldo a
                  </span>
                  <select
                    value={destinoId}
                    onChange={(e) => setDestinoId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {destinos.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : borradoFisico ? (
              <p className="mt-3 text-sm text-slate-500">
                No tiene saldo ni movimientos. Se eliminará por completo.
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No tiene saldo pero sí movimientos históricos. Se marcará como
                inactivo para conservar el historial.
              </p>
            )}
          </>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Cancelar
          </button>
          {!esUltimoGasto && (
            <button
              type="button"
              onClick={confirmar}
              disabled={!puede}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {guardando ? 'Eliminando…' : 'Eliminar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
