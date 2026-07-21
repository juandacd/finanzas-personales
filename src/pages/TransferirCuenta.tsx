import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { appendRow, generarId } from '@/lib/sheets'
import { useFinanzas } from '@/lib/FinanzasContext'
import { formatCOP, hoyLocal, parseMontoInput } from '@/lib/format'
import type { MovimientoRow } from '@/types/sheets'

export default function TransferirCuenta() {
  const navigate = useNavigate()
  const { cuentas: cuentasAll, saldos, refrescar } = useFinanzas()
  const cuentas = useMemo(() => cuentasAll.filter((c) => c.activo), [cuentasAll])

  const [monto, setMonto] = useState('')
  const [origenId, setOrigenId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [fecha, setFecha] = useState(hoyLocal())
  const [descripcion, setDescripcion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  const montoNum = parseMontoInput(monto)

  useEffect(() => {
    if (!origenId && cuentas[0]) setOrigenId(cuentas[0].id)
  }, [cuentas, origenId])
  useEffect(() => {
    if (!destinoId && cuentas[1]) setDestinoId(cuentas[1].id)
  }, [cuentas, destinoId])

  const errores: string[] = []
  if (montoNum <= 0) errores.push('Ingresa un monto mayor a 0.')
  if (!origenId) errores.push('Selecciona la cuenta de origen.')
  if (!destinoId) errores.push('Selecciona la cuenta de destino.')
  if (origenId && destinoId && origenId === destinoId) {
    errores.push('La cuenta de origen y destino deben ser distintas.')
  }
  const puedeGuardar = errores.length === 0 && !guardando

  async function confirmar() {
    if (!puedeGuardar) return
    setGuardando(true)
    setErrorGuardar(null)
    try {
      const movimiento: MovimientoRow = {
        id: generarId(),
        fecha,
        tipo: 'transferencia_cuenta',
        monto: montoNum,
        bolsillo_id: '',
        bolsillo_destino_id: '',
        cuenta_id: origenId,
        cuenta_destino_id: destinoId,
        categoria_id: '',
        descripcion,
        gasto_fijo_id: '',
        origen: 'manual',
        conciliado: false,
        grupo_id: '',
        es_quincena: false,
      }
      await appendRow('Movimientos', movimiento)
      await refrescar()
      navigate('/cuentas', { state: { okMsg: 'Transferencia registrada.' } })
    } catch (e) {
      setErrorGuardar(
        e instanceof Error ? e.message : 'No se pudo registrar la transferencia.',
      )
      setGuardando(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <Link to="/cuentas" className="text-sm text-brand-600 hover:underline">
          ← Cuentas
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Transferir / Retiro entre cuentas
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Mueve dinero de una cuenta a otra. No afecta los bolsillos.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <Campo label="Monto (COP)">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-right text-lg font-medium focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {montoNum > 0 && (
            <p className="mt-1 text-right text-xs text-slate-400">
              {formatCOP(montoNum)}
            </p>
          )}
        </Campo>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Desde (origen)">
            <select
              value={origenId}
              onChange={(e) => setOrigenId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} — {formatCOP(saldos.cuentas[c.id] ?? 0)}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Hacia (destino)">
            <select
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} — {formatCOP(saldos.cuentas[c.id] ?? 0)}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </Campo>

          <Campo label="Descripción / nota (opcional)">
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Retiro cajero"
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </Campo>
        </div>
      </div>

      {errorGuardar && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorGuardar}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={confirmar}
          disabled={!puedeGuardar}
          className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Confirmar transferencia'}
        </button>
        <Link
          to="/cuentas"
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          Cancelar
        </Link>
      </div>
      {!guardando && errores.length > 0 && montoNum > 0 && (
        <p className="text-xs text-slate-400">{errores[0]}</p>
      )}
    </section>
  )
}

function Campo({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}
