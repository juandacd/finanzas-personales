import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { updateRowById } from '@/lib/sheets'
import { useFinanzas } from '@/lib/FinanzasContext'
import { formatCOP, parseMontoInput } from '@/lib/format'
import type { MovimientoRow } from '@/types/sheets'

export default function EditarMovimiento() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { movimientos, bolsillos, cuentas, categorias, refrescar } = useFinanzas()

  const original = useMemo(
    () => movimientos.find((m) => m.id === id) ?? null,
    [movimientos, id],
  )

  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [bolsilloId, setBolsilloId] = useState('')
  const [bolsilloDestinoId, setBolsilloDestinoId] = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const [cuentaDestinoId, setCuentaDestinoId] = useState('')

  const [inicializado, setInicializado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  useEffect(() => {
    if (original && !inicializado) {
      setMonto(String(original.monto))
      setFecha((original.fecha || '').slice(0, 10))
      setDescripcion(original.descripcion)
      setCategoriaId(original.categoria_id)
      setBolsilloId(original.bolsillo_id)
      setBolsilloDestinoId(original.bolsillo_destino_id)
      setCuentaId(original.cuenta_id)
      setCuentaDestinoId(original.cuenta_destino_id)
      setInicializado(true)
    }
  }, [original, inicializado])

  if (!original) {
    return (
      <section className="space-y-4">
        <Link to="/movimientos" className="text-sm text-brand-600 hover:underline">
          ← Movimientos
        </Link>
        <p className="text-sm text-slate-500">
          No se encontró el movimiento. Puede que se haya borrado.
        </p>
      </section>
    )
  }

  const tipo = original.tipo
  const montoNum = parseMontoInput(monto)
  const categoriasTipo = categorias.filter((c) =>
    tipo === 'ingreso' ? c.tipo === 'ingreso' : c.tipo === 'egreso',
  )

  const errores: string[] = []
  if (montoNum <= 0) errores.push('Ingresa un monto mayor a 0.')
  if (tipo === 'transferencia_cuenta' && cuentaId === cuentaDestinoId) {
    errores.push('Las cuentas deben ser distintas.')
  }
  if (tipo === 'transferencia_bolsillo' && bolsilloId === bolsilloDestinoId) {
    errores.push('Los bolsillos deben ser distintos.')
  }
  const puedeGuardar = errores.length === 0 && !guardando

  async function guardar() {
    if (!puedeGuardar || !original) return
    setGuardando(true)
    setErrorGuardar(null)
    try {
      const actualizado: MovimientoRow = {
        ...original,
        monto: montoNum,
        fecha,
        descripcion,
        categoria_id: categoriaId,
        bolsillo_id: bolsilloId,
        bolsillo_destino_id: bolsilloDestinoId,
        cuenta_id: cuentaId,
        cuenta_destino_id: cuentaDestinoId,
      }
      await updateRowById('Movimientos', original.id, actualizado)
      await refrescar()
      navigate('/movimientos', { state: { okMsg: 'Movimiento actualizado.' } })
    } catch (e) {
      setErrorGuardar(
        e instanceof Error ? e.message : 'No se pudo guardar el cambio.',
      )
      setGuardando(false)
    }
  }

  const usaBolsilloOrigen =
    tipo === 'ingreso' ||
    tipo === 'egreso' ||
    tipo === 'ajuste' ||
    tipo === 'transferencia_bolsillo'
  const usaCuentaOrigen =
    tipo === 'ingreso' ||
    tipo === 'egreso' ||
    tipo === 'ajuste' ||
    tipo === 'transferencia_cuenta'

  return (
    <section className="space-y-6">
      <div>
        <Link to="/movimientos" className="text-sm text-brand-600 hover:underline">
          ← Movimientos
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Editar movimiento
        </h1>
        <p className="mt-1 text-sm text-slate-500">Tipo: {tipo}</p>
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-right text-lg font-medium focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {montoNum > 0 && (
            <p className="mt-1 text-right text-xs text-slate-400">
              {formatCOP(montoNum)}
            </p>
          )}
        </Campo>

        <Campo label="Fecha">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </Campo>

        {usaBolsilloOrigen && (
          <Campo
            label={
              tipo === 'transferencia_bolsillo' ? 'Bolsillo origen' : 'Bolsillo'
            }
          >
            <select
              value={bolsilloId}
              onChange={(e) => setBolsilloId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {bolsillos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}

        {tipo === 'transferencia_bolsillo' && (
          <Campo label="Bolsillo destino">
            <select
              value={bolsilloDestinoId}
              onChange={(e) => setBolsilloDestinoId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {bolsillos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}

        {usaCuentaOrigen && (
          <Campo
            label={tipo === 'transferencia_cuenta' ? 'Cuenta origen' : 'Cuenta'}
          >
            <select
              value={cuentaId}
              onChange={(e) => setCuentaId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}

        {tipo === 'transferencia_cuenta' && (
          <Campo label="Cuenta destino">
            <select
              value={cuentaDestinoId}
              onChange={(e) => setCuentaDestinoId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}

        {(tipo === 'ingreso' || tipo === 'egreso') && (
          <Campo label="Categoría">
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— Sin categoría —</option>
              {categoriasTipo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}

        <Campo label="Descripción / nota">
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </Campo>
      </div>

      {errorGuardar && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorGuardar}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={!puedeGuardar}
          className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <Link
          to="/movimientos"
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          Cancelar
        </Link>
      </div>
      {!guardando && errores.length > 0 && (
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
