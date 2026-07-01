/**
 * Motor de saldos: calcula los saldos de bolsillos y cuentas a partir de sus
 * saldos iniciales más el efecto de todos los movimientos.
 *
 * Reglas por tipo de movimiento:
 * - "ingreso": suma al bolsillo (bolsillo_id) y a la cuenta (cuenta_id).
 * - "egreso": resta del bolsillo (bolsillo_id) y de la cuenta (cuenta_id).
 * - "transferencia_cuenta": resta de cuenta_id, suma a cuenta_destino_id
 *   (no toca bolsillos).
 * - "transferencia_bolsillo": resta de bolsillo_id, suma a bolsillo_destino_id
 *   (no toca cuentas).
 * - "ajuste": suma o resta según el signo del monto; afecta al bolsillo y/o la
 *   cuenta indicados.
 */

import { getRows } from './sheets'
import type {
  BolsilloRow,
  CategoriaRow,
  ConfigRow,
  CuentaRow,
  GastoFijoRow,
  MovimientoRow,
} from '@/types/sheets'

/** Mapa id → saldo. */
export type MapaSaldos = Record<string, number>

/** Resultado del cálculo completo de saldos. */
export interface SaldosCalculados {
  bolsillos: MapaSaldos
  cuentas: MapaSaldos
}

/** Suma `delta` al id indicado, solo si el id existe en el mapa. */
function aplicar(mapa: MapaSaldos, id: string, delta: number): void {
  if (id && id in mapa) {
    mapa[id] += delta
  }
}

/** Aplica el efecto de un movimiento sobre los mapas de saldos. */
function aplicarMovimiento(
  m: MovimientoRow,
  bolsillos: MapaSaldos,
  cuentas: MapaSaldos,
): void {
  const monto = Number(m.monto) || 0
  switch (m.tipo) {
    case 'ingreso':
      aplicar(bolsillos, m.bolsillo_id, monto)
      aplicar(cuentas, m.cuenta_id, monto)
      break
    case 'egreso':
      aplicar(bolsillos, m.bolsillo_id, -monto)
      aplicar(cuentas, m.cuenta_id, -monto)
      break
    case 'transferencia_cuenta':
      aplicar(cuentas, m.cuenta_id, -monto)
      aplicar(cuentas, m.cuenta_destino_id, monto)
      break
    case 'transferencia_bolsillo':
      aplicar(bolsillos, m.bolsillo_id, -monto)
      aplicar(bolsillos, m.bolsillo_destino_id, monto)
      break
    case 'ajuste':
      // El signo del monto define si suma o resta.
      aplicar(bolsillos, m.bolsillo_id, monto)
      aplicar(cuentas, m.cuenta_id, monto)
      break
  }
}

/**
 * Calcula los saldos a partir de filas ya cargadas (función pura, sin red).
 * Úsala cuando ya tienes las filas en memoria (p. ej. desde el caché).
 */
export function calcularSaldosDesde(
  bolsillosRows: BolsilloRow[],
  cuentasRows: CuentaRow[],
  movimientos: MovimientoRow[],
): SaldosCalculados {
  const bolsillos: MapaSaldos = {}
  for (const b of bolsillosRows) {
    bolsillos[b.id] = Number(b.saldo_inicial) || 0
  }

  const cuentas: MapaSaldos = {}
  for (const c of cuentasRows) {
    cuentas[c.id] = Number(c.saldo_inicial) || 0
  }

  for (const m of movimientos) {
    aplicarMovimiento(m, bolsillos, cuentas)
  }

  return { bolsillos, cuentas }
}

/**
 * Lee las hojas y calcula los saldos de todos los bolsillos y cuentas
 * (saldo_inicial + efecto de los movimientos).
 */
export async function calcularSaldos(): Promise<SaldosCalculados> {
  const [bolsillosRows, cuentasRows, movimientos] = await Promise.all([
    getRows('Bolsillos'),
    getRows('Cuentas'),
    getRows('Movimientos'),
  ])
  return calcularSaldosDesde(bolsillosRows, cuentasRows, movimientos)
}

/** Suma todos los valores de un mapa de saldos. */
export function sumarSaldos(mapa: MapaSaldos): number {
  return Object.values(mapa).reduce((acc, v) => acc + v, 0)
}

