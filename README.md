# Mis Finanzas

App personal de finanzas. Registra movimientos, organiza el dinero en bolsillos,
lleva tus cuentas y sigue tus metas de ahorro.

## Tecnología

- **React 18** + **Vite** + **TypeScript**
- **Tailwind CSS**
- **React Router**
- Interfaz en español, moneda en pesos colombianos (COP).

## Comandos

```bash
npm install     # instalar dependencias
npm run dev     # entorno de desarrollo en http://localhost:5173
npm run build   # build de producción
npm run preview # previsualizar el build
```

## Estructura

```
src/
  components/   Componentes reutilizables (Layout, navegación, iconos)
  pages/        Pantallas (Inicio, Movimientos, Bolsillos, Cuentas, Metas, Configuración)
  lib/          Lógica: autenticación con Google, Google Sheets, cálculos, formato
  types/        Tipos TypeScript del modelo de datos
```

La función utilitaria `formatCOP` (en `src/lib/format.ts`) formatea valores en
pesos colombianos con separador de miles con punto y sin decimales por defecto.
