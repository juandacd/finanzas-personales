/**
 * Utilidades de formato para pesos colombianos (COP).
 */

const formatterSinDecimales = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const formatterConDecimales = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formatea un valor numérico como pesos colombianos.
 *
 * Usa el formato colombiano: separador de miles con punto y símbolo `$`.
 * Por defecto no muestra decimales.
 *
 * @param valor Monto en COP (puede ser negativo).
 * @param opciones.conDecimales Si es `true`, muestra dos decimales.
 * @returns El monto formateado, p. ej. `formatCOP(1500000)` → `"$ 1.500.000"`.
 */
export function formatCOP(
  valor: number,
  opciones: { conDecimales?: boolean } = {},
): string {
  const numero = Number.isFinite(valor) ? valor : 0
  const formatter = opciones.conDecimales
    ? formatterConDecimales
    : formatterSinDecimales
  return formatter.format(numero)
}

/**
 * Convierte texto libre de un input en un entero en COP.
 * Ignora separadores de miles y cualquier carácter no numérico (permite
 * escribir "280622" o "280.622"). Devuelve 0 si no hay número válido.
 */
export function parseMontoInput(texto: string): number {
  const limpio = texto.replace(/[^\d-]/g, '')
  if (limpio === '' || limpio === '-') return 0
  const n = Number(limpio)
  return Number.isFinite(n) ? n : 0
}

/**
 * Fecha de HOY en formato `yyyy-mm-dd` según la hora LOCAL del usuario.
 * Se evita `toISOString()` porque devuelve la fecha en UTC y en zonas con
 * desfase negativo (p. ej. Colombia, UTC−5) puede adelantar un día.
 */
export function hoyLocal(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