const sumar = sumarSaldos

/**
 * Reparte un monto entre los bolsillos activos según su porcentaje.
 * Redondea cada porción al peso y, para que la suma cuadre exactamente con el
 * monto, asigna la diferencia de redondeo al bolsillo "Gastos generales"
 * (el de tipo "gasto"; si no lo encuentra, al último bolsillo activo).
 *
 * @returns Mapa bolsillo_id → monto asignado (enteros que suman exactamente `monto`).
 */
export function calcularReparto(
  monto: number,
  bolsillos: BolsilloRow[],
): MapaSaldos {
  const activos = bolsillos.filter((b) => b.activo)
  const resultado: MapaSaldos = {}
  let suma = 0
  for (const b of activos) {
    const parte = Math.round((monto * (Number(b.porcentaje) || 0)) / 100)
    resultado[b.id] = parte
    suma += parte
  }

  const diferencia = monto - suma
  if (diferencia !== 0 && activos.length > 0) {
    const objetivo =
      activos.find((b) => b.tipo === 'gasto') ??
      activos.find((b) => /gastos\s+generales/i.test(b.nombre)) ??
      activos[activos.length - 1]
    resultado[objetivo.id] = (resultado[objetivo.id] ?? 0) + diferencia
  }

  return resultado
}

/** Mapa bolsillo_id → saldo (saldo_inicial + efecto de movimientos). */
export async function saldoPorBolsillo(): Promise<MapaSaldos> {
  return (await calcularSaldos()).bolsillos
}

/** Mapa cuenta_id → saldo (saldo_inicial + efecto de movimientos). */
export async function saldoPorCuenta(): Promise<MapaSaldos> {
  return (await calcularSaldos()).cuentas
}

/**
 * Total del patrimonio líquido: suma de los saldos de todas las cuentas
 * (el dinero real disponible).
 */
export async function saldoTotal(): Promise<number> {
  return sumar((await calcularSaldos()).cuentas)
}

/** Estado de cuadre entre el total de cuentas y el total de bolsillos. */
export interface Cuadre {
  totalCuentas: number
  totalBolsillos: number
  cuadrado: boolean
  diferencia: number
}

/** Calcula el cuadre a partir de saldos ya calculados (función pura). */
export function cuadreDesde(saldos: SaldosCalculados): Cuadre {
  const totalCuentas = sumar(saldos.cuentas)
  const totalBolsillos = sumar(saldos.bolsillos)
  const diferencia = totalCuentas - totalBolsillos
  return {
    totalCuentas,
    totalBolsillos,
    cuadrado: diferencia === 0,
    diferencia,
  }
}

/**
 * Verifica que el total de cuentas coincida con el total de bolsillos.
 * `diferencia` = totalCuentas − totalBolsillos (0 si está cuadrado).
 */
export async function verificarCuadre(): Promise<Cuadre> {
  return cuadreDesde(await calcularSaldos())
}

// ---------------------------------------------------------------------------
// Ciclo (quincena calendario)
// ---------------------------------------------------------------------------

export interface Ciclo {
  /** Fecha de inicio (yyyy-mm-dd, inclusive). */
  inicio: string
  /** Fecha de fin (yyyy-mm-dd, inclusive). */
  fin: string
  /** Etiqueta legible, p. ej. "1–15 jun". */
  etiqueta: string
}

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

function ymd(anio: number, mesIndice0: number, dia: number): string {
  const mm = String(mesIndice0 + 1).padStart(2, '0')
  const dd = String(dia).padStart(2, '0')
  return `${anio}-${mm}-${dd}`
}

/**
 * Devuelve la quincena calendario en curso para una fecha dada:
 * los días 1–15 forman la primera quincena y 16–fin de mes la segunda.
 */
export function cicloQuincenal(hoy: Date): Ciclo {
  const anio = hoy.getFullYear()
  const mes = hoy.getMonth()
  const dia = hoy.getDate()
  const ultimoDia = new Date(anio, mes + 1, 0).getDate()

  const primeraMitad = dia <= 15
  const diaInicio = primeraMitad ? 1 : 16
  const diaFin = primeraMitad ? 15 : ultimoDia

  return {
    inicio: ymd(anio, mes, diaInicio),
    fin: ymd(anio, mes, diaFin),
    etiqueta: `${diaInicio}–${diaFin} ${MESES[mes]}`,
  }
}

