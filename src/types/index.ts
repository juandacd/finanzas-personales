/**
 * Modelo de datos de "Mis Finanzas".
 * Todos los montos se representan en pesos colombianos (COP) como números enteros.
 */

/** Tipo de movimiento financiero. */
export type TipoMovimiento = 'ingreso' | 'gasto' | 'transferencia'

/** Una cuenta real donde vive el dinero (banco, efectivo, etc.). */
export interface Cuenta {
  id: string
  nombre: string
  /** Saldo actual en COP. */
  saldo: number
  /** Tipo de cuenta, p. ej. "ahorros", "corriente", "efectivo", "tarjeta". */
  tipo: string
  /** Fecha de creación en formato ISO 8601. */
  creadaEn: string
}

/**
 * Un "bolsillo": subdivisión virtual del dinero para un propósito
 * (arriendo, mercado, ahorro, etc.). Puede pertenecer a una cuenta.
 */
export interface Bolsillo {
  id: string
  nombre: string
  /** Monto asignado actualmente al bolsillo en COP. */
  saldo: number
  /** Cuenta a la que pertenece el bolsillo, si aplica. */
  cuentaId?: string
  /** Color opcional para la interfaz. */
  color?: string
}

/** Un movimiento de dinero (ingreso, gasto o transferencia). */
export interface Movimiento {
  id: string
  tipo: TipoMovimiento
  /** Monto en COP (siempre positivo). */
  monto: number
  /** Descripción o concepto del movimiento. */
  descripcion: string
  /** Fecha del movimiento en formato ISO 8601. */
  fecha: string
  /** Categoría del movimiento, p. ej. "mercado", "salario". */
  categoria?: string
  /** Cuenta origen (gastos y transferencias). */
  cuentaOrigenId?: string
  /** Cuenta destino (ingresos y transferencias). */
  cuentaDestinoId?: string
  /** Bolsillo asociado, si aplica. */
  bolsilloId?: string
}

/** Una meta de ahorro con un objetivo de monto y fecha. */
export interface Meta {
  id: string
  nombre: string
  /** Monto objetivo a alcanzar en COP. */
  montoObjetivo: number
  /** Monto ahorrado hasta ahora en COP. */
  montoActual: number
  /** Fecha límite para alcanzar la meta (ISO 8601), si aplica. */
  fechaLimite?: string
}

/** Perfil del usuario autenticado (p. ej. vía Google). */
export interface Usuario {
  id: string
  nombre: string
  email: string
  /** URL de la foto de perfil. */
  fotoUrl?: string
}
