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
  MetaRow,
  MovimientoRow,
  PrestamoRow,
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
    case 'prestamo_otorgado':
      // Sale plata (queda como préstamo por cobrar): resta bolsillo y cuenta.
      aplicar(bolsillos, m.bolsillo_id, -monto)
      aplicar(cuentas, m.cuenta_id, -monto)
      break
    case 'prestamo_devuelto':
      // Regresa la plata prestada: suma bolsillo y cuenta.
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
  // Los bolsillos tipo "meta" no participan en el reparto por porcentaje.
  const activos = bolsillos.filter((b) => b.activo && b.tipo !== 'meta')
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
// Ciclo de quincena
// ---------------------------------------------------------------------------
// `cicloQuincenal` es la quincena de calendario (1–15 / 16–fin de mes) y se usa
// solo como respaldo. `cicloActual` es el ciclo real: se ancla al ingreso que el
// usuario marca como su pago de quincena (movimientos con `es_quincena = TRUE`).

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

/** Lee `dias_ciclo` de Config (duración del ciclo por defecto); 15 si no existe. */
function leerDiasCiclo(config?: ConfigRow[]): number {
  const raw = config?.find((c) => c.clave === 'dias_ciclo')?.valor
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 15
}

/** Etiqueta legible de un rango [inicio, fin] (ISO), p. ej. "16–31 jul". */
function etiquetaRango(inicio: string, fin: string): string {
  const a = desdeISO(inicio)
  const b = desdeISO(fin)
  const mismoMes =
    a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  return mismoMes
    ? `${a.getDate()}–${b.getDate()} ${MESES[a.getMonth()]}`
    : `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]}`
}

/**
 * Ciclo de quincena anclado al INGRESO de quincena, en vez del calendario. Un
 * ingreso ancla el ciclo si su categoría es "Quincena" (por el id de la
 * categoría cuyo nombre es "Quincena", sin distinguir mayúsculas) o, como opción
 * avanzada, si tiene `es_quincena = TRUE`. Basta con elegir la categoría
 * "Quincena" al registrar el ingreso; el flag es opcional.
 *
 * - `inicio`: la fecha del ingreso de quincena más reciente que no supere `hoy`
 *   (si el ingreso se repartió, todas sus filas comparten fecha).
 * - `fin`: el día anterior a la SIGUIENTE fecha de quincena; si no hay una
 *   posterior, `inicio` + `dias_ciclo` días (Config `dias_ciclo`, por defecto 15).
 * - Si no existe ningún ingreso de quincena, cae en la quincena calendario
 *   (`cicloQuincenal`) para no romper el comportamiento previo.
 */
