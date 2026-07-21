import { useState } from 'react'
import { appendRow, generarId } from '@/lib/sheets'
import { useFinanzas } from '@/lib/FinanzasContext'
import { formatCOP, hoyLocal, parseMontoInput } from '@/lib/format'

export default function PrestamosIniciales() {
  const { prestamos, refrescar } = useFinanzas()

  const [persona, setPersona] = useState('')
  const [monto, setMonto] = useState('')
  const [fechaPrestamo, setFechaPrestamo] = useState(hoyLocal())
  const [fechaEsperada, setFechaEsperada] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const iniciales = prestamos.filter((p) => p.prestamo.tipo_registro === 'inicial')

  const montoNum = parseMontoInput(monto)
  const puede = persona.trim().length > 0 && montoNum > 0 && !guardando

  async function crear() {
    if (!puede) return
    setGuardando(true)
    setError(null)
    setOkMsg(null)
    try {
      await appendRow('Prestamos', {
        id: generarId(),
        persona: persona.trim(),
        monto: montoNum,
        fecha_prestamo: fechaPrestamo,
        fecha_esperada: fechaEsperada,
        monto_pagado: 0,
        estado: 'pendiente',
        tipo_registro: 'inicial',
        movimiento_id: '',
        notas: notas.trim(),
      })
      await refrescar()
      setPersona('')
      setMonto('')
      setFechaEsperada('')
      setNotas('')
      setOkMsg('Préstamo inicial agregado.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Dinero que ya te debían <strong>antes</strong> de usar la app. No descuenta
        saldo (esa plata salió antes). Cuando te paguen, regístralo en la página
        Préstamos y ahí sí entrará a tu cuenta.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          placeholder="Persona"
          className={inputCls}
        />
        <div className="flex items-center gap-1">
          <span className="text-slate-400">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="Monto"
            className={`${inputCls} text-right`}
          />
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Fecha del préstamo</span>
          <input
            type="date"
            value={fechaPrestamo}
            onChange={(e) => setFechaPrestamo(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Fecha esperada (opcional)</span>
          <input
            type="date"
            value={fechaEsperada}
            onChange={(e) => setFechaEsperada(e.target.value)}
            className={inputCls}
          />
        </label>
        <input
          type="text"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas (opcional)"
          className={`${inputCls} sm:col-span-2`}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={crear}
          disabled={!puede}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? 'Agregando…' : 'Agregar préstamo inicial'}
        </button>
        {okMsg && !guardando && (
          <span className="text-sm font-medium text-green-700">✓ {okMsg}</span>
        )}
      </div>

      {iniciales.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {iniciales.map(({ prestamo, pendiente }) => (
            <li
              key={prestamo.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-slate-800">
                {prestamo.persona}
              </span>
              <span className="shrink-0 text-slate-500">
                pendiente {formatCOP(pendiente)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
