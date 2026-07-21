import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  appendRow,
  deleteRowById,
  generarId,
  updateRowById,
} from '@/lib/sheets'
import {
  calcularProximoPago,
  estadoGastoFijo,
  type EstadoPago,
} from '@/lib/calculos'
import { useFinanzas } from '@/lib/FinanzasContext'
import { formatCOP, hoyLocal, parseMontoInput } from '@/lib/format'
import type { GastoFijoRow, MovimientoRow } from '@/types/sheets'

const FRECUENCIAS = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'anual', label: 'Anual' },
]

const DIAS_SEMANA = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

function frecuenciaLegible(gf: GastoFijoRow): string {
  const dia = Number(gf.dia) || 0
  switch (gf.frecuencia) {
    case 'mensual':
      return `Mensual, día ${dia}`
    case 'quincenal':
      return `Quincenal, día ${dia}`
    case 'semanal':
      return `Semanal, ${DIAS_SEMANA[((dia % 7) + 7) % 7] ?? '—'}`
    case 'anual':
      return `Anual, día ${dia}`
    default:
      return gf.frecuencia
  }
}

function Badge({ estado, dias, fecha }: { estado: EstadoPago; dias: number; fecha: string }) {
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

export default function Fijos() {
  const { gastosFijos, bolsillos, nombreDe, refrescar } = useFinanzas()

  const [form, setForm] = useState<{ modo: 'nuevo' | 'editar'; gasto?: GastoFijoRow } | null>(
    null,
  )
  const [pago, setPago] = useState<GastoFijoRow | null>(null)
  const [confirmar, setConfirmar] = useState<GastoFijoRow | null>(null)

  // Abre el modal de pago si llegamos desde "Próximos pagos" (Inicio).
  const location = useLocation()
  const pagarId = (location.state as { pagarId?: string } | null)?.pagarId
  useEffect(() => {
    if (pagarId) {
      const gf = gastosFijos.find((g) => g.id === pagarId)
      if (gf) setPago(gf)
      // Limpia el state para que no reabra al navegar de vuelta.
      window.history.replaceState({}, '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagarId, gastosFijos.length])
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const hoy = useMemo(() => new Date(), [])
  const lista = useMemo(() => {
    return gastosFijos
      .map((gf) => ({ gf, est: estadoGastoFijo(gf, hoy) }))
      .sort((a, b) => (a.est.proximoPago < b.est.proximoPago ? -1 : 1))
  }, [gastosFijos, hoy])

  async function toggleActivo(gf: GastoFijoRow) {
    setOcupadoId(gf.id)
    setErrorAccion(null)
    try {
      await updateRowById('GastosFijos', gf.id, { ...gf, activo: !gf.activo })
      await refrescar()
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No se pudo actualizar.')
    } finally {
      setOcupadoId(null)
    }
  }

  async function eliminar() {
    if (!confirmar) return
    setOcupadoId(confirmar.id)
    setErrorAccion(null)
    try {
      await deleteRowById('GastosFijos', confirmar.id)
      await refrescar()
      setConfirmar(null)
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No se pudo eliminar.')
    } finally {
      setOcupadoId(null)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Gastos fijos</h1>
        <button
          type="button"
          onClick={() => setForm({ modo: 'nuevo' })}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          + Gasto fijo
        </button>
      </div>

      {errorAccion && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorAccion}
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {lista.map(({ gf, est }) => {
          const bolsillo = bolsillos.find((b) => b.id === gf.bolsillo_id)
          return (
            <li
              key={gf.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{gf.nombre}</p>
                    <Badge estado={est.estado} dias={est.diasRestantes} fecha={est.proximoPago} />
                    {!gf.activo && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                        inactivo
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {frecuenciaLegible(gf)} · próximo {est.proximoPago}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    {bolsillo && (
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: bolsillo.color }}
                          aria-hidden="true"
                        />
                        {bolsillo.nombre}
                      </span>
                    )}
                    {gf.categoria_id && <span>· {nombreDe(gf.categoria_id)}</span>}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-semibold text-slate-900">{formatCOP(gf.monto)}</p>
                  <div className="mt-2 flex items-center justify-end gap-3">
                    <Switch
                      activo={gf.activo}
                      disabled={ocupadoId === gf.id}
                      onChange={() => toggleActivo(gf)}
                    />
                  </div>
                  <div className="mt-2 flex justify-end gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setForm({ modo: 'editar', gasto: gf })}
                      className="text-brand-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorAccion(null)
                        setConfirmar(gf)
                      }}
                      className="text-red-600 hover:underline"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              </div>

              {gf.activo && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setPago(gf)}
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
                  >
                    Registrar pago
                  </button>
                </div>
              )}
            </li>
          )
        })}

        {lista.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            Aún no hay gastos fijos. Agrega el primero.
          </li>
        )}
      </ul>

      {form && (
        <FormularioGastoFijo
          modo={form.modo}
          gasto={form.gasto}
          onCerrar={() => setForm(null)}
          onGuardado={async () => {
            await refrescar()
            setForm(null)
          }}
        />
      )}

      {pago && (
        <RegistrarPago
          gasto={pago}
          onCerrar={() => setPago(null)}
          onGuardado={async () => {
            await refrescar()
            setPago(null)
          }}
        />
      )}

      {confirmar && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">
              Borrar gasto fijo
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {confirmar.nombre} · {formatCOP(confirmar.monto)}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Esta acción no se puede deshacer.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmar(null)}
                disabled={ocupadoId === confirmar.id}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={eliminar}
                disabled={ocupadoId === confirmar.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {ocupadoId === confirmar.id ? 'Borrando…' : 'Borrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Switch({
  activo,
  disabled,
  onChange,
}: {
  activo: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={onChange}
      className={[
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50',
        activo ? 'bg-brand-500' : 'bg-slate-300',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          activo ? 'translate-x-4' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  )
}

function FormularioGastoFijo({
  modo,
  gasto,
  onCerrar,
  onGuardado,
}: {
  modo: 'nuevo' | 'editar'
  gasto?: GastoFijoRow
  onCerrar: () => void
  onGuardado: () => void | Promise<void>
}) {
  const { bolsillos: bolsillosAll, categorias } = useFinanzas()
  const bolsillos = bolsillosAll.filter((b) => b.activo)
  const categoriasEgreso = categorias.filter((c) => c.tipo === 'egreso')

  const [nombre, setNombre] = useState(gasto?.nombre ?? '')
  const [monto, setMonto] = useState(gasto ? String(gasto.monto) : '')
  const [frecuencia, setFrecuencia] = useState(gasto?.frecuencia ?? 'mensual')
  const [dia, setDia] = useState<number>(gasto ? Number(gasto.dia) || 1 : 1)
  const [bolsilloId, setBolsilloId] = useState(
    gasto?.bolsillo_id ?? bolsillos[0]?.id ?? '',
  )
  const [categoriaId, setCategoriaId] = useState(gasto?.categoria_id ?? '')
  const [activo, setActivo] = useState(gasto ? gasto.activo : true)

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const montoNum = parseMontoInput(monto)
  const esSemanal = frecuencia === 'semanal'

  const proximoPreview = calcularProximoPago(frecuencia, dia, new Date())

  const errores: string[] = []
  if (!nombre.trim()) errores.push('Escribe un nombre.')
  if (montoNum <= 0) errores.push('Ingresa un monto mayor a 0.')
  if (!bolsilloId) errores.push('Selecciona el bolsillo de origen.')
  const puedeGuardar = errores.length === 0 && !guardando

  async function guardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    setError(null)
    try {
      const proximo = calcularProximoPago(frecuencia, dia, new Date())
      if (modo === 'nuevo') {
        const fila: GastoFijoRow = {
          id: generarId(),
          nombre: nombre.trim(),
          monto: montoNum,
          frecuencia,
          dia,
          bolsillo_id: bolsilloId,
          categoria_id: categoriaId,
          activo,
          proximo_pago: proximo,
          ultimo_pago: '',
        }
        await appendRow('GastosFijos', fila)
      } else if (gasto) {
        const fila: GastoFijoRow = {
          ...gasto,
          nombre: nombre.trim(),
          monto: montoNum,
          frecuencia,
          dia,
          bolsillo_id: bolsilloId,
          categoria_id: categoriaId,
          activo,
          proximo_pago: proximo,
        }
        await updateRowById('GastosFijos', gasto.id, fila)
      }
      await onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">
          {modo === 'nuevo' ? 'Nuevo gasto fijo' : 'Editar gasto fijo'}
        </h2>

        <div className="mt-4 space-y-4">
          <Campo label="Nombre">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Deuda universidad"
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </Campo>

          <Campo label="Monto (COP)">
            <div className="flex items-center gap-1">
              <span className="text-slate-400">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-right focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            {montoNum > 0 && (
              <p className="mt-1 text-right text-xs text-slate-400">
                {formatCOP(montoNum)}
              </p>
            )}
          </Campo>

          <div className="grid grid-cols-2 gap-4">
            <Campo label="Frecuencia">
              <select
                value={frecuencia}
                onChange={(e) => setFrecuencia(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {FRECUENCIAS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label={esSemanal ? 'Día de la semana' : 'Día'}>
              {esSemanal ? (
                <select
                  value={dia}
                  onChange={(e) => setDia(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {DIAS_SEMANA.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dia}
                  onChange={(e) => setDia(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              )}
            </Campo>
          </div>
          <p className="-mt-2 text-xs text-slate-400">
            {esSemanal
              ? 'Se pagará cada semana ese día.'
              : frecuencia === 'quincenal'
                ? 'Día del mes; también se paga 15 días después (acotado a fin de mes).'
                : frecuencia === 'anual'
                  ? 'Día del mes; una vez al año.'
                  : 'Día del mes (1–31). Si el mes no lo tiene, se usa el último día.'}
            {' '}Próximo pago: <strong>{proximoPreview}</strong>
          </p>

          <Campo label="Bolsillo de origen">
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

          <Campo label="Categoría de egreso (opcional)">
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— Sin categoría —</option>
              {categoriasEgreso.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="h-4 w-4 rounded border-slate-400"
            />
            Activo
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
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
          <button
            type="button"
            onClick={guardar}
            disabled={!puedeGuardar}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Fecha del día siguiente a una fecha ISO yyyy-mm-dd (como Date local). */
function diaSiguiente(fechaISO: string): Date {
  const [y, m, d] = fechaISO.split('-').map(Number)
  return new Date(y, (m || 1) - 1, (d || 1) + 1)
}

function RegistrarPago({
  gasto,
  onCerrar,
  onGuardado,
}: {
  gasto: GastoFijoRow
  onCerrar: () => void
  onGuardado: () => void | Promise<void>
}) {
  const { bolsillos: bolsillosAll, cuentas: cuentasAll, saldos } = useFinanzas()
  const bolsillos = bolsillosAll.filter((b) => b.activo)
  const cuentas = cuentasAll.filter((c) => c.activo)

  const [monto, setMonto] = useState(String(gasto.monto))
  const [bolsilloId, setBolsilloId] = useState(gasto.bolsillo_id)
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '')
  const [fecha, setFecha] = useState(hoyLocal())
  const [nota, setNota] = useState('')
  const [confirmarExceso, setConfirmarExceso] = useState(false)

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const montoNum = parseMontoInput(monto)
  const saldoDisponible = saldos.bolsillos[bolsilloId] ?? 0
  const exceso = montoNum - saldoDisponible
  const seExcede = montoNum > 0 && exceso > 0

  const errores: string[] = []
  if (montoNum <= 0) errores.push('Ingresa un monto mayor a 0.')
  if (!bolsilloId) errores.push('Selecciona el bolsillo de origen.')
  if (!cuentaId) errores.push('Selecciona la cuenta de origen.')
  if (seExcede && !confirmarExceso) {
    errores.push('Confirma que quieres pasarte del saldo del bolsillo.')
  }
  const puedeGuardar = errores.length === 0 && !guardando

  async function confirmar() {
    if (!puedeGuardar) return
    setGuardando(true)
    setError(null)
    try {
      // 1) Egreso real, con gasto_fijo_id para trazabilidad.
      const egreso: MovimientoRow = {
        id: generarId(),
        fecha,
        tipo: 'egreso',
        monto: montoNum,
        bolsillo_id: bolsilloId,
        bolsillo_destino_id: '',
        cuenta_id: cuentaId,
        cuenta_destino_id: '',
        categoria_id: gasto.categoria_id,
        descripcion: nota.trim() || gasto.nombre,
        gasto_fijo_id: gasto.id,
        origen: 'manual',
        conciliado: false,
        grupo_id: '',
        es_quincena: false,
      }
      await appendRow('Movimientos', egreso)

      // 2) Avanza el gasto fijo: último pago = fecha; próximo pago = siguiente ciclo.
      //    Se calcula desde el día siguiente al POSTERIOR entre la fecha de pago
      //    y el próximo pago vigente, para que el ciclo avance aunque se pague
      //    anticipadamente (si no, pagar antes de la fecha lo dejaría igual).
      const proximoActual = gasto.proximo_pago?.slice(0, 10) || fecha
      const baseAvance = fecha > proximoActual ? fecha : proximoActual
      const proximo = calcularProximoPago(
        gasto.frecuencia,
        Number(gasto.dia) || 1,
        diaSiguiente(baseAvance),
      )
      await updateRowById('GastosFijos', gasto.id, {
        ...gasto,
        ultimo_pago: fecha,
        proximo_pago: proximo,
      })

      // 3) Refresca el store.
      await onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el pago.')
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">Registrar pago</h2>
        <p className="mt-1 text-sm text-slate-500">{gasto.nombre}</p>

        <div className="mt-4 space-y-4">
          <Campo label="Monto (COP)">
            <div className="flex items-center gap-1">
              <span className="text-slate-400">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-right focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <p className="mt-1 text-right text-xs text-slate-400">
              {formatCOP(montoNum)} · sugerido {formatCOP(gasto.monto)}
            </p>
          </Campo>

          <Campo label="Bolsillo de origen">
            <select
              value={bolsilloId}
              onChange={(e) => setBolsilloId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {bolsillos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre} — disponible {formatCOP(saldos.bolsillos[b.id] ?? 0)}
                </option>
              ))}
            </select>
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

          <div className="grid grid-cols-2 gap-4">
            <Campo label="Fecha de pago">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </Campo>
            <Campo label="Nota (opcional)">
              <input
                type="text"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder={gasto.nombre}
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </Campo>
          </div>

          {seExcede && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800">
                Te pasas del saldo de este bolsillo por {formatCOP(exceso)}.
              </p>
              <label className="mt-2 flex items-center gap-2 text-sm text-amber-800">
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
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
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
          <button
            type="button"
            onClick={confirmar}
            disabled={!puedeGuardar}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? 'Registrando…' : 'Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
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
