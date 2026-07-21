import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getRows } from './sheets'
import {
  aporteSugerido,
  calcularSaldosDesde,
  cuadreDesde,
  disponibleRealPorBolsillo,
  estadoGastoFijo,
  estadoMeta,
  estadoPrestamo,
  montoPendiente,
  progresoMeta,
  reservasPorBolsillo,
  sumarSaldos,
  totalPorCobrar,
  type AporteSugerido,
  type Cuadre,
  type EstadoGastoFijo,
  type EstadoMetaCalc,
  type EstadoPrestamoCalc,
  type MapaSaldos,
  type ProgresoMeta,
  type SaldosCalculados,
} from './calculos'
import type {
  BolsilloRow,
  CategoriaRow,
  ConfigRow,
  CuentaRow,
  GastoFijoRow,
  MetaRow,
  MovimientoRow,
  PrestamoRow,
} from '@/types/sheets'

/** Un gasto fijo junto con su estado calculado (para la lista de próximos pagos). */
export interface ProximoPago extends EstadoGastoFijo {
  gasto: GastoFijoRow
}

/** Una meta con sus campos calculados. */
export interface MetaCalculada {
  meta: MetaRow
  /** Bolsillo (tipo meta) asociado, si existe. */
  bolsillo?: BolsilloRow
  progreso: ProgresoMeta
  aporte: AporteSugerido
  estado: EstadoMetaCalc
}

/** Un préstamo con sus campos calculados. */
export interface PrestamoCalculado {
  prestamo: PrestamoRow
  /** Monto que aún falta por cobrar. */
  pendiente: number
  estado: EstadoPrestamoCalc
}

interface FinanzasCtx {
  bolsillos: BolsilloRow[]
  cuentas: CuentaRow[]
  categorias: CategoriaRow[]
  movimientos: MovimientoRow[]
  gastosFijos: GastoFijoRow[]
  metas: MetaCalculada[]
  prestamos: PrestamoCalculado[]
  /** Total por cobrar (suma de lo pendiente de préstamos no pagados). */
  totalPorCobrar: number
  config: ConfigRow[]
  /** Saldos calculados (bolsillos y cuentas). */
  saldos: SaldosCalculados
  cuadre: Cuadre
  /** Patrimonio líquido total (suma de cuentas). */
  total: number
  /** Monto reservado por bolsillo para gastos fijos próximos (solo vista). */
  reservas: MapaSaldos
  /** Disponible real por bolsillo = saldo − reservado. */
  disponibleReal: MapaSaldos
  /** Gastos fijos activos con su estado, ordenados por fecha de próximo pago. */
  proximosPagos: ProximoPago[]
  /** Devuelve el bolsillo asociado a una meta (o undefined). */
  bolsilloDeMeta: (meta: MetaRow) => BolsilloRow | undefined
  cargando: boolean
  error: string | null
  /** Vuelve a leer todas las hojas (refresca el caché). */
  refrescar: () => Promise<void>
  /** Nombre de un bolsillo/cuenta/categoría por su id (o '' si no existe). */
  nombreDe: (id: string) => string
  /** Valor de una clave de Config (o '' si no existe). */
  configValor: (clave: string) => string
}

const FinanzasContext = createContext<FinanzasCtx | null>(null)

