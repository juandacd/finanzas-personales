import { useState } from 'react'
import { appendRow, deleteRowById, generarId, updateRowById } from '@/lib/sheets'
import { useFinanzas, type PrestamoCalculado } from '@/lib/FinanzasContext'
import type { EstadoPrestamoCalc } from '@/lib/calculos'
import { formatCOP, hoyLocal, parseMontoInput } from '@/lib/format'
import type { BolsilloRow, CuentaRow, EstadoPrestamo } from '@/types/sheets'

function badge(estado: EstadoPrestamoCalc): { texto: string; clase: string } {
  switch (estado) {
    case 'pagado':
      return { texto: 'Pagado', clase: 'bg-green-100 text-green-700' }
    case 'vencido':
      return { texto: 'Vencido', clase: 'bg-red-100 text-red-700' }
    case 'parcial':
      return { texto: 'Parcial', clase: 'bg-amber-100 text-amber-700' }
    default:
      return { texto: 'Pendiente', clase: 'bg-slate-100 text-slate-600' }
  }
}

/** Estado stored a partir del monto pagado. */
function estadoGuardado(pagado: number, monto: number): EstadoPrestamo {
  if (pagado >= monto && monto > 0) return 'pagado'
  if (pagado > 0) return 'parcial'
  return 'pendiente'
}

