import { useMemo, useState } from 'react'
import { appendRow, deleteRowById, generarId, updateRowById } from '@/lib/sheets'
import { useFinanzas } from '@/lib/FinanzasContext'
import type { CategoriaRow, TipoCategoria } from '@/types/sheets'

export default function Categorias() {
  const { categorias, bolsillos, movimientos, refrescar } = useFinanzas()
  const bolsillosActivos = useMemo(
    () => bolsillos.filter((b) => b.activo),
    [bolsillos],
  )

  const egreso = categorias.filter((c) => c.tipo === 'egreso')
  const ingreso = categorias.filter((c) => c.tipo === 'ingreso')

  // Formulario de creación.
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoCategoria>('egreso')
  const [bolsilloDef, setBolsilloDef] = useState('')
  const [creando, setCreando] = useState(false)

  const [editar, setEditar] = useState<CategoriaRow | null>(null)
  const [confirmar, setConfirmar] = useState<CategoriaRow | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nombreDeBolsillo = (id: string) =>
    bolsillos.find((b) => b.id === id)?.nombre ?? ''
  const colorDeBolsillo = (id: string) =>
    bolsillos.find((b) => b.id === id)?.color

  const usosDe = (id: string) =>
    movimientos.filter((m) => m.categoria_id === id).length

  async function crear() {
    if (!nombre.trim() || creando) return
    setCreando(true)
    setError(null)
    try {
      await appendRow('Categorias', {
        id: generarId(),
        nombre: nombre.trim(),
        tipo,
        bolsillo_default_id: bolsilloDef,
      })
      await refrescar()
      setNombre('')
      setBolsilloDef('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la categoría.')
    } finally {
      setCreando(false)
    }
  }

  async function guardarEdicion(nuevoNombre: string, nuevoBolsillo: string) {
    if (!editar) return
    setOcupado(true)
    setError(null)
    try {
      await updateRowById('Categorias', editar.id, {
        ...editar,
        nombre: nuevoNombre.trim(),
        bolsillo_default_id: nuevoBolsillo,
      })
      await refrescar()
      setEditar(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setOcupado(false)
    }
  }

  async function eliminar() {
    if (!confirmar) return
    setOcupado(true)
    setError(null)
    try {
      await deleteRowById('Categorias', confirmar.id)
      await refrescar()
      setConfirmar(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Crear */}
      <div className="rounded-lg border border-slate-200 p-3">
        <p className="mb-2 text-sm font-medium text-slate-700">Nueva categoría</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCategoria)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="egreso">Egreso</option>
            <option value="ingreso">Ingreso</option>
          </select>
          <select
            value={bolsilloDef}
            onChange={(e) => setBolsilloDef(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:col-span-2"
          >
            <option value="">Bolsillo por defecto (opcional)</option>
            {bolsillosActivos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={crear}
          disabled={!nombre.trim() || creando}
          className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creando ? 'Agregando…' : 'Agregar categoría'}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Grupo
        titulo="Egreso"
        items={egreso}
        nombreDeBolsillo={nombreDeBolsillo}
        colorDeBolsillo={colorDeBolsillo}
        onEditar={setEditar}
        onBorrar={setConfirmar}
      />
      <Grupo
        titulo="Ingreso"
        items={ingreso}
        nombreDeBolsillo={nombreDeBolsillo}
        colorDeBolsillo={colorDeBolsillo}
        onEditar={setEditar}
        onBorrar={setConfirmar}
      />

      {editar && (
        <ModalEditar
          categoria={editar}
          bolsillos={bolsillosActivos}
          ocupado={ocupado}
          onCancelar={() => setEditar(null)}
          onGuardar={guardarEdicion}
        />
      )}

      {confirmar && (
        <ModalBorrar
          categoria={confirmar}
          usos={usosDe(confirmar.id)}
          ocupado={ocupado}
          onCancelar={() => setConfirmar(null)}
          onConfirmar={eliminar}
        />
      )}
    </div>
  )
}

function Grupo({
  titulo,
  items,
  nombreDeBolsillo,
  colorDeBolsillo,
  onEditar,
  onBorrar,
}: {
  titulo: string
  items: CategoriaRow[]
  nombreDeBolsillo: (id: string) => string
  colorDeBolsillo: (id: string) => string | undefined
  onEditar: (c: CategoriaRow) => void
  onBorrar: (c: CategoriaRow) => void
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{titulo}</h3>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="text-sm font-medium text-slate-800">{c.nombre}</span>
              {c.bolsillo_default_id && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-400">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colorDeBolsillo(c.bolsillo_default_id) }}
                    aria-hidden="true"
                  />
                  {nombreDeBolsillo(c.bolsillo_default_id)}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => onEditar(c)}
              className="text-xs text-brand-600 hover:underline"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onBorrar(c)}
              className="text-xs text-red-600 hover:underline"
            >
              Borrar
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-3 py-3 text-center text-xs text-slate-400">
            Sin categorías.
          </li>
        )}
      </ul>
    </div>
  )
}

function ModalEditar({
  categoria,
  bolsillos,
  ocupado,
  onCancelar,
  onGuardar,
}: {
  categoria: CategoriaRow
  bolsillos: { id: string; nombre: string }[]
  ocupado: boolean
  onCancelar: () => void
  onGuardar: (nombre: string, bolsillo: string) => void
}) {
  const [nombre, setNombre] = useState(categoria.nombre)
  const [bolsillo, setBolsillo] = useState(categoria.bolsillo_default_id)

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">Editar categoría</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Nombre</span>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Bolsillo por defecto
            </span>
            <select
              value={bolsillo}
              onChange={(e) => setBolsillo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— Ninguno —</option>
              {bolsillos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={ocupado}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onGuardar(nombre, bolsillo)}
            disabled={ocupado || !nombre.trim()}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {ocupado ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalBorrar({
  categoria,
  usos,
  ocupado,
  onCancelar,
  onConfirmar,
}: {
  categoria: CategoriaRow
  usos: number
  ocupado: boolean
  onCancelar: () => void
  onConfirmar: () => void
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">Borrar categoría</h2>
        <p className="mt-2 text-sm text-slate-600">{categoria.nombre}</p>
        {usos > 0 ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {usos} {usos === 1 ? 'movimiento usa' : 'movimientos usan'} esta
            categoría. No se borrarán, pero quedarán <strong>sin categoría</strong>.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Ningún movimiento usa esta categoría.
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={ocupado}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={ocupado}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {ocupado ? 'Borrando…' : 'Borrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
