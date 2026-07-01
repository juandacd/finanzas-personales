import { useEffect, useMemo, useState } from 'react'
import { appendRow, deleteRowById, generarId, updateRowById } from '@/lib/sheets'
import { useFinanzas } from '@/lib/FinanzasContext'
import { formatCOP, hoyLocal, parseMontoInput } from '@/lib/format'
import type { CuentaRow } from '@/types/sheets'

const TIPOS = ['banco', 'efectivo', 'otro']

interface Draft {
  key: string
  id: string
  nombre: string
  tipo: string
  original: CuentaRow
}

function aDraft(c: CuentaRow): Draft {
  return { key: c.id, id: c.id, nombre: c.nombre, tipo: c.tipo, original: c }
}

export default function CuentasConfig() {
  const { cuentas, movimientos, saldos, refrescar } = useFinanzas()

  const activas = useMemo(() => cuentas.filter((c) => c.activo), [cuentas])

  const [filas, setFilas] = useState<Draft[]>(() => activas.map(aDraft))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  // Formulario de creación.
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('banco')
  const [saldoInicial, setSaldoInicial] = useState('')
  const [creando, setCreando] = useState(false)

  const [aEliminar, setAEliminar] = useState<CuentaRow | null>(null)

  // Re-sincroniza cuando cambian las cuentas del store (tras guardar/eliminar).
  const firmaIds = activas.map((c) => c.id).join(',')
  useEffect(() => {
    setFilas(activas.map(aDraft))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaIds])

  function cambiar(key: string, campo: 'nombre' | 'tipo', valor: string) {
    setOkMsg(null)
    setFilas((prev) =>
      prev.map((f) => (f.key === key ? { ...f, [campo]: valor } : f)),
    )
  }

  const puedeGuardar =
    !guardando && filas.every((f) => f.nombre.trim().length > 0)

  async function guardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    setError(null)
    setOkMsg(null)
    try {
      for (const f of filas) {
        const o = f.original
        if (o.nombre !== f.nombre.trim() || o.tipo !== f.tipo) {
          await updateRowById('Cuentas', f.id, {
            ...o,
            nombre: f.nombre.trim(),
            tipo: f.tipo,
          })
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

  async function crear() {
    if (!nombre.trim() || creando) return
    setCreando(true)
    setError(null)
    try {
      await appendRow('Cuentas', {
        id: generarId(),
        nombre: nombre.trim(),
        tipo,
        saldo_inicial: parseMontoInput(saldoInicial),
        activo: true,
      })
      await refrescar()
      setNombre('')
      setTipo('banco')
      setSaldoInicial('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la cuenta.')
    } finally {
      setCreando(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Lista editable */}
      <div className="space-y-2">
        {filas.map((f) => (
          <div
            key={f.key}
            className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_auto_auto]"
          >
            <input
              type="text"
              value={f.nombre}
              onChange={(e) => cambiar(f.key, 'nombre', e.target.value)}
              placeholder="Nombre"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <select
              value={f.tipo}
              onChange={(e) => cambiar(f.key, 'tipo', e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {/* Conserva tipos ya guardados fuera de la lista estándar. */}
              {!TIPOS.includes(f.tipo) && <option value={f.tipo}>{f.tipo}</option>}
            </select>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-sm text-slate-500">
                {formatCOP(saldos.cuentas[f.id] ?? 0)}
              </span>
              <button
                type="button"
                onClick={() => setAEliminar(f.original)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {filas.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-center text-xs text-slate-400">
            No hay cuentas activas.
          </p>
        )}
      </div>

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

      {/* Crear cuenta */}
      <div className="rounded-lg border border-slate-200 p-3">
        <p className="mb-2 text-sm font-medium text-slate-700">Nueva cuenta</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre (ej. Davivienda)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
              placeholder="Saldo inicial (0)"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
        {parseMontoInput(saldoInicial) > 0 && (
          <p className="mt-1 text-xs text-amber-600">
            Nota: un saldo inicial &gt; 0 sube el total de cuentas y puede
            descuadrar con los bolsillos hasta que lo ajustes en “Saldos iniciales”.
          </p>
        )}
        <button
          type="button"
          onClick={crear}
          disabled={!nombre.trim() || creando}
          className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creando ? 'Agregando…' : 'Agregar cuenta'}
        </button>
      </div>

      {aEliminar && (
        <ModalEliminar
          cuenta={aEliminar}
          cuentas={cuentas}
          saldo={saldos.cuentas[aEliminar.id] ?? 0}
          tieneMovimientos={movimientos.some(
            (m) =>
              m.cuenta_id === aEliminar.id || m.cuenta_destino_id === aEliminar.id,
          )}
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
  cuenta,
  cuentas,
  saldo,
  tieneMovimientos,
  onCerrar,
  onHecho,
}: {
  cuenta: CuentaRow
  cuentas: CuentaRow[]
  saldo: number
  tieneMovimientos: boolean
  onCerrar: () => void
  onHecho: () => void | Promise<void>
}) {
  const destinos = cuentas.filter((c) => c.activo && c.id !== cuenta.id)
  const [destinoId, setDestinoId] = useState(destinos[0]?.id ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debeMover = saldo > 0
  const borradoFisico = saldo === 0 && !tieneMovimientos
  const faltaDestino = debeMover && !destinoId
  const puede = !faltaDestino && !guardando

  async function confirmar() {
    if (!puede) return
    setGuardando(true)
    setError(null)
    try {
      if (debeMover) {
        await appendRow('Movimientos', {
          id: generarId(),
          fecha: hoyLocal(),
          tipo: 'transferencia_cuenta',
          monto: saldo,
          bolsillo_id: '',
          bolsillo_destino_id: '',
          cuenta_id: cuenta.id,
          cuenta_destino_id: destinoId,
          categoria_id: '',
          descripcion: `Cierre de cuenta ${cuenta.nombre}`,
          gasto_fijo_id: '',
          origen: 'manual',
          conciliado: false,
          grupo_id: '',
        })
      }
      if (borradoFisico) {
        await deleteRowById('Cuentas', cuenta.id)
      } else {
        // Conserva el historial: se marca inactiva (con saldo ya en 0).
        await updateRowById('Cuentas', cuenta.id, { ...cuenta, activo: false })
      }
      await onHecho()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta.')
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">Eliminar cuenta</h2>
        <p className="mt-2 text-sm text-slate-600">{cuenta.nombre}</p>

        {debeMover ? (
          <>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Tiene {formatCOP(saldo)}. Se moverán a otra cuenta antes de
              eliminarla (no se pierde dinero).
            </p>
            {destinos.length > 0 ? (
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Mover el saldo a
                </span>
                <select
                  value={destinoId}
                  onChange={(e) => setDestinoId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {destinos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="mt-3 text-sm text-red-700">
                No hay otra cuenta activa a la que mover el saldo. Crea otra cuenta
                primero.
              </p>
            )}
          </>
        ) : borradoFisico ? (
          <p className="mt-3 text-sm text-slate-500">
            No tiene saldo ni movimientos. Se eliminará por completo.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No tiene saldo pero sí movimientos históricos. Se marcará como inactiva
            para conservar el historial.
          </p>
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
          <button
            type="button"
            onClick={confirmar}
            disabled={!puede}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
