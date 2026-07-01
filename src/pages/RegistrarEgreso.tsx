import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { appendRow, generarId } from '@/lib/sheets'
import { useFinanzas } from '@/lib/FinanzasContext'
import { formatCOP, hoyLocal, parseMontoInput } from '@/lib/format'
import type { MovimientoRow } from '@/types/sheets'

export default function RegistrarEgreso() {
  const navigate = useNavigate()
  const {
    bolsillos: bolsillosAll,
    cuentas: cuentasAll,
    categorias: categoriasAll,
    saldos,
    reservas,
    disponibleReal,
    refrescar,
  } = useFinanzas()

  const cuentas = useMemo(() => cuentasAll.filter((c) => c.activo), [cuentasAll])
  const bolsillos = useMemo(
    () => bolsillosAll.filter((b) => b.activo),
    [bolsillosAll],
  )
  const categorias = useMemo(
    () => categoriasAll.filter((c) => c.tipo === 'egreso'),
    [categoriasAll],
  )

  const [monto, setMonto] = useState('')
  const [bolsilloId, setBolsilloId] = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [fecha, setFecha] = useState(hoyLocal())
  const [descripcion, setDescripcion] = useState('')
  const [confirmarExceso, setConfirmarExceso] = useState(false)

  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  const montoNum = parseMontoInput(monto)

  useEffect(() => {
    if (!bolsilloId && bolsillos[0]) setBolsilloId(bolsillos[0].id)
  }, [bolsillos, bolsilloId])
  useEffect(() => {
    if (!cuentaId && cuentas[0]) setCuentaId(cuentas[0].id)
  }, [cuentas, cuentaId])

  const saldoBolsillo = saldos.bolsillos[bolsilloId] ?? 0
  const reservado = reservas[bolsilloId] ?? 0
  const dispReal = disponibleReal[bolsilloId] ?? saldoBolsillo
  // La advertencia se basa en el disponible real (saldo − reservado).
  const exceso = montoNum - dispReal
  const seExcede = montoNum > 0 && exceso > 0
  // ¿El exceso es solo sobre lo reservado (pero aún hay saldo real)?
  const usaReservado = seExcede && montoNum <= saldoBolsillo

  useEffect(() => {
    if (!seExcede && confirmarExceso) setConfirmarExceso(false)
  }, [seExcede, confirmarExceso])

  const errores: string[] = []
  if (montoNum <= 0) errores.push('Ingresa un monto mayor a 0.')
  if (!bolsilloId) errores.push('Selecciona el bolsillo de origen.')
  if (!cuentaId) errores.push('Selecciona la cuenta de origen.')
  if (!categoriaId) errores.push('Selecciona la categoría de egreso.')
  if (seExcede && !confirmarExceso) {
    errores.push('Confirma que quieres usar plata reservada o pasarte del saldo.')
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
        tipo: 'egreso',
        monto: montoNum,
        bolsillo_id: bolsilloId,
        bolsillo_destino_id: '',
        cuenta_id: cuentaId,
        cuenta_destino_id: '',
        categoria_id: categoriaId,
        descripcion,
        gasto_fijo_id: '',
        origen: 'manual',
        conciliado: false,
        grupo_id: '',
      }
      await appendRow('Movimientos', movimiento)
      await refrescar()
      navigate('/movimientos', { state: { okMsg: 'Gasto registrado.' } })
    } catch (e) {
      setErrorGuardar(
        e instanceof Error ? e.message : 'No se pudo guardar el gasto.',
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
          Registrar gasto
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

        <Campo label="Bolsillo de origen">
          <select
            value={bolsilloId}
            onChange={(e) => setBolsilloId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {bolsillos.map((b) => {
              const r = reservas[b.id] ?? 0
              const dr = disponibleReal[b.id] ?? (saldos.bolsillos[b.id] ?? 0)
              return (
                <option key={b.id} value={b.id}>
                  {b.nombre} — disp. real {formatCOP(dr)}
                  {r > 0 ? ` (saldo ${formatCOP(saldos.bolsillos[b.id] ?? 0)})` : ''}
                </option>
              )
            })}
          </select>
          {bolsilloId && (
            <p className="mt-1 text-xs text-slate-500">
              Disponible real: {formatCOP(dispReal)}
              {reservado > 0 && (
                <>
                  {' '}· saldo {formatCOP(saldoBolsillo)} · reservado{' '}
                  {formatCOP(reservado)}
                </>
              )}
            </p>
          )}
        </Campo>

        <Campo label="Cuenta de origen">
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
          <Campo label="Categoría de egreso">
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— Selecciona —</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </Campo>
        </div>

        <Campo label="Descripción / nota (opcional)">
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Mercado de la semana"
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </Campo>
      </div>

      {seExcede && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          {usaReservado ? (
            <>
              <p className="text-sm font-medium text-amber-800">
                Estás usando plata reservada para pagos fijos.
              </p>
              <p className="mt-1 text-sm text-amber-700">
                Disponible real {formatCOP(dispReal)} (saldo{' '}
                {formatCOP(saldoBolsillo)} − reservado {formatCOP(reservado)}).
                Te pasas del disponible por {formatCOP(exceso)}.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-amber-800">
                Te pasas del saldo de este bolsillo por{' '}
                {formatCOP(montoNum - saldoBolsillo)}.
              </p>
              <p className="mt-1 text-sm text-amber-700">
                Saldo {formatCOP(saldoBolsillo)} · gasto {formatCOP(montoNum)}.
              </p>
            </>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm text-amber-800">
            <input
              type="checkbox"
              checked={confirmarExceso}
              onChange={(e) => setConfirmarExceso(e.target.checked)}
              className="h-4 w-4 rounded border-amber-400"
            />
            Continuar de todas formas.
          </label>
        </div>
      )}

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
          {guardando ? 'Guardando…' : 'Confirmar gasto'}
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
