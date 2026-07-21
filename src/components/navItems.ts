import type { ComponentType, SVGProps } from 'react'
import {
  IconInicio,
  IconMovimientos,
  IconBolsillos,
  IconCuentas,
  IconGastosFijos,
  IconEstadisticas,
  IconMetas,
  IconPrestamos,
  IconConfiguracion,
} from './icons'

export interface NavItem {
  /** Ruta de React Router. */
  to: string
  /** Etiqueta visible en la navegación (escritorio). */
  label: string
  /** Etiqueta corta para la barra inferior en móvil. */
  corto: string
  /** Icono asociado. */
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

/** Ítems de navegación principal de la aplicación. */
export const navItems: NavItem[] = [
  { to: '/', label: 'Inicio', corto: 'Inicio', icon: IconInicio },
  { to: '/movimientos', label: 'Movimientos', corto: 'Movs', icon: IconMovimientos },
  { to: '/bolsillos', label: 'Bolsillos', corto: 'Bolsillos', icon: IconBolsillos },
  { to: '/cuentas', label: 'Cuentas', corto: 'Cuentas', icon: IconCuentas },
  { to: '/fijos', label: 'Gastos fijos', corto: 'Fijos', icon: IconGastosFijos },
  { to: '/estadisticas', label: 'Estadísticas', corto: 'Stats', icon: IconEstadisticas },
  { to: '/metas', label: 'Metas', corto: 'Metas', icon: IconMetas },
  { to: '/prestamos', label: 'Préstamos', corto: 'Prést.', icon: IconPrestamos },
  { to: '/configuracion', label: 'Configuración', corto: 'Ajustes', icon: IconConfiguracion },
]
