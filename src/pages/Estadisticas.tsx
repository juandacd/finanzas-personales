import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFinanzas } from '@/lib/FinanzasContext'
import {
  filtrarPorPeriodo,
  gastoPorBolsillo,
  gastoPorCategoria,
  ingresoVsEgresoPorDia,
  ingresoVsEgresoPorMesRango,
  ritmoGastoCiclo,
  serieSaldoBolsillo,
  seriedPatrimonio,
  totalesPeriodo,
} from '@/lib/calculos'
import { formatCOP } from '@/lib/format'

type PeriodoTipo = 'mes' | 'mesPasado' | 'tres' | 'anio' | 'custom'

const OPCIONES: { value: PeriodoTipo; label: string }[] = [
  { value: 'mes', label: 'Este mes' },
  { value: 'mesPasado', label: 'Mes pasado' },
  { value: 'tres', label: 'Últimos 3 meses' },
  { value: 'anio', label: 'Este año' },
  { value: 'custom', label: 'Personalizado' },
]

const PALETA = [
  '#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b',
]

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function ultimoDia(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate()
}

function rangoDe(
  tipo: PeriodoTipo,
  custom: { desde: string; hasta: string },
): { desde: string; hasta: string } {
  const hoy = new Date()
  const y = hoy.getFullYear()
  const m = hoy.getMonth()
  switch (tipo) {
    case 'mesPasado': {
      const d = new Date(y, m - 1, 1)
      const yy = d.getFullYear()
      const mm = d.getMonth()
      return { desde: ymd(yy, mm, 1), hasta: ymd(yy, mm, ultimoDia(yy, mm)) }
    }
    case 'tres': {
      const d = new Date(y, m - 2, 1)
      return {
        desde: ymd(d.getFullYear(), d.getMonth(), 1),
        hasta: ymd(y, m, ultimoDia(y, m)),
      }
    }
    case 'anio':
      return { desde: ymd(y, 0, 1), hasta: ymd(y, 11, 31) }
    case 'custom':
      return custom
    case 'mes':
    default:
      return { desde: ymd(y, m, 1), hasta: ymd(y, m, ultimoDia(y, m)) }
  }
}

