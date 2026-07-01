import { useEffect, useMemo, useState } from 'react'
import { getRows, updateRow } from '@/lib/sheets'
import { useFinanzas } from '@/lib/FinanzasContext'
import { formatCOP } from '@/lib/format'
import type { BolsilloRow, CuentaRow } from '@/types/sheets'

/** Fila de datos junto con su número de fila en la hoja (para updateRow). */
interface ConFila<T> {
  row: T
  fila: number
}

/** Convierte texto libre en un entero (permite escribir "280.622" o "280622"). */
function parseMonto(texto: string): number {
  const limpio = texto.replace(/[^\d-]/g, '')
  if (limpio === '' || limpio === '-') return 0
  const n = Number(limpio)
  return Number.isFinite(n) ? n : 0
}

export default function SaldosIniciales() {
  const { refrescar } = useFinanzas()
  const [cuentas, setCuentas] = useState<ConFila<CuentaRow>[]>([])
  const [bolsillos, setBolsillos] = useState<ConFila<BolsilloRow>[]>([])
  /** id → texto del input de saldo_inicial. */
  const [valores, setValores] = useState<Record<string, string>>({})

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  function cargar() {
    setCargando(true)
    setError(null)
    Promise.all([getRows('Cuentas'), getRows('Bolsillos')])
      .then(([cs, bs]) => {
        const cuentasConFila = cs.map((row, i) => ({ row, fila: i + 2 }))
        const bolsillosConFila = bs.map((row, i) => ({ row, fila: i + 2 }))
        setCuentas(cuentasConFila)
        setBolsillos(bolsillosConFila)
        const inicial: Record<string, string> = {}
        for (const { row } of cuentasConFila) {
          inicial[row.id] = String(row.saldo_inicial ?? 0)
        }
        for (const { row } of bolsillosConFila) {
          inicial[row.id] = String(row.saldo_inicial ?? 0)
        }
        setValores(inicial)
      })
      .catch((e: unknown) =>
        setError(
          e instanceof Error ? e.message : 'No se pudieron cargar los saldos.',
        ),
      )
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [])

  const totalCuentas = useMemo(
    () => cuentas.reduce((acc, { row }) => acc + parseMonto(valores[row.id] ?? ''), 0),
    [cuentas, valores],
  )
  const totalBolsillos = useMemo(
    () =>
      bolsillos.reduce((acc, { row }) => acc + parseMonto(valores[row.id] ?? ''), 0),
    [bolsillos, valores],
  )
  const diferencia = totalCuentas - totalBolsillos
  const cuadrado = diferencia === 0

  function cambiarValor(id: string, texto: string) {
    setGuardadoOk(false)
    setValores((prev) => ({ ...prev, [id]: texto }))
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    setGuardadoOk(false)
    try {
      for (const { row, fila } of cuentas) {
        await updateRow('Cuentas', fila, {
          ...row,
          saldo_inicial: parseMonto(valores[row.id] ?? ''),
        })
      }
      for (const { row, fila } of bolsillos) {
        await updateRow('Bolsillos', fila, {
          ...row,
          saldo_inicial: parseMonto(valores[row.id] ?? ''),
        })
      }
      setGuardadoOk(true)
      cargar()
      // Propaga los cambios al store para que Inicio, Bolsillos, etc. se
      // actualicen de inmediato sin recargar la página.
      await refrescar()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudieron guardar los saldos.',
      )
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
        Cargando saldos…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cuentas */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Cuentas</h3>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {cuentas.map(({ row }) => (
            <FilaSaldo
              key={row.id}
              nombre={row.nombre}
              etiqueta={row.tipo}
              valor={valores[row.id] ?? ''}
              onChange={(t) => cambiarValor(row.id, t)}
            />
          ))}
        </div>
        <TotalLinea label="Total cuentas" valor={totalCuentas} />
      </div>

      {/* Bolsillos */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Bolsillos</h3>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {bolsillos.map(({ row }) => (
            <FilaSaldo
              key={row.id}
              nombre={row.nombre}
              color={row.color}
              valor={valores[row.id] ?? ''}
              onChange={(t) => cambiarValor(row.id, t)}
            />
          ))}
        </div>
        <TotalLinea label="Total bolsillos" valor={totalBolsillos} />
      </div>

      {/* Indicador de cuadre */}
      {cuadrado ? (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          ✓ Cuadrado — cuentas y bolsillos suman lo mismo ({formatCOP(totalCuentas)}).
        </div>
      ) : (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">
            Diferencia: {formatCOP(Math.abs(diferencia))}{' '}
            {diferencia > 0 ? '(sobra en cuentas)' : '(sobra en bolsillos)'}
          </p>
          <p className="mt-1">
            El total de cuentas debe ser igual al total de bolsillos.
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar saldos iniciales'}
        </button>
        {guardadoOk && !guardando && (
          <span className="text-sm font-medium text-green-700">
            ✓ Guardado
          </span>
        )}
      </div>
    </div>
  )
}

function FilaSaldo({
  nombre,
  etiqueta,
  color,
  valor,
  onChange,
}: {
  nombre: string
  etiqueta?: string
  color?: string
  valor: string
  onChange: (texto: string) => void
}) {
  const monto = parseMonto(valor)
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {color && (
        <span
          className="h-6 w-6 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{nombre}</p>
        {etiqueta && <p className="text-xs text-slate-400">{etiqueta}</p>}
      </div>
      <div className="text-right">
        <div className="flex items-center gap-1">
          <span className="text-slate-400">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="0"
          />
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{formatCOP(monto)}</p>
      </div>
    </div>
  )
}

function TotalLinea({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="mt-2 flex justify-between px-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{formatCOP(valor)}</span>
    </div>
  )
}
