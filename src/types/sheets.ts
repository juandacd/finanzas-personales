/**
 * Tipos del modelo de datos tal como se almacenan en Google Sheets.
 * Cada interfaz corresponde a una hoja (pestaña); las claves coinciden con los
 * encabezados de columna. Los valores ya vienen convertidos a su tipo primitivo
 * (number/boolean/string) por la capa de acceso a datos (`src/lib/sheets.ts`).
 */

/** Tipo de bolsillo: `acumula` (ahorra) o `gasto` (se consume). */
export type TipoBolsillo = 'acumula' | 'gasto'

/** Tipo de movimiento financiero. */
export type TipoMovimiento =
  | 'ingreso'
  | 'egreso'
  | 'transferencia_cuenta'
  | 'transferencia_bolsillo'
  | 'ajuste'

/** Tipo de categoría. */
export type TipoCategoria = 'ingreso' | 'egreso'

/** Hoja "Bolsillos". */
export interface BolsilloRow {
  id: string
  nombre: string
  /** Porcentaje del ingreso destinado a este bolsillo (0–100). */
  porcentaje: number
  tipo: TipoBolsillo
  /** Color en formato hex, p. ej. "#6366f1". */
  color: string
  saldo_inicial: number
  activo: boolean
}

/** Hoja "Cuentas". */
export interface CuentaRow {
  id: string
  nombre: string
  /** Tipo de cuenta, p. ej. "banco", "efectivo". */
  tipo: string
  saldo_inicial: number
  activo: boolean
}

/** Hoja "Movimientos". */
export interface MovimientoRow {
  id: string
  /** Fecha en formato ISO 8601. */
  fecha: string
  tipo: TipoMovimiento
  monto: number
  bolsillo_id: string
  bolsillo_destino_id: string
  cuenta_id: string
  cuenta_destino_id: string
  categoria_id: string
  descripcion: string
  gasto_fijo_id: string
  /** Origen del registro, p. ej. "manual", "gasto_fijo". */
  origen: string
  conciliado: boolean
  /** Agrupa los movimientos que nacen de un mismo ingreso repartido. */
  grupo_id: string
}

/** Hoja "Categorias". */
export interface CategoriaRow {
  id: string
  nombre: string
  tipo: TipoCategoria
  /** Bolsillo sugerido por defecto para esta categoría (puede ir vacío). */
  bolsillo_default_id: string
}

/** Hoja "GastosFijos". */
export interface GastoFijoRow {
  id: string
  nombre: string
  monto: number
  /** Frecuencia, p. ej. "mensual", "quincenal". */
  frecuencia: string
  /** Día del mes/ciclo en que se paga. */
  dia: number
  bolsillo_id: string
  categoria_id: string
  activo: boolean
  /** Próximo pago (ISO 8601). */
  proximo_pago: string
  /** Último pago (ISO 8601). */
  ultimo_pago: string
}

/** Hoja "Metas". */
export interface MetaRow {
  id: string
  nombre: string
  monto_objetivo: number
  /** Fecha objetivo (ISO 8601). */
  fecha_objetivo: string
  bolsillo_origen_id: string
  aporte_sugerido: number
  saldo_actual: number
  /** Estado, p. ej. "activa", "cumplida", "pausada". */
  estado: string
}

/** Hoja "Config" (pares clave/valor). */
export interface ConfigRow {
  clave: string
  valor: string
}

/**
 * Mapa de nombre de hoja → tipo de fila. Es la fuente de verdad para tipar las
 * funciones genéricas de acceso a datos.
 */
export interface RowPorHoja {
  Bolsillos: BolsilloRow
  Cuentas: CuentaRow
  Movimientos: MovimientoRow
  Categorias: CategoriaRow
  GastosFijos: GastoFijoRow
  Metas: MetaRow
  Config: ConfigRow
}

/** Nombres válidos de hoja. */
export type HojaNombre = keyof RowPorHoja