export function FinanzasProvider({ children }: { children: ReactNode }) {
  const [bolsillos, setBolsillos] = useState<BolsilloRow[]>([])
  const [cuentas, setCuentas] = useState<CuentaRow[]>([])
  const [categorias, setCategorias] = useState<CategoriaRow[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([])
  const [gastosFijos, setGastosFijos] = useState<GastoFijoRow[]>([])
  const [metasRows, setMetasRows] = useState<MetaRow[]>([])
  const [prestamosRows, setPrestamosRows] = useState<PrestamoRow[]>([])
  const [config, setConfig] = useState<ConfigRow[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const primeraCarga = useRef(true)

  const refrescar = useCallback(async () => {
    // Solo mostramos "cargando" a pantalla completa en la primera carga.
    if (primeraCarga.current) setCargando(true)
    setError(null)
    try {
      const [bs, cs, cats, movs, gfs, mts, prs, cfg] = await Promise.all([
        getRows('Bolsillos'),
        getRows('Cuentas'),
        getRows('Categorias'),
        getRows('Movimientos'),
        getRows('GastosFijos'),
        getRows('Metas'),
        getRows('Prestamos'),
        getRows('Config'),
      ])
      setBolsillos(bs)
      setCuentas(cs)
      setCategorias(cats)
      setMovimientos(movs)
      setGastosFijos(gfs)
      setMetasRows(mts)
      setPrestamosRows(prs)
      setConfig(cfg)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudieron cargar los datos.',
      )
    } finally {
      setCargando(false)
      primeraCarga.current = false
    }
  }, [])

  useEffect(() => {
    void refrescar()
  }, [refrescar])

  const saldos = useMemo(
    () => calcularSaldosDesde(bolsillos, cuentas, movimientos),
    [bolsillos, cuentas, movimientos],
  )
  const cuadre = useMemo(() => cuadreDesde(saldos), [saldos])
  const total = useMemo(() => sumarSaldos(saldos.cuentas), [saldos])

  const reservas = useMemo(
    () => reservasPorBolsillo(gastosFijos, new Date(), movimientos, config),
    [gastosFijos, movimientos, config],
  )
  const disponibleReal = useMemo(
    () => disponibleRealPorBolsillo(saldos.bolsillos, reservas),
    [saldos, reservas],
  )
  const proximosPagos = useMemo<ProximoPago[]>(() => {
    const hoy = new Date()
    return gastosFijos
      .filter((g) => g.activo)
      .map((gasto) => ({ gasto, ...estadoGastoFijo(gasto, hoy) }))
      .sort((a, b) => (a.proximoPago < b.proximoPago ? -1 : 1))
  }, [gastosFijos])

  const bolsilloPorId = useMemo(() => {
    const mapa = new Map<string, BolsilloRow>()
    for (const b of bolsillos) mapa.set(b.id, b)
    return mapa
  }, [bolsillos])

  const metas = useMemo<MetaCalculada[]>(() => {
    const hoy = new Date()
    return metasRows.map((meta) => ({
      meta,
      bolsillo: bolsilloPorId.get(meta.bolsillo_id),
      progreso: progresoMeta(meta, saldos),
      aporte: aporteSugerido(meta, saldos, hoy, config),
      estado: estadoMeta(meta, saldos, hoy),
    }))
  }, [metasRows, saldos, bolsilloPorId, config])

  const prestamos = useMemo<PrestamoCalculado[]>(() => {
    const hoy = new Date()
    return prestamosRows.map((prestamo) => ({
      prestamo,
      pendiente: montoPendiente(prestamo),
      estado: estadoPrestamo(prestamo, hoy),
    }))
  }, [prestamosRows])

  const totalCobrar = useMemo(
    () => totalPorCobrar(prestamosRows),
    [prestamosRows],
  )

  const nombrePorId = useMemo(() => {
    const mapa: Record<string, string> = {}
    for (const b of bolsillos) mapa[b.id] = b.nombre
    for (const c of cuentas) mapa[c.id] = c.nombre
    for (const c of categorias) mapa[c.id] = c.nombre
    return mapa
  }, [bolsillos, cuentas, categorias])

  const configMapa = useMemo(() => {
    const mapa: Record<string, string> = {}
    for (const c of config) mapa[c.clave] = c.valor
    return mapa
  }, [config])

  const valor: FinanzasCtx = {
    bolsillos,
    cuentas,
    categorias,
    movimientos,
    gastosFijos,
    metas,
    prestamos,
    totalPorCobrar: totalCobrar,
    config,
    saldos,
    cuadre,
    total,
    reservas,
    disponibleReal,
    proximosPagos,
    bolsilloDeMeta: (meta: MetaRow) => bolsilloPorId.get(meta.bolsillo_id),
    cargando,
    error,
    refrescar,
    nombreDe: (id) => nombrePorId[id] ?? '',
    configValor: (clave) => configMapa[clave] ?? '',
  }

  return (
    <FinanzasContext.Provider value={valor}>
      {children}
    </FinanzasContext.Provider>
  )
}

export function useFinanzas(): FinanzasCtx {
  const ctx = useContext(FinanzasContext)
  if (!ctx) {
    throw new Error('useFinanzas debe usarse dentro de <FinanzasProvider>.')
  }
  return ctx
}