export default function Prestamos() {
  const { prestamos, totalPorCobrar, bolsillos, cuentas, saldos, refrescar, cargando } =
    useFinanzas()

  const [form, setForm] = useState<{ modo: 'nuevo' | 'editar'; pc?: PrestamoCalculado } | null>(
    null,
  )
  const [pagar, setPagar] = useState<PrestamoCalculado | null>(null)
  const [eliminar, setEliminar] = useState<PrestamoCalculado | null>(null)

  const activos = prestamos.filter((p) => p.estado !== 'pagado')
  const pagados = prestamos.filter((p) => p.estado === 'pagado')
  const nVencidos = activos.filter((p) => p.estado === 'vencido').length

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Préstamos</h1>
        <button
          type="button"
          onClick={() => setForm({ modo: 'nuevo' })}
          className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          + Préstamo
        </button>
      </div>

      {/* Total destacado */}
      <div className="mt-4 rounded-2xl bg-brand-500 p-6 text-white shadow-sm">
        <p className="text-sm text-brand-50">Te deben</p>
        <p className="mt-1 text-3xl font-bold">{formatCOP(totalPorCobrar)}</p>
        <p className="mt-2 text-xs text-brand-50">
          {activos.length} {activos.length === 1 ? 'préstamo pendiente' : 'préstamos pendientes'}
          {nVencidos > 0 && ` · ${nVencidos} vencido${nVencidos === 1 ? '' : 's'}`}
        </p>
      </div>

      {cargando && !prestamos.length ? (
        <div className="mt-6 flex items-center gap-3 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
          Cargando préstamos…
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {activos.map((pc) => (
              <TarjetaPrestamo
                key={pc.prestamo.id}
                pc={pc}
                onPagar={() => setPagar(pc)}
                onEditar={() => setForm({ modo: 'editar', pc })}
                onEliminar={() => setEliminar(pc)}
              />
            ))}
            {activos.length === 0 && (
              <li className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
                No tienes préstamos pendientes.
              </li>
            )}
          </ul>

          {pagados.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Pagados
              </h2>
              <ul className="space-y-3">
                {pagados.map((pc) => (
                  <TarjetaPrestamo
                    key={pc.prestamo.id}
                    pc={pc}
                    onPagar={() => setPagar(pc)}
                    onEditar={() => setForm({ modo: 'editar', pc })}
                    onEliminar={() => setEliminar(pc)}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {form && (
        <FormPrestamo
          modo={form.modo}
          pc={form.pc}
          bolsillos={bolsillos}
          cuentas={cuentas}
          saldos={saldos.bolsillos}
          saldosCuenta={saldos.cuentas}
          onCerrar={() => setForm(null)}
          onGuardado={async () => {
            await refrescar()
            setForm(null)
          }}
        />
      )}

      {pagar && (
        <RegistrarPago
          pc={pagar}
          bolsillos={bolsillos}
          cuentas={cuentas}
          onCerrar={() => setPagar(null)}
          onGuardado={async () => {
            await refrescar()
            setPagar(null)
          }}
        />
      )}

      {eliminar && (
        <EliminarPrestamo
          pc={eliminar}
          onCerrar={() => setEliminar(null)}
          onGuardado={async () => {
            await refrescar()
            setEliminar(null)
          }}
        />
      )}
    </section>
  )
}

function TarjetaPrestamo({
  pc,
  onPagar,
  onEditar,
  onEliminar,
}: {
  pc: PrestamoCalculado
  onPagar: () => void
  onEditar: () => void
  onEliminar: () => void
}) {
  const { prestamo, pendiente, estado } = pc
  const b = badge(estado)
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{prestamo.persona}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Prestado {formatCOP(prestamo.monto)}
            {prestamo.fecha_esperada && <> · vence {prestamo.fecha_esperada.slice(0, 10)}</>}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${b.clase}`}>
          {b.texto}
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-600">
        Pagado {formatCOP(Number(prestamo.monto_pagado) || 0)} ·{' '}
        {estado === 'pagado' ? (
          <span className="font-medium text-green-700">saldado</span>
        ) : (
          <>te faltan cobrar <strong>{formatCOP(pendiente)}</strong></>
        )}
      </p>
      {prestamo.notas && (
        <p className="mt-1 text-xs text-slate-400">{prestamo.notas}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {estado !== 'pagado' && (
          <button
            type="button"
            onClick={onPagar}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Registrar pago
          </button>
        )}
        <button
          type="button"
          onClick={onEditar}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onEliminar}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Eliminar
        </button>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Crear / editar
// ---------------------------------------------------------------------------

function FormPrestamo({
  modo,
  pc,
  bolsillos,
  cuentas,
  saldos,
  saldosCuenta,
  onCerrar,
  onGuardado,
}: {
  modo: 'nuevo' | 'editar'
  pc?: PrestamoCalculado
  bolsillos: BolsilloRow[]
  cuentas: CuentaRow[]
  saldos: Record<string, number>
  saldosCuenta: Record<string, number>
  onCerrar: () => void
  onGuardado: () => void | Promise<void>
}) {
  const p = pc?.prestamo
  const origenes = bolsillos.filter((b) => b.activo && b.tipo !== 'meta')
  const cuentasActivas = cuentas.filter((c) => c.activo)

  const [persona, setPersona] = useState(p?.persona ?? '')
  const [monto, setMonto] = useState(p ? String(p.monto) : '')
  const [fechaPrestamo, setFechaPrestamo] = useState(
    p?.fecha_prestamo?.slice(0, 10) ?? hoyLocal(),
  )
  const [fechaEsperada, setFechaEsperada] = useState(p?.fecha_esperada?.slice(0, 10) ?? '')
  const [notas, setNotas] = useState(p?.notas ?? '')
  const [bolsilloId, setBolsilloId] = useState(origenes[0]?.id ?? '')
  const [cuentaId, setCuentaId] = useState(cuentasActivas[0]?.id ?? '')
  const [confirmarExceso, setConfirmarExceso] = useState(false)

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const montoNum = parseMontoInput(monto)
  const saldoBolsillo = saldos[bolsilloId] ?? 0
  const seExcede = modo === 'nuevo' && montoNum > saldoBolsillo

  const errores: string[] = []
  if (!persona.trim()) errores.push('Escribe a quién le prestaste.')
  if (montoNum <= 0) errores.push('Ingresa un monto mayor a 0.')
  if (modo === 'nuevo') {
    if (!bolsilloId) errores.push('Selecciona el bolsillo de origen.')
    if (!cuentaId) errores.push('Selecciona la cuenta de origen.')
    if (seExcede && !confirmarExceso)
      errores.push('Confirma que quieres pasarte del saldo del bolsillo.')
  }
  const puede = errores.length === 0 && !guardando

  async function guardar() {
    if (!puede) return
    setGuardando(true)
    setError(null)
    try {
      if (modo === 'nuevo') {
        const movId = generarId()
        // 1) Movimiento de otorgamiento (resta bolsillo y cuenta).
        await appendRow('Movimientos', {
          id: movId,
          fecha: fechaPrestamo,
          tipo: 'prestamo_otorgado',
          monto: montoNum,
          bolsillo_id: bolsilloId,
          bolsillo_destino_id: '',
          cuenta_id: cuentaId,
          cuenta_destino_id: '',
          categoria_id: '',
          descripcion: `Préstamo a ${persona.trim()}`,
          gasto_fijo_id: '',
          origen: 'manual',
          conciliado: false,
          grupo_id: '',
          es_quincena: false,
        })
        // 2) Fila en Prestamos.
        await appendRow('Prestamos', {
          id: generarId(),
          persona: persona.trim(),
          monto: montoNum,
          fecha_prestamo: fechaPrestamo,
          fecha_esperada: fechaEsperada,
          monto_pagado: 0,
          estado: 'pendiente',
          tipo_registro: 'en_app',
          movimiento_id: movId,
          notas: notas.trim(),
        })
      } else if (p) {
        // Editar: solo campos de la ficha (no toca movimientos/saldos).
        await updateRowById('Prestamos', p.id, {
          ...p,
          persona: persona.trim(),
          monto: montoNum,
          fecha_prestamo: fechaPrestamo,
          fecha_esperada: fechaEsperada,
          notas: notas.trim(),
          estado: estadoGuardado(Number(p.monto_pagado) || 0, montoNum),
        })
      }
      await onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el préstamo.')
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={modo === 'nuevo' ? 'Nuevo préstamo' : 'Editar préstamo'}>
      <div className="space-y-4">
        <Campo label="Persona">
          <input
            type="text"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="¿A quién le prestaste?"
            className={inputCls}
          />
        </Campo>

        <Campo label="Monto (COP)">
          <input
            type="text"
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            className={`${inputCls} text-right`}
          />
          {montoNum > 0 && (
            <p className="mt-1 text-right text-xs text-slate-400">{formatCOP(montoNum)}</p>
          )}
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Fecha del préstamo">
            <input
              type="date"
              value={fechaPrestamo}
              onChange={(e) => setFechaPrestamo(e.target.value)}
              className={inputCls}
            />
          </Campo>
          <Campo label="Fecha esperada (opcional)">
            <input
              type="date"
              value={fechaEsperada}
              onChange={(e) => setFechaEsperada(e.target.value)}
              className={inputCls}
            />
          </Campo>
        </div>

        {modo === 'nuevo' && (
          <>
            <Campo label="Bolsillo de origen">
              <select
                value={bolsilloId}
                onChange={(e) => setBolsilloId(e.target.value)}
                className={inputCls}
              >
                {origenes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre} — {formatCOP(saldos[b.id] ?? 0)}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Cuenta de origen">
              <select
                value={cuentaId}
                onChange={(e) => setCuentaId(e.target.value)}
                className={inputCls}
              >
                {cuentasActivas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} — {formatCOP(saldosCuenta[c.id] ?? 0)}
                  </option>
                ))}
              </select>
            </Campo>
            {seExcede && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-800">
                  El bolsillo solo tiene {formatCOP(saldoBolsillo)}.
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
          </>
        )}

        <Campo label="Notas (opcional)">
          <input
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className={inputCls}
          />
        </Campo>
      </div>

      {error && <Alerta>{error}</Alerta>}
      <Acciones
        onCancelar={onCerrar}
        onConfirmar={guardar}
        cargando={guardando}
        deshabilitado={!puede}
        textoConfirmar="Guardar"
      />
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Registrar pago (abono) → prestamo_devuelto
// ---------------------------------------------------------------------------

function RegistrarPago({
  pc,
  bolsillos,
  cuentas,
  onCerrar,
  onGuardado,
}: {
  pc: PrestamoCalculado
  bolsillos: BolsilloRow[]
  cuentas: CuentaRow[]
  onCerrar: () => void
  onGuardado: () => void | Promise<void>
}) {
  const { prestamo, pendiente } = pc
  const destinosBolsillo = bolsillos.filter((b) => b.activo && b.tipo !== 'meta')
  const cuentasActivas = cuentas.filter((c) => c.activo)

  const [monto, setMonto] = useState(String(pendiente))
  const [bolsilloId, setBolsilloId] = useState(destinosBolsillo[0]?.id ?? '')
  const [cuentaId, setCuentaId] = useState(cuentasActivas[0]?.id ?? '')
  const [fecha, setFecha] = useState(hoyLocal())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const montoNum = parseMontoInput(monto)
  const errores: string[] = []
  if (montoNum <= 0) errores.push('Ingresa un monto mayor a 0.')
  if (!bolsilloId) errores.push('Selecciona el bolsillo destino.')
  if (!cuentaId) errores.push('Selecciona la cuenta destino.')
  const puede = errores.length === 0 && !guardando

  async function confirmar() {
    if (!puede) return
    setGuardando(true)
    setError(null)
    try {
      // 1) Movimiento de devolución (suma bolsillo y cuenta).
      await appendRow('Movimientos', {
        id: generarId(),
        fecha,
        tipo: 'prestamo_devuelto',
        monto: montoNum,
        bolsillo_id: bolsilloId,
        bolsillo_destino_id: '',
        cuenta_id: cuentaId,
        cuenta_destino_id: '',
        categoria_id: '',
        descripcion: `Abono de ${prestamo.persona}`,
        gasto_fijo_id: '',
        origen: 'manual',
        conciliado: false,
        grupo_id: '',
        es_quincena: false,
      })
      // 2) Actualiza el préstamo.
      const monto = Number(prestamo.monto) || 0
      const nuevoPagado = (Number(prestamo.monto_pagado) || 0) + montoNum
      await updateRowById('Prestamos', prestamo.id, {
        ...prestamo,
        monto_pagado: nuevoPagado,
        estado: estadoGuardado(nuevoPagado, monto),
      })
      await onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el pago.')
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={`Registrar pago de ${pc.prestamo.persona}`}>
      <p className="text-sm text-slate-500">
        Registra lo que te devolvieron. Suma a tu bolsillo y cuenta destino.
      </p>
      <div className="mt-4 space-y-4">
        <Campo label="Monto del abono (COP)">
          <input
            type="text"
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className={`${inputCls} text-right`}
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {formatCOP(montoNum)} · pendiente {formatCOP(pendiente)}
          </p>
        </Campo>
        <Campo label="Cuenta destino">
          <select
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
            className={inputCls}
          >
            {cuentasActivas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Bolsillo destino">
          <select
            value={bolsilloId}
            onChange={(e) => setBolsilloId(e.target.value)}
            className={inputCls}
          >
            {destinosBolsillo.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Fecha">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={inputCls}
          />
        </Campo>
      </div>

      {error && <Alerta>{error}</Alerta>}
      <Acciones
        onCancelar={onCerrar}
        onConfirmar={confirmar}
        cargando={guardando}
        deshabilitado={!puede}
        textoConfirmar="Confirmar pago"
      />
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Eliminar
// ---------------------------------------------------------------------------

function EliminarPrestamo({
  pc,
  onCerrar,
  onGuardado,
}: {
  pc: PrestamoCalculado
  onCerrar: () => void
  onGuardado: () => void | Promise<void>
}) {
  const { prestamo } = pc
  const puedeRevertir =
    prestamo.tipo_registro === 'en_app' && !!prestamo.movimiento_id
  const [revertir, setRevertir] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    setGuardando(true)
    setError(null)
    try {
      // Opción: revertir el movimiento de otorgamiento (la plata vuelve al saldo).
      if (puedeRevertir && revertir) {
        await deleteRowById('Movimientos', prestamo.movimiento_id)
      }
      await deleteRowById('Prestamos', prestamo.id)
      await onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el préstamo.')
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Eliminar préstamo">
      <p className="text-sm text-slate-600">
        {prestamo.persona} · {formatCOP(prestamo.monto)}
      </p>

      {puedeRevertir ? (
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={revertir}
              onChange={(e) => setRevertir(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-400"
            />
            <span>
              Revertir también el movimiento de otorgamiento, para que{' '}
              {formatCOP(prestamo.monto)} <strong>vuelvan a tu saldo</strong>. Si no
              lo marcas, solo se borra el registro y la plata queda como gastada.
            </span>
          </label>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Este préstamo es un registro inicial (no descontó saldo). Solo se borrará
          la ficha.
        </p>
      )}

      {error && <Alerta>{error}</Alerta>}
      <Acciones
        onCancelar={onCerrar}
        onConfirmar={confirmar}
        cargando={guardando}
        deshabilitado={guardando}
        textoConfirmar="Eliminar"
        peligro
      />
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// UI compartida
// ---------------------------------------------------------------------------

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

function Modal({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{titulo}</h2>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

function Alerta({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>
  )
}

function Acciones({
  onCancelar,
  onConfirmar,
  cargando,
  deshabilitado,
  textoConfirmar,
  peligro,
}: {
  onCancelar: () => void
  onConfirmar: () => void
  cargando: boolean
  deshabilitado: boolean
  textoConfirmar: string
  peligro?: boolean
}) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancelar}
        disabled={cargando}
        className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onConfirmar}
        disabled={deshabilitado}
        className={[
          'rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50',
          peligro ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-500 hover:bg-brand-600',
        ].join(' ')}
      >
        {cargando ? 'Guardando…' : textoConfirmar}
      </button>
    </div>
  )
}