/** Resumen de un bolsillo dentro de un rango de fechas [inicio, fin]. */
export interface ResumenCiclo {
  ingresado: number
  gastado: number
}

/**
 * Suma ingresos y egresos de un bolsillo cuyos movimientos caen dentro del
 * rango de fechas [inicio, fin] (comparación por yyyy-mm-dd, inclusive).
 */
export function resumenCicloBolsillo(
  movimientos: MovimientoRow[],
  bolsilloId: string,
  inicio: string,
  fin: string,
): ResumenCiclo {
  let ingresado = 0
  let gastado = 0
  for (const m of movimientos) {
    if (m.bolsillo_id !== bolsilloId) continue
    const fecha = (m.fecha || '').slice(0, 10)
    if (fecha < inicio || fecha > fin) continue
    const monto = Number(m.monto) || 0
    if (m.tipo === 'ingreso') ingresado += monto
    else if (m.tipo === 'egreso') gastado += monto
  }
  return { ingresado, gastado }
}

// ---------------------------------------------------------------------------
// Motor de gastos fijos
// ---------------------------------------------------------------------------

function ultimoDiaMes(anio: number, mesIndice0: number): number {
  return new Date(anio, mesIndice0 + 1, 0).getDate()
}

/** Construye una fecha acotando el día al último del mes (evita días inválidos). */
function fechaAcotada(anio: number, mesIndice0: number, dia: number): Date {
  const d = new Date(anio, mesIndice0, 1)
  const max = ultimoDiaMes(d.getFullYear(), d.getMonth())
  return new Date(d.getFullYear(), d.getMonth(), Math.min(Math.max(1, dia), max))
}

