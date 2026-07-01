import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { appendRow, generarId } from '@/lib/sheets'
import { calcularReparto } from '@/lib/calculos'
import { useFinanzas } from '@/lib/FinanzasContext'
import { formatCOP, hoyLocal, parseMontoInput } from '@/lib/format'
import type { MovimientoRow } from '@/types/sheets'

type Modo = 'reparto' | 'completo'

export default function RegistrarIngreso() {
  const navigate = useNavigate()
  const { bolsillos: bolsillosAll, cuentas: cuentasAll, categorias: categoriasAll, refrescar } =
    useFinanzas()

  const cuentas = useMemo(() => cuentasAll.filter((c) => c.activo), [cuentasAll])
  const bolsillos = useMemo(
    () => bolsillosAll.filter((b) => b.activo),
    [bolsillosAll],
  )
  const categorias = useMemo(
    () => categoriasAll.filter((c) => c.tipo === 'ingreso'),
    [categoriasAll],
  )

  const [monto, setMonto] = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const [fecha, setFecha] = useState(hoyLocal())
  const [categoriaId, setCategoriaId] = useState('')
  const [descripcion, setDescripcion] = useState('')

  const [modo, setModo] = useState<Modo>('reparto')
  const [reparto, setReparto] = useState<Record<string, string>>({})
  const [repartoEditado, setRepartoEditado] = useState(false)
  const [bolsilloCompletoId, setBolsilloCompletoId] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  const montoNum = parseMontoInput(monto)

  // Valores por defecto cuando llegan los datos del store.
  useEffect(() => {
    if (!cuentaId && cuentas[0]) setCuentaId(cuentas[0].id)
  }, [cuentas, cuentaId])
  useEffect(() => {
    if (!bolsilloCompletoId && bolsillos[0]) setBolsilloCompletoId(bolsillos[0].id)
  }, [bolsillos, bolsilloCompletoId])

  // Recalcula el reparto automático al cambiar el monto (si no se editó a mano).
  useEffect(() => {
    if (bolsillos.length === 0 || repartoEditado) return
    const auto = calcularReparto(montoNum, bolsillos)
    const texto: Record<string, string> = {}
    for (const b of bolsillos) texto[b.id] = String(auto[b.id] ?? 0)
    setReparto(texto)
  }, [montoNum, bolsillos, repartoEditado])

  const sumaReparto = useMemo(
    () => bolsillos.reduce((acc, b) => acc + parseMontoInput(reparto[b.id] ?? ''), 0),
    [bolsillos, reparto],
  )
  const diferenciaReparto = montoNum - sumaReparto

  function cambiarReparto(id: string, texto: string) {
    setRepartoEditado(true)
    setReparto((prev) => ({ ...prev, [id]: texto }))
  }

  function restablecerReparto() {
    setRepartoEditado(false)
    const auto = calcularReparto(montoNum, bolsillos)
    const texto: Record<string, string> = {}
    for (const b of bolsillos) texto[b.id] = String(auto[b.id] ?? 0)
    setReparto(texto)
  }

  const errores: string[] = []
  if (montoNum <= 0) errores.push('Ingresa un monto mayor a 0.')
  if (!cuentaId) errores.push('Selecciona la cuenta destino.')
  if (modo === 'reparto' && montoNum > 0 && diferenciaReparto !== 0) {
    errores.push('La suma del reparto debe ser igual al monto total.')
  }
  if (modo === 'completo' && !bolsilloCompletoId) {
    errores.push('Selecciona el bolsillo destino.')
  }
  const puedeGuardar = errores.length === 0 && !guardando

  function nuevoMovimiento(
    bolsilloId: string,
    montoMov: number,
    grupoId: string,
  ): MovimientoRow {
    return {
      id: generarId(),
      fecha,
      tipo: 'ingreso',
      monto: montoMov,
      bolsillo_id: bolsilloId,
      bolsillo_destino_id: '',
      cuenta_id: cuentaId,
      cuenta_destino_id: '',
      categoria_id: categoriaId,
      descripcion,
      gasto_fijo_id: '',
      origen: 'manual',
      conciliado: false,
      grupo_id: grupoId,
    }
  }

  async function confirmar() {
    if (!puedeGuardar) return
    setGuardando(true)
    setErrorGuardar(null)
    try {
      if (modo === 'reparto') {
        const grupoId = generarId()
        const entradas = bolsillos
          .map((b) => ({ id: b.id, monto: parseMontoInput(reparto[b.id] ?? '') }))
          .filter((e) => e.monto !== 0)
        for (const e of entradas) {
          await appendRow('Movimientos', nuevoMovimiento(e.id, e.monto, grupoId))
        }
      } else {
        await appendRow(
          'Movimientos',
          nuevoMovimiento(bolsilloCompletoId, montoNum, ''),
        )
      }
      await refrescar()
      navigate('/movimientos', { state: { okMsg: 'Ingreso registrado.' } })
    } catch (e) {
      setErrorGuardar(
        e instanceof Error ? e.message : 'No se pudo guardar el ingreso.',
      )
      setGuardando(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <Link to="/movimientos" className="text-sm text-brand-600 hover:underline">
          ← Movimientos
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Registrar ingreso
        </h1>
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

        <Campo label="Cuenta destino">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </Campo>

          <Campo label="Categoría (opcional)">
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— Sin categoría —</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <Campo label="Descripción / nota (opcional)">
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Quincena junio"
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </Campo>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          <BotonToggle activo={modo === 'reparto'} onClick={() => setModo('reparto')}>
            Repartir automático por %
          </BotonToggle>
          <BotonToggle activo={modo === 'completo'} onClick={() => setModo('completo')}>
            Entra completo a un bolsillo
          </BotonToggle>
        </div>

        {modo === 'reparto' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Previsualización del reparto</p>
              <button
                type="button"
                onClick={restablecerReparto}
                className="text-xs text-brand-600 hover:underline"
              >
                Recalcular por %
              </button>
            </div>

            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {bolsillos.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    className="h-6 w-6 shrink-0 rounded-full"
                    style={{ backgroundColor: b.color }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {b.nombre}
                    </p>
                    <p className="text-xs text-slate-400">{b.porcentaje}%</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={reparto[b.id] ?? ''}
                        onChange={(e) => cambiarReparto(b.id, e.target.value)}
                        className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatCOP(parseMontoInput(reparto[b.id] ?? ''))}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div
              className={[
                'flex justify-between rounded-lg px-3 py-2 text-sm',
                diferenciaReparto === 0
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700',
              ].join(' ')}
            >
              <span>Suma del reparto</span>
              <span className="font-semibold">
                {formatCOP(sumaReparto)}
                {diferenciaReparto !== 0 &&
                  ` (faltan ${formatCOP(diferenciaReparto)})`}
              </span>
            </div>
          </div>
        ) : (
          <Campo label="Bolsillo destino">
            <select
              value={bolsilloCompletoId}
              onChange={(e) => setBolsilloCompletoId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {bolsillos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
            {montoNum > 0 && bolsilloCompletoId && (
              <p className="mt-2 text-sm text-slate-500">
                Entrarán {formatCOP(montoNum)} a{' '}
                <strong>
                  {bolsillos.find((b) => b.id === bolsilloCompletoId)?.nombre}
                </strong>
                .
              </p>
            )}
          </Campo>
        )}
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
          {guardando ? 'Guardando…' : 'Confirmar ingreso'}
        </button>
        <Link
          to="/movimientos"
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

function BotonToggle({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-md px-3 py-2 text-xs font-medium transition-colors',
        activo
          ? 'bg-white text-brand-700 shadow-sm'
          : 'text-slate-500 hover:text-slate-700',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