export default function Estadisticas() {
  const { movimientos, categorias, bolsillos, cuentas, config, cargando } =
    useFinanzas()

  const [tipo, setTipo] = useState<PeriodoTipo>('mes')
  const [patrimonioModo, setPatrimonioModo] = useState<'periodo' | 'todo'>('todo')
  const [bolsilloSerieId, setBolsilloSerieId] = useState('')
  const hoy = new Date()
  const [custom, setCustom] = useState({
    desde: ymd(hoy.getFullYear(), hoy.getMonth(), 1),
    hasta: ymd(hoy.getFullYear(), hoy.getMonth(), ultimoDia(hoy.getFullYear(), hoy.getMonth())),
  })

  const { desde, hasta } = useMemo(() => rangoDe(tipo, custom), [tipo, custom])

  const delPeriodo = useMemo(
    () => filtrarPorPeriodo(movimientos, desde, hasta),
    [movimientos, desde, hasta],
  )
  const totales = useMemo(() => totalesPeriodo(delPeriodo), [delPeriodo])
  const tasaAhorro =
    totales.ingresos > 0 ? (totales.neto / totales.ingresos) * 100 : null

  // Granularidad según el periodo: por día si es un solo mes (o menos),
  // por mes si el rango abarca varios meses.
  const porDia = desde.slice(0, 7) === hasta.slice(0, 7)
  const serieIngEg = useMemo(
    () =>
      porDia
        ? ingresoVsEgresoPorDia(movimientos, desde, hasta)
        : ingresoVsEgresoPorMesRango(movimientos, desde, hasta),
    [movimientos, desde, hasta, porDia],
  )
  const hayIngEg = serieIngEg.some((m) => m.ingresos > 0 || m.egresos > 0)
  // Forma común para el gráfico (evita el tipo unión mes/día).
  const datosBar = serieIngEg.map((x) => ({
    etiqueta: x.etiqueta,
    ingresos: x.ingresos,
    egresos: x.egresos,
  }))

  const cats = useMemo(
    () => gastoPorCategoria(delPeriodo, categorias),
    [delPeriodo, categorias],
  )
  const totalCats = cats.reduce((a, c) => a + c.total, 0)
  const datosPie = cats.map((c, i) => ({
    name: c.nombre,
    value: c.total,
    color: PALETA[i % PALETA.length],
  }))

  // Sección 4 — Evolución del patrimonio.
  const saldoInicialTotal = useMemo(
    () => cuentas.reduce((a, c) => a + (Number(c.saldo_inicial) || 0), 0),
    [cuentas],
  )
  const seriePatrimonioCompleta = useMemo(
    () => seriedPatrimonio(movimientos, saldoInicialTotal),
    [movimientos, saldoInicialTotal],
  )
  const seriePatrimonio =
    patrimonioModo === 'todo'
      ? seriePatrimonioCompleta
      : seriePatrimonioCompleta.filter((p) => p.fecha >= desde && p.fecha <= hasta)

  // Sección 5 — Gasto por bolsillo (periodo) + evolución de un bolsillo.
  const gastosBolsillo = useMemo(
    () => gastoPorBolsillo(delPeriodo, bolsillos),
    [delPeriodo, bolsillos],
  )
  const bolsillosActivos = bolsillos.filter((b) => b.activo)
  const serieBolsilloId =
    bolsilloSerieId ||
    bolsillosActivos.find((b) => b.tipo === 'gasto')?.id ||
    bolsillosActivos[0]?.id ||
    ''
  const bolsilloSel = bolsillos.find((b) => b.id === serieBolsilloId)
  const serieBolsillo = useMemo(
    () =>
      bolsilloSel
        ? serieSaldoBolsillo(
            movimientos,
            bolsilloSel,
            Number(bolsilloSel.saldo_inicial) || 0,
          )
        : [],
    [movimientos, bolsilloSel],
  )

  // Sección 6 — Ritmo de gasto del ciclo (bolsillo de tipo gasto).
  const ritmo = useMemo(
    () => ritmoGastoCiclo(movimientos, bolsillos, new Date(), categorias, config),
    [movimientos, bolsillos, categorias, config],
  )
  const ritmoDia =
    ritmo.diasTranscurridos > 0
      ? Math.round(ritmo.gastado / ritmo.diasTranscurridos)
      : 0
  const pctCiclo =
    ritmo.ingresadoCiclo > 0
      ? Math.min(100, Math.round((ritmo.gastado / ritmo.ingresadoCiclo) * 100))
      : 0
  const excedidoCiclo =
    ritmo.ingresadoCiclo > 0 && ritmo.gastado > ritmo.ingresadoCiclo
  const veredicto = interpretarRitmo(ritmo.proyeccionFinCiclo, ritmo.ingresadoCiclo, ritmo.gastado)

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Estadísticas</h1>

      {/* Selector de periodo */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {OPCIONES.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setTipo(o.value)}
              className={[
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                tipo === o.value
                  ? 'bg-brand-500 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
              ].join(' ')}
            >
              {o.label}
            </button>
          ))}
        </div>
        {tipo === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-500">Desde</span>
              <input
                type="date"
                value={custom.desde}
                onChange={(e) => setCustom((c) => ({ ...c, desde: e.target.value }))}
                className="rounded-md border border-slate-300 px-3 py-1.5 focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-500">Hasta</span>
              <input
                type="date"
                value={custom.hasta}
                onChange={(e) => setCustom((c) => ({ ...c, hasta: e.target.value }))}
                className="rounded-md border border-slate-300 px-3 py-1.5 focus:border-brand-500 focus:outline-none"
              />
            </label>
          </div>
        )}
        <p className="text-xs text-slate-400">
          Periodo: {desde} → {hasta}
        </p>
      </div>

      {cargando && !movimientos.length ? (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
          Cargando…
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi titulo="Ingresos" valor={totales.ingresos} color="text-green-600" />
            <Kpi titulo="Egresos" valor={totales.egresos} color="text-red-600" />
            <Kpi
              titulo="Balance neto"
              valor={totales.neto}
              color={totales.neto >= 0 ? 'text-green-600' : 'text-red-600'}
            />
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Tasa de ahorro
              </p>
              <p
                className={[
                  'mt-1 text-base font-bold sm:text-xl',
                  tasaAhorro === null
                    ? 'text-slate-400'
                    : tasaAhorro >= 0
                      ? 'text-green-600'
                      : 'text-red-600',
                ].join(' ')}
              >
                {tasaAhorro === null ? '—' : `${tasaAhorro.toFixed(1)}%`}
              </p>
            </div>
          </div>

          {/* Ingresos vs egresos (granularidad según periodo) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Ingresos vs egresos ({porDia ? 'por día' : 'por mes'})
            </h2>
            {hayIngEg ? (
              <div className="h-64 w-full sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosBar} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="etiqueta"
                      tick={{ fontSize: 11 }}
                      interval={porDia ? 'preserveStartEnd' : 0}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={48}
                      tickFormatter={(v: number) => abreviar(v)}
                    />
                    <Tooltip
                      formatter={(v, name) => [
                        formatCOP(Number(v)),
                        name === 'ingresos' ? 'Ingresos' : 'Egresos',
                      ]}
                    />
                    <Legend
                      formatter={(v) => (v === 'ingresos' ? 'Ingresos' : 'Egresos')}
                    />
                    <Bar dataKey="ingresos" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <SinDatos texto="No hay ingresos ni egresos en el periodo seleccionado." />
            )}
          </div>

          {/* Gasto por categoría */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Gasto por categoría
            </h2>
            {cats.length > 0 ? (
              <>
                <div className="h-64 w-full sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={datosPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={2}
                        label={({ percent }) =>
                          percent ? `${(percent * 100).toFixed(0)}%` : ''
                        }
                        labelLine={false}
                      >
                        {datosPie.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCOP(Number(v))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Mini-tabla */}
                <ul className="mt-4 divide-y divide-slate-100">
                  {cats.map((c, i) => (
                    <li
                      key={c.categoria}
                      className="flex items-center gap-3 py-2 text-sm"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: PALETA[i % PALETA.length] }}
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate text-slate-700">
                        {c.nombre}
                      </span>
                      <span className="text-slate-400">
                        {totalCats > 0
                          ? `${((c.total / totalCats) * 100).toFixed(1)}%`
                          : '—'}
                      </span>
                      <span className="w-28 text-right font-medium text-slate-900">
                        {formatCOP(c.total)}
                      </span>
                    </li>
                  ))}
                  <li className="flex items-center gap-3 py-2 text-sm font-semibold">
                    <span className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-slate-700">Total</span>
                    <span className="w-28 text-right text-slate-900">
                      {formatCOP(totalCats)}
                    </span>
                  </li>
                </ul>
              </>
            ) : (
              <SinDatos texto="No hay gastos en el periodo seleccionado." />
            )}
          </div>

          {/* Sección 4 — Evolución del patrimonio */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">
                Evolución del patrimonio
              </h2>
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPatrimonioModo('periodo')}
                  className={[
                    'rounded-md px-2.5 py-1 font-medium',
                    patrimonioModo === 'periodo' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500',
                  ].join(' ')}
                >
                  Periodo
                </button>
                <button
                  type="button"
                  onClick={() => setPatrimonioModo('todo')}
                  className={[
                    'rounded-md px-2.5 py-1 font-medium',
                    patrimonioModo === 'todo' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500',
                  ].join(' ')}
                >
                  Todo
                </button>
              </div>
            </div>
            {seriePatrimonio.length > 0 ? (
              <div className="h-64 w-full sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={seriePatrimonio} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="fecha"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(f: string) => f.slice(5)}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={48}
                      tickFormatter={(v: number) => abreviar(v)}
                    />
                    <Tooltip formatter={(v) => formatCOP(Number(v))} />
                    <Line
                      type="monotone"
                      dataKey="saldo"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <SinDatos texto="No hay datos de patrimonio para mostrar." />
            )}
          </div>

          {/* Sección 5 — Gasto por bolsillo + evolución de un bolsillo */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Gasto por bolsillo (periodo)
            </h2>
            {gastosBolsillo.length > 0 ? (
              <div className="w-full" style={{ height: gastosBolsillo.length * 44 + 24 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={gastosBolsillo}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => abreviar(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      tick={{ fontSize: 11 }}
                      width={110}
                    />
                    <Tooltip formatter={(v) => formatCOP(Number(v))} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {gastosBolsillo.map((g) => (
                        <Cell key={g.bolsillo} fill={g.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <SinDatos texto="No hay gastos por bolsillo en el periodo." />
            )}

            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700">
                  Evolución del saldo de un bolsillo
                </h3>
                <select
                  value={serieBolsilloId}
                  onChange={(e) => setBolsilloSerieId(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                >
                  {bolsillosActivos.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}
                    </option>
                  ))}
                </select>
              </div>
              {serieBolsillo.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={serieBolsillo} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="fecha"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(f: string) => f.slice(5)}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        width={48}
                        tickFormatter={(v: number) => abreviar(v)}
                      />
                      <Tooltip formatter={(v) => formatCOP(Number(v))} />
                      <Line
                        type="monotone"
                        dataKey="saldo"
                        stroke={bolsilloSel?.color ?? '#6366f1'}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <SinDatos texto="Este bolsillo aún no tiene movimientos." />
              )}
            </div>
          </div>

          {/* Sección 6 — Ritmo de gasto del ciclo */}
          <div
            className={[
              'rounded-xl border p-5 shadow-sm',
              excedidoCiclo ? 'border-red-300 bg-red-50' : 'border-brand-100 bg-brand-50',
            ].join(' ')}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                Ritmo de gasto (quincena actual)
              </h2>
              <span
                className={[
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  veredicto.clase,
                ].join(' ')}
              >
                {veredicto.texto}
              </span>
            </div>

            <p className="mt-3 text-lg font-semibold text-slate-900">
              Llevas gastado {formatCOP(ritmo.gastado)} de{' '}
              {formatCOP(ritmo.ingresadoCiclo)} ingresado este ciclo
            </p>

            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/70">
              <div
                className={excedidoCiclo ? 'h-full bg-red-500' : 'h-full bg-brand-500'}
                style={{ width: `${ritmo.ingresadoCiclo > 0 ? pctCiclo : 0}%` }}
              />
            </div>

            <p className="mt-3 text-sm text-slate-600">
              Vas a un ritmo de <strong>{formatCOP(ritmoDia)}/día</strong> (día{' '}
              {ritmo.diasTranscurridos} de {ritmo.diasTotales}). A este paso
              terminarás el ciclo en{' '}
              <strong>{formatCOP(ritmo.proyeccionFinCiclo)}</strong>.
            </p>
          </div>
        </>
      )}
    </section>
  )
}

/** Interpreta el ritmo comparando la proyección con lo ingresado del ciclo. */
function interpretarRitmo(
  proyeccion: number,
  ingresado: number,
  gastado: number,
): { texto: string; clase: string } {
  if (ingresado <= 0) {
    return gastado > 0
      ? { texto: 'Te estás pasando', clase: 'bg-red-100 text-red-700' }
      : { texto: 'Vas bien', clase: 'bg-green-100 text-green-700' }
  }
  const ratio = proyeccion / ingresado
  if (ratio <= 0.9) return { texto: 'Vas bien', clase: 'bg-green-100 text-green-700' }
  if (ratio <= 1.0) return { texto: 'Vas ajustado', clase: 'bg-amber-100 text-amber-700' }
  return { texto: 'Te estás pasando', clase: 'bg-red-100 text-red-700' }
}

function Kpi({
  titulo,
  valor,
  color,
}: {
  titulo: string
  valor: number
  color: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className={`mt-1 break-words text-base font-bold sm:text-xl ${color}`}>
        {formatCOP(valor)}
      </p>
    </div>
  )
}

function SinDatos({ texto }: { texto: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 text-center text-sm text-slate-400">
      {texto}
    </div>
  )
}

/** Abrevia montos grandes para los ejes (p. ej. 1.5M, 250k). */
function abreviar(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${Math.round(v / 1_000)}k`
  return String(v)
}