export function cicloActual(
  movimientos: MovimientoRow[],
  hoy: Date,
  categorias: CategoriaRow[] = [],
  config?: ConfigRow[],
): Ciclo {
  const hoyStr = aISO(soloFecha(hoy))

  // Id(s) de la categoría "Quincena" (por nombre, sin distinguir mayúsculas).
  const idsQuincena = new Set(
    categorias
      .filter((c) => c.nombre.trim().toLowerCase() === 'quincena')
      .map((c) => c.id),
  )

  // Un ingreso ancla el ciclo si su categoría es "Quincena" o si es_quincena=TRUE.
  const esIngresoQuincena = (m: MovimientoRow): boolean =>
    m.tipo === 'ingreso' &&
    (m.es_quincena || (m.categoria_id !== '' && idsQuincena.has(m.categoria_id)))

  // Fechas distintas de ingresos de quincena, ordenadas ascendente.
  const fechasQuincena = [
    ...new Set(
      movimientos
        .filter(esIngresoQuincena)
        .map((m) => (m.fecha || '').slice(0, 10))
        .filter(Boolean),
    ),
  ].sort()

  // inicio = la fecha de quincena más reciente que no supere hoy.
  const inicio = [...fechasQuincena].reverse().find((f) => f <= hoyStr)

  // Respaldo: sin ningún ingreso de quincena, usa la quincena calendario.
  if (!inicio) return cicloQuincenal(hoy)

  const siguiente = fechasQuincena.find((f) => f > inicio)
  const fin = siguiente
    ? aISO(sumarDias(desdeISO(siguiente), -1))
    : aISO(sumarDias(desdeISO(inicio), leerDiasCiclo(config)))

  return { inicio, fin, etiqueta: etiquetaRango(inicio, fin) }
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

/** Devuelve una nueva fecha desplazada `n` días (n puede ser negativo). */
function sumarDias(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
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

/**
 * Calcula el monto reservado por bolsillo para cubrir gastos fijos.
 *
 * REGLA DE RESERVA (anclada al ciclo de quincena actual):
 * Solo se reserva un gasto fijo ACTIVO si su `proximo_pago` cae en o antes del
 * FIN del ciclo actual (`cicloActual`). Es decir:
 * - Vencido o dentro del ciclo y aún no pagado (`proximo_pago` <= fin): se reserva.
 * - Pago cuyo `proximo_pago` es posterior al fin del ciclo: NO se reserva todavía;
 *   se cubrirá con el ingreso de la próxima quincena.
 *
 * Como `proximo_pago` ya apunta al siguiente pago pendiente (se avanza al
 * registrar cada pago), un gasto ya pagado de este ciclo apunta al mes siguiente
 * y por tanto queda fuera del horizonte: no se reserva dos veces.
 *
 * Las reservas son solo una VISTA (presupuesto): NO son movimientos, no alteran
 * los saldos reales ni el cuadre.
 */
export function reservasPorBolsillo(
  gastosFijos: GastoFijoRow[],
  hoy: Date,
  movimientos: MovimientoRow[],
  categorias: CategoriaRow[] = [],
  config?: ConfigRow[],
): MapaSaldos {
  // Horizonte de reserva: fin del ciclo actual. (Ajusta esta línea para ampliar
  // o acortar cuánto por adelantado se reservan los pagos fijos.)
  const horizonte = cicloActual(movimientos, hoy, categorias, config).fin

  const reservas: MapaSaldos = {}
  for (const gf of gastosFijos) {
    if (!gf.activo) continue

    const proximoPago = gf.proximo_pago?.trim()
      ? gf.proximo_pago.slice(0, 10)
      : calcularProximoPago(gf.frecuencia, Number(gf.dia) || 1, hoy)

    // Solo reserva pagos que caen en o antes del fin del ciclo actual.
    if (proximoPago > horizonte) continue

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
    case 'prestamo_otorgado':
      return m.cuenta_id ? -monto : 0
    case 'prestamo_devuelto':
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
    case 'prestamo_otorgado':
      return m.bolsillo_id === id ? -monto : 0
    case 'prestamo_devuelto':
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
 * Ritmo de gasto del bolsillo de tipo "gasto" en el ciclo de quincena actual.
 * El ciclo se ancla al ingreso marcado como quincena (`cicloActual`), por lo que
 * el pago de quincena registrado hoy cuenta dentro de este ciclo. Suma ingresos
 * y gastos desde el inicio del ciclo hasta hoy (sin pasar del fin del ciclo).
 */
export function ritmoGastoCiclo(
  movimientos: MovimientoRow[],
  bolsillos: BolsilloRow[],
  hoy: Date,
  categorias: CategoriaRow[] = [],
  config?: ConfigRow[],
): RitmoGasto {
  const ciclo = cicloActual(movimientos, hoy, categorias, config)
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
  const hoyStr = aISO(soloFecha(hoy))
  // Cuenta desde el inicio del ciclo hasta hoy, sin pasar del fin del ciclo.
  const hasta = hoyStr < ciclo.fin ? hoyStr : ciclo.fin
  const { ingresado, gastado } = resumenCicloBolsillo(
    movimientos,
    gasto.id,
    ciclo.inicio,
    hasta,
  )
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

// ---------------------------------------------------------------------------
// Metas de ahorro
// ---------------------------------------------------------------------------

export interface ProgresoMeta {
  /** Saldo actual del bolsillo de la meta. */
  actual: number
  /** Monto objetivo de la meta. */
  objetivo: number
  /** Porcentaje de avance (0–100, con tope 100 para la barra). */
  porcentaje: number
  /** Lo que falta para llegar al objetivo (0 si ya se cumplió). */
  faltante: number
  cumplida: boolean
}

/** Progreso de una meta a partir del saldo de su bolsillo. */
export function progresoMeta(meta: MetaRow, saldos: SaldosCalculados): ProgresoMeta {
  const actual = saldos.bolsillos[meta.bolsillo_id] ?? 0
  const objetivo = Number(meta.monto_objetivo) || 0
  const porcentaje =
    objetivo > 0 ? Math.min(100, (actual / objetivo) * 100) : 0
  const faltante = Math.max(0, objetivo - actual)
  const cumplida = objetivo > 0 && actual >= objetivo
  return { actual, objetivo, porcentaje, faltante, cumplida }
}

export interface AporteSugerido {
  /** Aporte sugerido por quincena para alcanzar la meta a tiempo. */
  aporte: number
  /** Quincenas restantes hasta la fecha objetivo (mínimo 1), o null si no hay fecha. */
  quincenasRestantes: number | null
  /** Días restantes hasta la fecha objetivo, o null si no hay fecha. */
  diasRestantes: number | null
}

/**
 * Aporte sugerido por quincena: el faltante repartido entre las quincenas que
 * quedan hasta la fecha objetivo (mínimo 1 quincena). Si no hay fecha objetivo,
 * sugiere el faltante completo.
 */
export function aporteSugerido(
  meta: MetaRow,
  saldos: SaldosCalculados,
  hoy: Date,
  _config?: ConfigRow[],
): AporteSugerido {
  const { faltante } = progresoMeta(meta, saldos)
  const fecha = meta.fecha_objetivo?.trim() ? meta.fecha_objetivo.slice(0, 10) : ''

  if (!fecha) {
    return { aporte: faltante, quincenasRestantes: null, diasRestantes: null }
  }

  const hoyStr = aISO(soloFecha(hoy))
  const diasRestantes = diffDias(hoyStr, fecha)
  // Una quincena = 15 días. Al menos 1 para no dividir por cero.
  const quincenasRestantes = Math.max(1, Math.ceil(diasRestantes / 15))
  const aporte = Math.ceil(faltante / quincenasRestantes)
  return { aporte, quincenasRestantes, diasRestantes }
}

export type EstadoMetaCalc = 'cumplida' | 'en_camino' | 'atrasada' | 'sin_fecha'

/** Días por debajo de los cuales, con faltante pendiente, se considera atrasada. */
const DIAS_MINIMOS_RAZONABLES = 7

/**
 * Estado de una meta según su progreso y su fecha objetivo:
 * - "cumplida": el saldo ya alcanzó el objetivo.
 * - "sin_fecha": no tiene fecha objetivo definida.
 * - "atrasada": la fecha ya pasó sin cumplirse, o quedan menos días de los
 *   razonables (`DIAS_MINIMOS_RAZONABLES`) y aún falta dinero.
 * - "en_camino": el resto de los casos.
 */
export function estadoMeta(
  meta: MetaRow,
  saldos: SaldosCalculados,
  hoy: Date,
): EstadoMetaCalc {
  const { cumplida } = progresoMeta(meta, saldos)
  if (cumplida) return 'cumplida'

  const fecha = meta.fecha_objetivo?.trim() ? meta.fecha_objetivo.slice(0, 10) : ''
  if (!fecha) return 'sin_fecha'

  const hoyStr = aISO(soloFecha(hoy))
  const diasRestantes = diffDias(hoyStr, fecha)
  if (diasRestantes < 0) return 'atrasada'
  if (diasRestantes < DIAS_MINIMOS_RAZONABLES) return 'atrasada'
  return 'en_camino'
}

// ---------------------------------------------------------------------------
// Préstamos (dinero que me deben)
// ---------------------------------------------------------------------------

export type EstadoPrestamoCalc = 'pagado' | 'vencido' | 'parcial' | 'pendiente'

/** Monto que aún falta por cobrar de un préstamo. */
export function montoPendiente(prestamo: PrestamoRow): number {
  const monto = Number(prestamo.monto) || 0
  const pagado = Number(prestamo.monto_pagado) || 0
  return Math.max(0, monto - pagado)
}

/**
 * Estado calculado de un préstamo:
 * - "pagado": monto_pagado >= monto.
 * - "vencido": la fecha esperada ya pasó y no está pagado.
 * - "parcial": se ha pagado algo (0 < monto_pagado < monto).
 * - "pendiente": el resto de los casos.
 */
export function estadoPrestamo(
  prestamo: PrestamoRow,
  hoy: Date,
): EstadoPrestamoCalc {
  const monto = Number(prestamo.monto) || 0
  const pagado = Number(prestamo.monto_pagado) || 0
  if (pagado >= monto && monto > 0) return 'pagado'

  const fecha = prestamo.fecha_esperada?.trim()
    ? prestamo.fecha_esperada.slice(0, 10)
    : ''
  if (fecha) {
    const hoyStr = aISO(soloFecha(hoy))
    if (fecha < hoyStr) return 'vencido'
  }

  if (pagado > 0 && pagado < monto) return 'parcial'
  return 'pendiente'
}

/** Total por cobrar: suma de lo pendiente de los préstamos no pagados. */
export function totalPorCobrar(prestamos: PrestamoRow[]): number {
  return prestamos.reduce((acc, p) => {
    const monto = Number(p.monto) || 0
    const pagado = Number(p.monto_pagado) || 0
    return pagado >= monto && monto > 0 ? acc : acc + montoPendiente(p)
  }, 0)
}
