import { useState } from 'react'
import { appendRow, deleteRowById, generarId, updateRowById } from '@/lib/sheets'
import { useFinanzas, type MetaCalculada } from '@/lib/FinanzasContext'
import { formatCOP, hoyLocal, parseMontoInput } from '@/lib/format'
import type { BolsilloRow, CuentaRow, EstadoMeta } from '@/types/sheets'

const PALETA = [
  '#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9',
]

export default function Metas() {
  const { metas, bolsillos, cuentas, saldos, disponibleReal, refrescar, cargando } =
    useFinanzas()

  const [form, setForm] = useState<{ modo: 'nuevo' | 'editar'; mc?: MetaCalculada } | null>(
    null,
  )
  const [aportar, setAportar] = useState<MetaCalculada | null>(null)
  const [eliminar, setEliminar] = useState<MetaCalculada | null>(null)

  const activas = metas.filter((m) => !m.progreso.cumplida)
  const cumplidas = metas.filter((m) => m.progreso.cumplida)

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Metas</h1>
        <button
          type="button"
          onClick={() => setForm({ modo: 'nuevo' })}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          + Meta
        </button>
      </div>

      {cargando && !metas.length ? (
        <div className="mt-6 flex items-center gap-3 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
          Cargando metas…
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-4">
            {activas.map((mc) => (
              <MetaCard
                key={mc.meta.id}
                mc={mc}
                onAportar={() => setAportar(mc)}
                onEditar={() => setForm({ modo: 'editar', mc })}
                onEliminar={() => setEliminar(mc)}
              />
            ))}
            {activas.length === 0 && (
              <li className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
                Aún no tienes metas activas. Crea la primera.
              </li>
            )}
          </ul>

          {cumplidas.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Cumplidas
              </h2>
              <ul className="space-y-4">
                {cumplidas.map((mc) => (
                  <MetaCard
                    key={mc.meta.id}
                    mc={mc}
                    onAportar={() => setAportar(mc)}
                    onEditar={() => setForm({ modo: 'editar', mc })}
                    onEliminar={() => setEliminar(mc)}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {form && (
        <FormMeta
          modo={form.modo}
          mc={form.mc}
          bolsillos={bolsillos}
          onCerrar={() => setForm(null)}
          onGuardado={async () => {
            await refrescar()
            setForm(null)
          }}
        />
      )}

      {aportar && (
        <AportarModal
          mc={aportar}
          bolsillos={bolsillos}
          cuentas={cuentas}
          saldos={saldos.bolsillos}
          disponibleReal={disponibleReal}
          refrescar={refrescar}
          onCerrar={() => setAportar(null)}
        />
      )}

      {eliminar && (
        <EliminarModal
          mc={eliminar}
          bolsillos={bolsillos}
          saldoBolsillo={saldos.bolsillos[eliminar.meta.bolsillo_id] ?? 0}
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

// ---------------------------------------------------------------------------
// Tarjeta de meta
// ---------------------------------------------------------------------------

function badgeMeta(mc: MetaCalculada): { texto: string; clase: string } {
  if (mc.meta.estado === 'pausada')
    return { texto: 'Pausada', clase: 'bg-slate-200 text-slate-600' }
  switch (mc.estado) {
    case 'cumplida':
      return { texto: 'Cumplida', clase: 'bg-green-100 text-green-700' }
    case 'en_camino':
      return { texto: 'En camino', clase: 'bg-blue-100 text-blue-700' }
    case 'atrasada':
      return { texto: 'Atrasada', clase: 'bg-red-100 text-red-700' }
    default:
      return { texto: 'Sin fecha', clase: 'bg-slate-100 text-slate-500' }
  }
}

function MetaCard({
  mc,
  onAportar,
  onEditar,
  onEliminar,
}: {
  mc: MetaCalculada
  onAportar: () => void
  onEditar: () => void
  onEliminar: () => void
}) {
  const { meta, progreso, aporte } = mc
  const color = mc.bolsillo?.color ?? '#6366f1'
  const badge = badgeMeta(mc)

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-4 w-4 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <p className="truncate font-semibold text-slate-900">{meta.nombre}</p>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Objetivo {formatCOP(progreso.objetivo)}
            {meta.fecha_objetivo && <> · para {meta.fecha_objetivo.slice(0, 10)}</>}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.clase}`}>
          {badge.texto}
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="mt-3">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full"
            style={{ width: `${progreso.porcentaje}%`, backgroundColor: color }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Llevas {formatCOP(progreso.actual)} de {formatCOP(progreso.objetivo)}
          </span>
          <span className="font-medium text-slate-700">
            {progreso.porcentaje.toFixed(1)}%
          </span>
        </div>
      </div>

      {!progreso.cumplida && (
        <p className="mt-2 text-sm text-slate-600">
          Te falta <strong>{formatCOP(progreso.faltante)}</strong>.
          {aporte.quincenasRestantes !== null ? (
            <>
              {' '}Aporta <strong>{formatCOP(aporte.aporte)}</strong> por quincena
              para llegar a tiempo ({aporte.quincenasRestantes}{' '}
              {aporte.quincenasRestantes === 1 ? 'quincena' : 'quincenas'} ·{' '}
              {aporte.diasRestantes} días).
            </>
          ) : (
            <> Define una fecha objetivo para calcular el aporte por quincena.</>
          )}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!progreso.cumplida && (
          <button
            type="button"
            onClick={onAportar}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Aportar
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
// Formulario crear / editar
// ---------------------------------------------------------------------------

function FormMeta({
  modo,
  mc,
  bolsillos,
  onCerrar,
  onGuardado,
}: {
  modo: 'nuevo' | 'editar'
  mc?: MetaCalculada
  bolsillos: BolsilloRow[]
  onCerrar: () => void
  onGuardado: () => void | Promise<void>
}) {
  const meta = mc?.meta
  const origenes = bolsillos.filter((b) => b.activo && b.tipo !== 'meta')

  const [nombre, setNombre] = useState(meta?.nombre ?? '')
  const [objetivo, setObjetivo] = useState(meta ? String(meta.monto_objetivo) : '')
  const [fecha, setFecha] = useState(meta?.fecha_objetivo?.slice(0, 10) ?? '')
  const [color, setColor] = useState(mc?.bolsillo?.color ?? PALETA[0])
  const [origenDef, setOrigenDef] = useState(meta?.bolsillo_origen_default_id ?? '')
  const [estado, setEstado] = useState<EstadoMeta>(meta?.estado ?? 'activa')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const objetivoNum = parseMontoInput(objetivo)
  const errores: string[] = []
  if (!nombre.trim()) errores.push('Escribe un nombre.')
  if (objetivoNum <= 0) errores.push('Ingresa un objetivo mayor a 0.')
  const puede = errores.length === 0 && !guardando

  async function guardar() {
    if (!puede) return
    setGuardando(true)
    setError(null)
    try {
      if (modo === 'nuevo') {
        // 1) Bolsillo tipo meta.
        const bolsilloId = generarId()
        const bolsillo: BolsilloRow = {
          id: bolsilloId,
          nombre: nombre.trim(),
          porcentaje: 0,
          tipo: 'meta',
          color,
          saldo_inicial: 0,
          activo: true,
        }
        await appendRow('Bolsillos', bolsillo)
        // 2) Meta asociada.
        await appendRow('Metas', {
          id: generarId(),
          nombre: nombre.trim(),
          monto_objetivo: objetivoNum,
          fecha_objetivo: fecha,
          bolsillo_id: bolsilloId,
          bolsillo_origen_default_id: origenDef,
          estado: 'activa',
          notas: '',
        })
      } else if (meta) {
        // Actualiza la meta.
        await updateRowById('Metas', meta.id, {
          ...meta,
          nombre: nombre.trim(),
          monto_objetivo: objetivoNum,
          fecha_objetivo: fecha,
          bolsillo_origen_default_id: origenDef,
          estado,
        })
        // Si cambió nombre/color, sincroniza el bolsillo asociado.
        const b = mc?.bolsillo
        if (b && (b.nombre !== nombre.trim() || b.color !== color)) {
          await updateRowById('Bolsillos', b.id, {
            ...b,
            nombre: nombre.trim(),
            color,
          })
        }
      }
      await onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la meta.')
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={modo === 'nuevo' ? 'Nueva meta' : 'Editar meta'}>
      <div className="space-y-4">
        <Campo label="Nombre">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Viaje, Fondo de emergencia"
            className={inputCls}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Monto objetivo (COP)">
            <input
              type="text"
              inputMode="numeric"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="0"
              className={`${inputCls} text-right`}
            />
          </Campo>
          <Campo label="Fecha objetivo">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={inputCls}
            />
          </Campo>
        </div>
        {objetivoNum > 0 && (
          <p className="-mt-2 text-right text-xs text-slate-400">
            {formatCOP(objetivoNum)}
          </p>
        )}

        <Campo label="Color">
          <div className="flex flex-wrap gap-2">
            {PALETA.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={[
                  'h-7 w-7 rounded-full',
                  color === c ? 'ring-2 ring-slate-900 ring-offset-2' : '',
                ].join(' ')}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </Campo>

        <Campo label="Bolsillo de origen por defecto (opcional)">
          <select
            value={origenDef}
            onChange={(e) => setOrigenDef(e.target.value)}
            className={inputCls}
          >
            <option value="">— Ninguno —</option>
            {origenes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </Campo>

        {modo === 'editar' && (
          <Campo label="Estado">
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoMeta)}
              className={inputCls}
            >
              <option value="activa">Activa</option>
              <option value="pausada">Pausada</option>
            </select>
          </Campo>
        )}
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
// Aportar: A) desde un bolsillo (transferencia) · B) ingreso nuevo a la meta
// ---------------------------------------------------------------------------

type ModoAporte = 'bolsillo' | 'ingreso'

function AportarModal({
  mc,
  bolsillos,
  cuentas,
  saldos,
  disponibleReal,
  refrescar,
  onCerrar,
}: {
  mc: MetaCalculada
  bolsillos: BolsilloRow[]
  cuentas: CuentaRow[]
  saldos: Record<string, number>
  disponibleReal: Record<string, number>
  refrescar: () => Promise<void>
  onCerrar: () => void
}) {
  const origenes = bolsillos.filter(
    (b) => b.activo && b.tipo !== 'meta' && b.id !== mc.meta.bolsillo_id,
  )
  const cuentasActivas = cuentas.filter((c) => c.activo)

  const [modo, setModo] = useState<ModoAporte>('bolsillo')
  const [monto, setMonto] = useState(String(mc.aporte.aporte || mc.progreso.faltante))
  // A) desde bolsillo
  const [origenId, setOrigenId] = useState(
    mc.meta.bolsillo_origen_default_id || origenes[0]?.id || '',
  )
  const [confirmarExceso, setConfirmarExceso] = useState(false)
  // B) ingreso nuevo
  const [cuentaId, setCuentaId] = useState(cuentasActivas[0]?.id ?? '')
  const [fecha, setFecha] = useState(hoyLocal())

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [felicidad, setFelicidad] = useState(false)

  const montoNum = parseMontoInput(monto)
  const saldoOrigen = saldos[origenId] ?? 0
  const seExcede = modo === 'bolsillo' && montoNum > saldoOrigen

  const errores: string[] = []
  if (montoNum <= 0) errores.push('Ingresa un monto mayor a 0.')
  if (modo === 'bolsillo') {
    if (!origenId) errores.push('Selecciona el bolsillo de origen.')
    if (seExcede && !confirmarExceso)
      errores.push('Confirma que quieres pasarte del saldo del origen.')
  } else {
    if (!cuentaId) errores.push('Selecciona la cuenta destino.')
  }
  const puede = errores.length === 0 && !guardando

  async function confirmar() {
    if (!puede) return
    setGuardando(true)
    setError(null)
    try {
      if (modo === 'bolsillo') {
        // A) Transferencia entre bolsillos (no toca cuentas).
        await appendRow('Movimientos', {
          id: generarId(),
          fecha: hoyLocal(),
          tipo: 'transferencia_bolsillo',
          monto: montoNum,
          bolsillo_id: origenId,
          bolsillo_destino_id: mc.meta.bolsillo_id,
          cuenta_id: '',
          cuenta_destino_id: '',
          categoria_id: '',
          descripcion: `Aporte a ${mc.meta.nombre}`,
          gasto_fijo_id: '',
          origen: 'manual',
          conciliado: false,
          grupo_id: '',
          es_quincena: false,
        })
      } else {
        // B) Ingreso nuevo que entra completo al bolsillo de la meta.
        await appendRow('Movimientos', {
          id: generarId(),
          fecha,
          tipo: 'ingreso',
          monto: montoNum,
          bolsillo_id: mc.meta.bolsillo_id,
          bolsillo_destino_id: '',
          cuenta_id: cuentaId,
          cuenta_destino_id: '',
          categoria_id: '',
          descripcion: `Aporte a ${mc.meta.nombre}`,
          gasto_fijo_id: '',
          origen: 'manual',
          conciliado: false,
          grupo_id: '',
          es_quincena: false,
        })
      }

      // ¿Alcanzó el objetivo? (ambas formas suman al bolsillo de la meta)
      const nuevoSaldo = (saldos[mc.meta.bolsillo_id] ?? 0) + montoNum
      const cumplida =
        mc.progreso.objetivo > 0 && nuevoSaldo >= mc.progreso.objetivo
      if (cumplida && mc.meta.estado !== 'cumplida') {
        await updateRowById('Metas', mc.meta.id, {
          ...mc.meta,
          estado: 'cumplida',
        })
      }

      await refrescar()
      if (cumplida) setFelicidad(true)
      else onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el aporte.')
      setGuardando(false)
    }
  }

  if (felicidad) {
    return (
      <Modal titulo="¡Meta cumplida! 🎉">
        <p className="text-sm text-slate-600">
          Felicitaciones, alcanzaste tu meta <strong>{mc.meta.nombre}</strong> de{' '}
          {formatCOP(mc.progreso.objetivo)}. La marcamos como cumplida.
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            ¡Listo!
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal titulo={`Aportar a ${mc.meta.nombre}`}>
      {/* Selector de forma de aporte */}
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
        <BotonModo activo={modo === 'bolsillo'} onClick={() => setModo('bolsillo')}>
          Desde un bolsillo
        </BotonModo>
        <BotonModo activo={modo === 'ingreso'} onClick={() => setModo('ingreso')}>
          Ingreso nuevo
        </BotonModo>
      </div>

      <p className="text-sm text-slate-500">
        {modo === 'bolsillo'
          ? 'Mueve dinero que ya tienes de un bolsillo a la meta (no cambia tu patrimonio).'
          : 'Registra plata que entra de afuera directamente para esta meta.'}
      </p>

      <div className="mt-4 space-y-4">
        <Campo label="Monto (COP)">
          <input
            type="text"
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className={`${inputCls} text-right`}
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {formatCOP(montoNum)} · sugerido {formatCOP(mc.aporte.aporte)}
          </p>
        </Campo>

        {modo === 'bolsillo' ? (
          <Campo label="Desde (bolsillo de origen)">
            <select
              value={origenId}
              onChange={(e) => setOrigenId(e.target.value)}
              className={inputCls}
            >
              {origenes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre} — disp. {formatCOP(disponibleReal[b.id] ?? saldos[b.id] ?? 0)}
                </option>
              ))}
            </select>
            {seExcede && (
              <label className="mt-2 flex items-center gap-2 text-sm text-amber-700">
                <input
                  type="checkbox"
                  checked={confirmarExceso}
                  onChange={(e) => setConfirmarExceso(e.target.checked)}
                  className="h-4 w-4 rounded border-amber-400"
                />
                El origen solo tiene {formatCOP(saldoOrigen)}. Continuar igual.
              </label>
            )}
          </Campo>
        ) : (
          <>
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
            <Campo label="Fecha">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={inputCls}
              />
            </Campo>
          </>
        )}
      </div>

      {error && <Alerta>{error}</Alerta>}
      <Acciones
        onCancelar={onCerrar}
        onConfirmar={confirmar}
        cargando={guardando}
        deshabilitado={!puede}
        textoConfirmar="Confirmar aporte"
      />
    </Modal>
  )
}

function BotonModo({
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
        activo ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Eliminar meta (mueve saldo si hay, marca bolsillo inactivo)
// ---------------------------------------------------------------------------

function EliminarModal({
  mc,
  bolsillos,
  saldoBolsillo,
  onCerrar,
  onGuardado,
}: {
  mc: MetaCalculada
  bolsillos: BolsilloRow[]
  saldoBolsillo: number
  onCerrar: () => void
  onGuardado: () => void | Promise<void>
}) {
  const destinos = bolsillos.filter(
    (b) => b.activo && b.id !== mc.meta.bolsillo_id,
  )
  const [destinoId, setDestinoId] = useState(destinos[0]?.id ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hayque = saldoBolsillo > 0
  const puede = (!hayque || !!destinoId) && !guardando

  async function confirmar() {
    if (!puede) return
    setGuardando(true)
    setError(null)
    try {
      // 1) Si el bolsillo de la meta tiene saldo, muévelo antes de eliminar.
      if (hayque) {
        await appendRow('Movimientos', {
          id: generarId(),
          fecha: hoyLocal(),
          tipo: 'transferencia_bolsillo',
          monto: saldoBolsillo,
          bolsillo_id: mc.meta.bolsillo_id,
          bolsillo_destino_id: destinoId,
          cuenta_id: '',
          cuenta_destino_id: '',
          categoria_id: '',
          descripcion: `Cierre de meta ${mc.meta.nombre}`,
          gasto_fijo_id: '',
          origen: 'manual',
          conciliado: false,
          grupo_id: '',
          es_quincena: false,
        })
      }
      // 2) Marca el bolsillo de la meta como inactivo (conserva historial).
      if (mc.bolsillo) {
        await updateRowById('Bolsillos', mc.bolsillo.id, {
          ...mc.bolsillo,
          activo: false,
        })
      }
      // 3) Borra la fila de la meta.
      await deleteRowById('Metas', mc.meta.id)
      await onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la meta.')
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Eliminar meta">
      <p className="text-sm text-slate-600">{mc.meta.nombre}</p>
      {hayque ? (
        <>
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Esta meta tiene {formatCOP(saldoBolsillo)} guardados. Se moverán a otro
            bolsillo antes de eliminarla (no se pierde dinero).
          </p>
          <div className="mt-3">
            <Campo label="Mover el saldo a">
              <select
                value={destinoId}
                onChange={(e) => setDestinoId(e.target.value)}
                className={inputCls}
              >
                {destinos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          El bolsillo de la meta no tiene saldo. Se marcará como inactivo.
        </p>
      )}

      {error && <Alerta>{error}</Alerta>}
      <Acciones
        onCancelar={onCerrar}
        onConfirmar={confirmar}
        cargando={guardando}
        deshabilitado={!puede}
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
    <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
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
