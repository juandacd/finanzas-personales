import type { ComponentType, SVGProps } from 'react'
import {
  IconInicio,
  IconMovimientos,
  IconBolsillos,
  IconCuentas,
  IconGastosFijos,
  IconEstadisticas,
  IconMetas,
  IconConfiguracion,
} from './icons'

export interface NavItem {
  /** Ruta de React Router. */
  to: string
  /** Etiqueta visible en la navegación. */
  label: string
  /** Icono asociado. */
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

/** Ítems de navegación principal de la aplicación. */
export const navItems: NavItem[] = [
  { to: '/', label: 'Inicio', icon: IconInicio },
  { to: '/movimientos', label: 'Movimientos', icon: IconMovimientos },
  { to: '/bolsillos', label: 'Bolsillos', icon: IconBolsillos },
  { to: '/cuentas', label: 'Cuentas', icon: IconCuentas },
  { to: '/fijos', label: 'Gastos fijos', icon: IconGastosFijos },
  { to: '/estadisticas', label: 'Estadísticas', icon: IconEstadisticas },
  { to: '/metas', label: 'Metas', icon: IconMetas },
  { to: '/configuracion', label: 'Configuración', icon: IconConfiguracion },
]