/** Fecha sin componente horario (medianoche local). */
function soloFecha(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Fecha → "yyyy-mm-dd". */
function aISO(d: Date): string {
  return ymd(d.getFullYear(), d.getMonth(), d.getDate())
}

/** "yyyy-mm-dd" → Date (medianoche local). */
function desdeISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** Diferencia en días entre dos fechas ISO (b − a). */
function diffDias(aStr: string, bStr: string): number {
  return Math.round(
    (desdeISO(bStr).getTime() - desdeISO(aStr).getTime()) / 86_400_000,
  )
}

/**
 * Calcula la próxima fecha de pago (ISO yyyy-mm-dd) a partir de una fecha base.
 * "Próxima" incluye la propia fecha base (si cae justo hoy, devuelve hoy).
 *
 * - "mensual": el día `dia` del mes; si ya pasó este mes, el del mes siguiente.
 *   Si el mes no tiene ese día, usa el último día del mes.
 * - "quincenal": dos fechas al mes (día `dia` y `dia`+15, acotadas al fin de
 *   mes); devuelve la próxima.
 * - "semanal": `dia` es el día de la semana (0 = domingo … 6 = sábado); la
 *   próxima ocurrencia.
 * - "anual": el mismo día cada año. Como GastosFijos no tiene columna de mes,
 *   se ancla al mes de la fecha base (`desde`); si ya pasó, el año siguiente.
 */
export function calcularProximoPago(
  frecuencia: string,
  dia: number,
  desde: Date,
): string {
  const base = soloFecha(desde)

  switch (frecuencia) {
    case 'quincenal': {
      const candidatos = [
        fechaAcotada(base.getFullYear(), base.getMonth(), dia),
        fechaAcotada(base.getFullYear(), base.getMonth(), dia + 15),
        // Respaldo: primera fecha del mes siguiente.
        fechaAcotada(base.getFullYear(), base.getMonth() + 1, dia),
      ].sort((a, b) => a.getTime() - b.getTime())
      const prox = candidatos.find((c) => c >= base) ?? candidatos[candidatos.length - 1]
      return aISO(prox)
    }

    case 'semanal': {
      const objetivo = ((dia % 7) + 7) % 7
      const delta = (objetivo - base.getDay() + 7) % 7
      const cand = new Date(base)
      cand.setDate(base.getDate() + delta)
      return aISO(cand)
    }

    case 'anual': {
      let cand = fechaAcotada(base.getFullYear(), base.getMonth(), dia)
      if (cand < base) cand = fechaAcotada(base.getFullYear() + 1, base.getMonth(), dia)
      return aISO(cand)
    }

    case 'mensual':
    default: {
      let cand = fechaAcotada(base.getFullYear(), base.getMonth(), dia)
      if (cand < base) {
        cand = fechaAcotada(base.getFullYear(), base.getMonth() + 1, dia)
      }
      return aISO(cand)
    }
  }
}

export type EstadoPago = 'vencido' | 'vence_hoy' | 'proximo' | 'futuro'

export interface EstadoGastoFijo {
  /** Próxima fecha de pago (ISO yyyy-mm-dd). */
  proximoPago: string
  /** Días desde hoy hasta el próximo pago (negativo si está vencido). */
  diasRestantes: number
  estado: EstadoPago
}

/**
 * Determina el estado de un gasto fijo respecto a `hoy`.
 * Usa el campo `proximo_pago` del gasto si está definido; si no, lo calcula.
 * - "vencido": proximoPago < hoy.
 * - "vence_hoy": proximoPago === hoy.
 * - "proximo": dentro de los próximos 7 días.
 * - "futuro": más allá de 7 días.
 */
export function estadoGastoFijo(
  gasto: GastoFijoRow,
  hoy: Date,
): EstadoGastoFijo {
  const hoyStr = aISO(soloFecha(hoy))
  const proximoPago = gasto.proximo_pago?.trim()
    ? gasto.proximo_pago.slice(0, 10)
    : calcularProximoPago(gasto.frecuencia, Number(gasto.dia) || 1, hoy)

  const diasRestantes = diffDias(hoyStr, proximoPago)

  let estado: EstadoPago
  if (proximoPago < hoyStr) estado = 'vencido'
  else if (proximoPago === hoyStr) estado = 'vence_hoy'
  else if (diasRestantes <= 7) estado = 'proximo'
  else estado = 'futuro'

  return { proximoPago, diasRestantes, estado }
}

export interface OpcionesReserva {
  /**
   * Si se define (yyyy-mm-dd), solo se reservan los gastos cuyo próximo pago
   * caiga en o antes de esa fecha. Por defecto NO hay límite: se reserva
   * siempre el próximo pago de cada gasto fijo activo.
   */
  horizonte?: string
}

/**
 * Calcula el monto reservado por bolsillo para cubrir gastos fijos.
 *
 * REGLA DE RESERVA (por defecto, sin límite de fecha):
 * Para cada gasto fijo ACTIVO se reserva su `monto` en su `bolsillo_id`, usando
 * su `proximo_pago` vigente (el siguiente que se debe pagar). Como `proximo_pago`
 * ya apunta al siguiente pago pendiente (se avanza al registrar cada pago), se
 * reserva exactamente UNA ocurrencia por gasto — nunca dos.
 *
 * Se puede pasar `opciones.horizonte` (yyyy-mm-dd) para volver a limitar la
 * reserva a los pagos hasta cierta fecha; por defecto no se aplica límite.
 *
 * Las reservas son solo una VISTA (presupuesto): NO son movimientos, no alteran
 * los saldos reales ni el cuadre.
 */
export function reservasPorBolsillo(
  gastosFijos: GastoFijoRow[],
  hoy: Date,
  opciones: OpcionesReserva = {},
): MapaSaldos {
  const reservas: MapaSaldos = {}
  for (const gf of gastosFijos) {
    if (!gf.activo) continue

    const proximoPago = gf.proximo_pago?.trim()
      ? gf.proximo_pago.slice(0, 10)
      : calcularProximoPago(gf.frecuencia, Number(gf.dia) || 1, hoy)

    // Límite opcional: si se define un horizonte, ignora pagos posteriores.
    if (opciones.horizonte && proximoPago > opciones.horizonte) continue

    const id = gf.bolsillo_id
    if (!id) continue
    reservas[id] = (reservas[id] ?? 0) + (Number(gf.monto) || 0)
  }
  return reservas
}

/**
 * Disponible real por bolsillo = saldo − reservado.
 * No modifica los saldos; devuelve un mapa nuevo.
 */
export function disponibleRealPorBolsillo(
  saldos: MapaSaldos,
  reservas: MapaSaldos,
): MapaSaldos {
  const resultado: MapaSaldos = {}
  for (const [id, saldo] of Object.entries(saldos)) {
    resultado[id] = saldo - (reservas[id] ?? 0)
  }
  return resultado
}

// ---------------------------------------------------------------------------
// Agregaciones para reportes / gráficas
// ---------------------------------------------------------------------------
//
// Nota: para los TOTALES de ingreso/egreso se ignoran las transferencias
// (transferencia_cuenta y transferencia_bolsillo) y los ajustes, porque no son
// ingreso ni gasto real. Las transferencias sí se consideran donde procede
// (p. ej. en las series de saldo, donde una transferencia entre bolsillos mueve
// dinero entre ellos, y una entre cuentas no cambia el total).

const fecha10 = (m: MovimientoRow): string => (m.fecha || '').slice(0, 10)

/** Devuelve los movimientos con fecha dentro de [desde, hasta] (inclusive). */
export function filtrarPorPeriodo(
  movimientos: MovimientoRow[],
  desde: string,
  hasta: string,
): MovimientoRow[] {
  return movimientos.filter((m) => {
    const f = fecha10(m)
    return f >= desde && f <= hasta
  })
}

export interface TotalesPeriodo {
  ingresos: number
  egresos: number
  neto: number
}

/** Totales de ingresos y egresos (excluye transferencias y ajustes). */
export function totalesPeriodo(movimientos: MovimientoRow[]): TotalesPeriodo {
  let ingresos = 0
  let egresos = 0
  for (const m of movimientos) {
    const monto = Number(m.monto) || 0
    if (m.tipo === 'ingreso') ingresos += monto
    else if (m.tipo === 'egreso') egresos += monto
  }
  return { ingresos, egresos, neto: ingresos - egresos }
}

export interface GastoCategoria {
  categoria: string
  nombre: string
  total: number
  color?: string
}

/** Egresos agrupados por categoría, ordenados de mayor a menor. */
export function gastoPorCategoria(
  movimientos: MovimientoRow[],
  categorias: CategoriaRow[],
): GastoCategoria[] {
  const nombreDe = new Map(categorias.map((c) => [c.id, c.nombre]))
  const totales = new Map<string, number>()
  for (const m of movimientos) {
    if (m.tipo !== 'egreso') continue
    const key = m.categoria_id || ''
    totales.set(key, (totales.get(key) ?? 0) + (Number(m.monto) || 0))
  }
  return [...totales.entries()]
    .map(([categoria, total]) => ({
      categoria,
      nombre: nombreDe.get(categoria) ?? 'Sin categoría',
      total,
    }))
    .sort((a, b) => b.total - a.total)
}

export interface GastoBolsillo {
  bolsillo: string
  nombre: string
  color: string
  total: number
}

/** Egresos agrupados por bolsillo (con nombre y color), de mayor a menor. */
export function gastoPorBolsillo(
  movimientos: MovimientoRow[],
  bolsillos: BolsilloRow[],
): GastoBolsillo[] {
  const info = new Map(bolsillos.map((b) => [b.id, b]))
  const totales = new Map<string, number>()
  for (const m of movimientos) {
    if (m.tipo !== 'egreso') continue
    const key = m.bolsillo_id || ''
    totales.set(key, (totales.get(key) ?? 0) + (Number(m.monto) || 0))
  }
  return [...totales.entries()]
    .map(([bolsillo, total]) => {
      const b = info.get(bolsillo)
      return {
        bolsillo,
        nombre: b?.nombre ?? 'Sin bolsillo',
        color: b?.color ?? '#94a3b8',
        total,
      }
    })
    .sort((a, b) => b.total - a.total)
}

export interface MesIngresoEgreso {
  mes: string
  etiqueta: string
  ingresos: number
  egresos: number
  neto: number
}

/**
 * Serie de ingresos vs egresos por mes para los últimos `nMeses` (incluye el
 * mes actual). Rellena con 0 los meses sin datos.
 */
export function ingresoVsEgresoPorMes(
  movimientos: MovimientoRow[],
  nMeses: number,
): MesIngresoEgreso[] {
  const hoy = new Date()
  const meses: MesIngresoEgreso[] = []
  for (let i = nMeses - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    meses.push({
      mes,
      etiqueta: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
      ingresos: 0,
      egresos: 0,
      neto: 0,
    })
  }
  const indice = new Map(meses.map((m, i) => [m.mes, i]))
  for (const m of movimientos) {
    if (m.tipo !== 'ingreso' && m.tipo !== 'egreso') continue
    const mes = fecha10(m).slice(0, 7)
    const i = indice.get(mes)
    if (i === undefined) continue
    const monto = Number(m.monto) || 0
    if (m.tipo === 'ingreso') meses[i].ingresos += monto
    else meses[i].egresos += monto
  }
  for (const m of meses) m.neto = m.ingresos - m.egresos
  return meses
}

/**
 * Ingresos vs egresos agrupados por MES dentro de un rango [desde, hasta].
 * Enumera todos los meses del rango (rellena con 0 los vacíos).
 */
export function ingresoVsEgresoPorMesRango(
  movimientos: MovimientoRow[],
  desde: string,
  hasta: string,
): MesIngresoEgreso[] {
  const d0 = desdeISO(desde)
  const d1 = desdeISO(hasta)
  const meses: MesIngresoEgreso[] = []
  let y = d0.getFullYear()
  let m = d0.getMonth()
  const yFin = d1.getFullYear()
  const mFin = d1.getMonth()
  while (y < yFin || (y === yFin && m <= mFin)) {
    meses.push({
      mes: `${y}-${String(m + 1).padStart(2, '0')}`,
      etiqueta: `${MESES[m]} ${y}`,
      ingresos: 0,
      egresos: 0,
      neto: 0,
    })
    m++
    if (m > 11) {
      m = 0
      y++
    }
  }
  const indice = new Map(meses.map((x, i) => [x.mes, i]))
  for (const mv of movimientos) {
    if (mv.tipo !== 'ingreso' && mv.tipo !== 'egreso') continue
    const i = indice.get(fecha10(mv).slice(0, 7))
    if (i === undefined) continue
    const monto = Number(mv.monto) || 0
    if (mv.tipo === 'ingreso') meses[i].ingresos += monto
    else meses[i].egresos += monto
  }
  for (const x of meses) x.neto = x.ingresos - x.egresos
  return meses
}

export interface DiaIngresoEgreso {
  dia: string
  etiqueta: string
  ingresos: number
  egresos: number
  neto: number
}

/**
 * Ingresos vs egresos agrupados por DÍA dentro de un rango [desde, hasta].
 * Enumera todos los días del rango (rellena con 0 los vacíos).
 */
export function ingresoVsEgresoPorDia(
  movimientos: MovimientoRow[],
  desde: string,
  hasta: string,
): DiaIngresoEgreso[] {
  const dias: DiaIngresoEgreso[] = []
  let cur = desdeISO(desde)
  const fin = desdeISO(hasta)
  while (cur <= fin) {
    dias.push({
      dia: aISO(cur),
      etiqueta: String(cur.getDate()),
      ingresos: 0,
      egresos: 0,
      neto: 0,
    })
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
  }
  const indice = new Map(dias.map((x, i) => [x.dia, i]))
  for (const mv of movimientos) {
    if (mv.tipo !== 'ingreso' && mv.tipo !== 'egreso') continue
    const i = indice.get(fecha10(mv))
    if (i === undefined) continue
    const monto = Number(mv.monto) || 0
    if (mv.tipo === 'ingreso') dias[i].ingresos += monto
    else dias[i].egresos += monto
  }
  for (const x of dias) x.neto = x.ingresos - x.egresos
  return dias
}

export interface PuntoSaldo {
  fecha: string
  saldo: number
}

/** Efecto de un movimiento sobre el total de cuentas (patrimonio líquido). */
function deltaTotalCuentas(m: MovimientoRow): number {
  const monto = Number(m.monto) || 0
  switch (m.tipo) {
    case 'ingreso':
      return m.cuenta_id ? monto : 0
    case 'egreso':
      return m.cuenta_id ? -monto : 0
    case 'ajuste':
      return m.cuenta_id ? monto : 0
    // Las transferencias entre cuentas no cambian el total; las de bolsillo tampoco.
    default:
      return 0
  }
}

function ordenarPorFecha(movimientos: MovimientoRow[]): MovimientoRow[] {
  return [...movimientos].sort((a, b) => {
    const fa = fecha10(a)
    const fb = fecha10(b)
    if (fa !== fb) return fa < fb ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
}

/**
 * Serie temporal del patrimonio líquido acumulado (un punto por fecha, con el
 * saldo al final de ese día). Parte de `saldoInicialTotal`.
 */
export function seriedPatrimonio(
  movimientos: MovimientoRow[],
  saldoInicialTotal: number,
): PuntoSaldo[] {
  let saldo = saldoInicialTotal
  const porFecha = new Map<string, number>()
  for (const m of ordenarPorFecha(movimientos)) {
    saldo += deltaTotalCuentas(m)
    porFecha.set(fecha10(m), saldo)
  }
  return [...porFecha.entries()].map(([fecha, s]) => ({ fecha, saldo: s }))
}

/** Efecto de un movimiento sobre el saldo de un bolsillo concreto. */
function deltaBolsillo(m: MovimientoRow, id: string): number {
  const monto = Number(m.monto) || 0
  switch (m.tipo) {
    case 'ingreso':
      return m.bolsillo_id === id ? monto : 0
    case 'egreso':
      return m.bolsillo_id === id ? -monto : 0
    case 'transferencia_bolsillo':
      if (m.bolsillo_id === id) return -monto
      if (m.bolsillo_destino_id === id) return monto
      return 0
    case 'ajuste':
      return m.bolsillo_id === id ? monto : 0
    default:
      return 0
  }
}

/** Serie temporal del saldo de un bolsillo específico. */
export function serieSaldoBolsillo(
  movimientos: MovimientoRow[],
  bolsillo: BolsilloRow,
  saldoInicialBolsillo: number,
): PuntoSaldo[] {
  const id = bolsillo.id
  let saldo = saldoInicialBolsillo
  const porFecha = new Map<string, number>()
  for (const m of ordenarPorFecha(movimientos)) {
    const delta = deltaBolsillo(m, id)
    if (delta === 0) continue
    saldo += delta
    porFecha.set(fecha10(m), saldo)
  }
  return [...porFecha.entries()].map(([fecha, s]) => ({ fecha, saldo: s }))
}

export interface RitmoGasto {
  gastado: number
  diasTranscurridos: number
  diasTotales: number
  proyeccionFinCiclo: number
  ingresadoCiclo: number
}

/**
 * Ritmo de gasto del bolsillo de tipo "gasto" en la quincena actual.
 * `_config` queda reservado para futuros ciclos configurables; hoy se usa la
 * quincena calendario (cicloQuincenal).
 */
export function ritmoGastoCiclo(
  movimientos: MovimientoRow[],
  bolsillos: BolsilloRow[],
  hoy: Date,
  _config?: ConfigRow[],
): RitmoGasto {
  const ciclo = cicloQuincenal(hoy)
  const gasto = bolsillos.find((b) => b.tipo === 'gasto')
  const diasTotales = diffDias(ciclo.inicio, ciclo.fin) + 1
  if (!gasto) {
    return {
      gastado: 0,
      diasTranscurridos: 0,
      diasTotales,
      proyeccionFinCiclo: 0,
      ingresadoCiclo: 0,
    }
  }
  const { ingresado, gastado } = resumenCicloBolsillo(
    movimientos,
    gasto.id,
    ciclo.inicio,
    ciclo.fin,
  )
  const hoyStr = aISO(soloFecha(hoy))
  const diasTranscurridos = Math.min(
    Math.max(diffDias(ciclo.inicio, hoyStr) + 1, 1),
    diasTotales,
  )
  const proyeccionFinCiclo =
    diasTranscurridos > 0
      ? Math.round((gastado / diasTranscurridos) * diasTotales)
      : 0
  return {
    gastado,
    diasTranscurridos,
    diasTotales,
    proyeccionFinCiclo,
    ingresadoCiclo: ingresado,
  }
}
