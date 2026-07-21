import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import {
  appendRow,
  buscarFilaPorId,
  conectarSpreadsheetId,
  deleteRow,
  generarId,
  obtenerResumenHojas,
  type ResumenSpreadsheet,
} from '@/lib/sheets'
import { useFinanzas } from '@/lib/FinanzasContext'
import { saldoTotal, verificarCuadre, type Cuadre } from '@/lib/calculos'
import { formatCOP, hoyLocal } from '@/lib/format'
import type { MovimientoRow } from '@/types/sheets'

type EstadoPrueba =
  | { estado: 'inactivo' }
  | { estado: 'corriendo'; paso: string }
  | { estado: 'ok'; detalle: string }
  | { estado: 'error'; detalle: string }

export default function Diagnostico() {
  const { usuario } = useAuth()
  const { refrescar } = useFinanzas()

  const [resumen, setResumen] = useState<ResumenSpreadsheet | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorResumen, setErrorResumen] = useState<string | null>(null)
  const [prueba, setPrueba] = useState<EstadoPrueba>({ estado: 'inactivo' })

  const [cuadre, setCuadre] = useState<Cuadre | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [errorSaldos, setErrorSaldos] = useState<string | null>(null)

  // Conectar hoja existente por id.
  const [idManual, setIdManual] = useState('')
  const [conectando, setConectando] = useState(false)
  const [conectarMsg, setConectarMsg] = useState<string | null>(null)
  const [conectarError, setConectarError] = useState<string | null>(null)

  async function conectar() {
    if (!usuario || !idManual.trim() || conectando) return
    setConectando(true)
    setConectarMsg(null)
    setConectarError(null)
    try {
      await conectarSpreadsheetId(usuario.id, idManual.trim())
      await refrescar()
      cargarResumen()
      cargarSaldos()
      setConectarMsg('Hoja conectada. Ahora la app usa esa hoja en este dispositivo.')
      setIdManual('')
    } catch (e) {
      setConectarError(
        e instanceof Error ? e.message : 'No se pudo conectar la hoja.',
      )
    } finally {
      setConectando(false)
    }
  }

  const cargarResumen = () => {
    setCargando(true)
    setErrorResumen(null)
    obtenerResumenHojas()
      .then(setResumen)
      .catch((e: unknown) =>
        setErrorResumen(
          e instanceof Error ? e.message : 'No se pudo leer el spreadsheet.',
        ),
      )
      .finally(() => setCargando(false))
  }

  useEffect(cargarResumen, [])

  const cargarSaldos = () => {
    setErrorSaldos(null)
    Promise.all([verificarCuadre(), saldoTotal()])
      .then(([c, t]) => {
        setCuadre(c)
        setTotal(t)
      })
      .catch((e: unknown) =>
        setErrorSaldos(
          e instanceof Error ? e.message : 'No se pudieron calcular los saldos.',
        ),
      )
  }

  useEffect(cargarSaldos, [])

  async function probarEscritura() {
    const id = generarId()
    try {
      setPrueba({ estado: 'corriendo', paso: 'Escribiendo fila de prueba…' })
      const fila: MovimientoRow = {
        id,
        fecha: hoyLocal(),
        tipo: 'ajuste',
        monto: 0,
        bolsillo_id: '',
        bolsillo_destino_id: '',
        cuenta_id: '',
        cuenta_destino_id: '',
        categoria_id: '',
        descripcion: 'Fila de prueba (diagnóstico)',
        gasto_fijo_id: '',
        origen: 'diagnostico',
        conciliado: false,
        grupo_id: '',
        es_quincena: false,
      }
      await appendRow('Movimientos', fila)

      setPrueba({ estado: 'corriendo', paso: 'Verificando que se escribió…' })
      const filaNum = await buscarFilaPorId('Movimientos', id)
      if (filaNum === null) {
        throw new Error('La fila se agregó pero no se pudo encontrar de nuevo.')
      }

      setPrueba({ estado: 'corriendo', paso: 'Borrando fila de prueba…' })
      await deleteRow('Movimientos', filaNum)

      const sigue = await buscarFilaPorId('Movimientos', id)
      if (sigue !== null) {
        throw new Error('La fila se borró pero sigue apareciendo.')
      }

      setPrueba({
        estado: 'ok',
        detalle: `Escritura y borrado correctos (fila ${filaNum}).`,
      })
      cargarResumen()
    } catch (e) {
      setPrueba({
        estado: 'error',
        detalle:
          e instanceof Error ? e.message : 'Falló la prueba de escritura.',
      })
    }
  }

  const corriendo = prueba.estado === 'corriendo'

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Diagnóstico</h1>
        <p className="mt-2 text-slate-500">
          Verificación temporal de la conexión con Google (lectura y escritura).
        </p>
        <Link
          to="/configuracion"
          className="mt-2 inline-block text-sm text-brand-600 hover:underline"
        >
          ← Volver a Configuración
        </Link>
      </div>

      {/* Cuenta conectada */}
      <Tarjeta titulo="Cuenta de Google conectada">
        {usuario ? (
          <div className="flex items-center gap-3">
            {usuario.fotoUrl && (
              <img
                src={usuario.fotoUrl}
                alt=""
                className="h-9 w-9 rounded-full"
                referrerPolicy="no-referrer"
              />
            )}
            <div>
              <p className="font-medium text-slate-900">{usuario.nombre}</p>
              <p className="text-sm text-slate-500">{usuario.email}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Sin sesión.</p>
        )}
      </Tarjeta>

      {/* Spreadsheet */}
      <Tarjeta titulo="Google Sheets detectado">
        {cargando && <Cargando texto="Leyendo spreadsheet…" />}
        {errorResumen && <Alerta>{errorResumen}</Alerta>}
        {resumen && (
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-slate-500">Nombre:</span>{' '}
              <span className="font-medium text-slate-900">
                {resumen.titulo}
              </span>
            </p>
            <p className="break-all">
              <span className="text-slate-500">ID:</span>{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                {resumen.spreadsheetId}
              </code>
            </p>
            <a
              href={resumen.url}
              target="_blank"
              rel="noreferrer"
              className="inline-block pt-1 text-brand-600 hover:underline"
            >
              Abrir en Google Sheets ↗
            </a>
          </div>
        )}
      </Tarjeta>

      {/* Conectar hoja existente por ID */}
      <Tarjeta titulo="Conectar hoja existente por ID">
        <p className="text-sm text-slate-500">
          ¿Ya tienes tu hoja en otro dispositivo? Pega su ID (lo ves en la URL de
          Google Sheets, entre <code className="rounded bg-slate-100 px-1">/d/</code>
          y <code className="rounded bg-slate-100 px-1">/edit</code>) para usarla
          aquí y no crear un archivo duplicado.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={idManual}
            onChange={(e) => setIdManual(e.target.value)}
            placeholder="ID de la hoja"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={conectar}
            disabled={!idManual.trim() || conectando}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {conectando ? 'Conectando…' : 'Conectar'}
          </button>
        </div>
        {conectarMsg && (
          <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {conectarMsg}
          </p>
        )}
        {conectarError && <div className="mt-2"><Alerta>{conectarError}</Alerta></div>}
      </Tarjeta>

      {/* Hojas */}
      <Tarjeta titulo="Hojas encontradas">
        {cargando && <Cargando texto="Contando filas…" />}
        {resumen && (
          <ul className="divide-y divide-slate-100">
            {resumen.hojas.map((h) => (
              <li
                key={h.nombre}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="font-medium text-slate-800">{h.nombre}</span>
                <span className="text-slate-500">
                  {h.columnas} col · {h.filas}{' '}
                  {h.filas === 1 ? 'fila' : 'filas'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {/* Saldos calculados (motor de saldos) */}
      <Tarjeta titulo="Saldos calculados">
        {errorSaldos && <Alerta>{errorSaldos}</Alerta>}
        {!errorSaldos && !cuadre && <Cargando texto="Calculando saldos…" />}
        {cuadre && total !== null && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Total cuentas</span>
              <span className="font-medium text-slate-900">
                {formatCOP(cuadre.totalCuentas)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total bolsillos</span>
              <span className="font-medium text-slate-900">
                {formatCOP(cuadre.totalBolsillos)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="text-slate-500">Patrimonio líquido</span>
              <span className="font-semibold text-slate-900">
                {formatCOP(total)}
              </span>
            </div>
            {cuadre.cuadrado ? (
              <p className="rounded-lg bg-green-50 px-3 py-2 font-medium text-green-700">
                ✓ Cuadrado
              </p>
            ) : (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
                Diferencia: {formatCOP(Math.abs(cuadre.diferencia))}
              </p>
            )}
          </div>
        )}
      </Tarjeta>

      {/* Prueba de escritura */}
      <Tarjeta titulo="Prueba de escritura">
        <p className="text-sm text-slate-500">
          Agrega una fila de prueba a <strong>Movimientos</strong> y la borra
          enseguida. No deja rastro si todo sale bien.
        </p>
        <button
          type="button"
          onClick={probarEscritura}
          disabled={corriendo}
          className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {corriendo ? 'Probando…' : 'Probar escritura'}
        </button>

        {prueba.estado === 'corriendo' && (
          <p className="mt-3 text-sm text-slate-500">{prueba.paso}</p>
        )}
        {prueba.estado === 'ok' && (
          <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            ✓ OK — {prueba.detalle}
          </p>
        )}
        {prueba.estado === 'error' && <Alerta>{prueba.detalle}</Alerta>}
      </Tarjeta>
    </section>
  )
}

function Tarjeta({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {titulo}
      </h2>
      {children}
    </div>
  )
}

function Cargando({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      {texto}
    </div>
  )
}

function Alerta({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {children}
    </p>
  )
}
