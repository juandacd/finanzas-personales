import type { SVGProps } from 'react'

/**
 * Iconos de línea (stroke) para la navegación.
 * Se dibujan con `currentColor` para heredar el color del texto.
 */

type IconProps = SVGProps<SVGSVGElement>

const base: IconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconInicio(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  )
}

export function IconMovimientos(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M7 7h13" />
      <path d="m17 4 3 3-3 3" />
      <path d="M17 17H4" />
      <path d="m7 20-3-3 3-3" />
    </svg>
  )
}

export function IconBolsillos(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M3 7h18v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M3 7l2.5-3h13L21 7" />
      <path d="M16 12h.01" />
    </svg>
  )
}

export function IconCuentas(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 9.5h19" />
      <path d="M6.5 14.5h4" />
    </svg>
  )
}

export function IconGastosFijos(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 2.5v4M16 2.5v4" />
      <path d="M12 12.5v3l2 1.5" />
    </svg>
  )
}

export function IconMetas(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  )
}

export function IconPrestamos(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <circle cx="9" cy="13" r="6" />
      <path d="M9 10.5v5M7.8 11.8h1.7a1 1 0 0 1 0 2H7.8" />
      <path d="M16 4h5v5" />
      <path d="M20.5 4.5 14 11" />
    </svg>
  )
}

export function IconEstadisticas(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M3 3v18h18" />
      <rect x="7" y="11" width="3" height="6" rx="0.5" />
      <rect x="12" y="7" width="3" height="10" rx="0.5" />
      <rect x="17" y="13" width="3" height="4" rx="0.5" />
    </svg>
  )
}

export function IconConfiguracion(props: IconProps) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
