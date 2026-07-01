# Prompts — Fase 4: Dashboard y estadísticas

Convierte tus movimientos en información: cuánto entra y sale, en qué se te va la plata, cómo evolucionan tus bolsillos y tu patrimonio, y a qué ritmo vas gastando. Todo con gráficos, filtrable por periodo.

Pega los **Prompts 4.1 → 4.3** en orden. Aprovecha `FinanzasContext` (ya tiene bolsillos, cuentas, categorías, movimientos, config) y `formatCOP`. Usaremos la librería **Recharts** para los gráficos.

**Nota para Claude Code:** todo se calcula a partir de la hoja Movimientos ya cargada en el store (sin lecturas extra de red). Las funciones de agregación deben ser puras y estar en `calculos.ts`.

---

## Prompt 4.1 — Motor de agregaciones

```
Instala recharts (npm install recharts) e impleméntalo más adelante en la UI. Primero, crea en calculos.ts las funciones puras de agregación, recibiendo los movimientos y catálogos ya cargados del store (sin leer red). Todas deben ignorar los movimientos tipo transferencia_cuenta y transferencia_bolsillo para los totales de ingreso/egreso (esas no son ingreso ni gasto real), pero sí considerarlas donde aplique.

Funciones:

1. filtrarPorPeriodo(movimientos, desde, hasta): devuelve los movimientos con fecha en el rango [desde, hasta] inclusive.

2. totalesPeriodo(movimientos): { ingresos, egresos, neto } sumando ingresos y egresos (excluye transferencias y ajustes de los totales).

3. gastoPorCategoria(movimientos, categorias): lista [{ categoria, nombre, total, color? }] de egresos agrupados por categoria_id, ordenada de mayor a menor.

4. gastoPorBolsillo(movimientos, bolsillos): egresos agrupados por bolsillo_id, con nombre y color del bolsillo.

5. ingresoVsEgresoPorMes(movimientos, nMeses): serie [{ mes: 'yyyy-mm', etiqueta: 'jul 2026', ingresos, egresos, neto }] para los últimos nMeses (rellenando meses sin datos con 0).

6. seriedPatrimonio(movimientos, saldoInicialTotal): serie temporal [{ fecha, saldo }] del patrimonio líquido acumulado en el tiempo (ordena movimientos por fecha y acumula el efecto neto sobre el saldo total; transferencias entre cuentas no cambian el total).

7. serieSaldoBolsillo(movimientos, bolsillo, saldoInicialBolsillo): serie [{ fecha, saldo }] del saldo de un bolsillo específico en el tiempo.

8. ritmoGastoCiclo(movimientos, config, hoy): para el bolsillo de tipo gasto en el ciclo quincenal actual → { gastado, diasTranscurridos, diasTotales, proyeccionFinCiclo (gastado / diasTranscurridos * diasTotales), ingresadoCiclo }.

Usa formatCOP donde se muestren montos. Escribe un par de aserciones en Node para validar totalesPeriodo y gastoPorCategoria con datos de ejemplo.
```

---

## Prompt 4.2 — Página Estadísticas (KPIs + gráficos principales)

```
Crea la página "Estadísticas" (ruta /estadisticas) y agrégala al menú de navegación después de Gastos fijos, con un ícono de gráfico.

Arriba, un SELECTOR DE PERIODO con opciones: "Este mes", "Mes pasado", "Últimos 3 meses", "Este año", y "Personalizado" (dos date pickers desde/hasta). El periodo elegido alimenta todos los indicadores y gráficos de la página. Por defecto "Este mes".

Sección 1 — TARJETAS KPI (usando totalesPeriodo del periodo elegido):
- Ingresos del periodo (verde).
- Egresos del periodo (rojo).
- Balance neto (ingresos − egresos), verde si positivo, rojo si negativo.
- Tasa de ahorro: neto / ingresos * 100 (si ingresos > 0).

Sección 2 — INGRESOS VS EGRESOS (gráfico de barras con Recharts): usa ingresoVsEgresoPorMes de los últimos 6 meses. Barras de ingresos (verde) y egresos (rojo) por mes, con tooltip formateado en COP.

Sección 3 — GASTO POR CATEGORÍA (gráfico de dona/pie con Recharts) del periodo elegido, con leyenda, porcentajes y montos en COP. Debajo, una mini-tabla ordenada de mayor a menor con categoría, monto y % del total.

Todos los montos con formatCOP. Diseño responsive (los gráficos deben adaptarse a móvil). Maneja el caso "sin datos en el periodo" con un mensaje amable en vez de un gráfico vacío.

Verifica cambiando el periodo: los KPIs y gráficos deben recalcularse.
```

---

## Prompt 4.3 — Evolución (patrimonio y bolsillos) + ritmo de gasto

```
Amplía la página Estadísticas con tres secciones más, usando las funciones del motor.

Sección 4 — EVOLUCIÓN DEL PATRIMONIO (gráfico de línea, Recharts): serieDPatrimonio en el tiempo (todo el historial o el periodo elegido, con un toggle "Periodo" / "Todo"). Muestra cómo ha crecido/bajado tu patrimonio líquido total. Tooltip en COP.

Sección 5 — GASTO POR BOLSILLO (gráfico de barras horizontales) del periodo elegido, cada barra con el color del bolsillo. Y un selector para ver la EVOLUCIÓN del saldo de un bolsillo específico (serieSaldoBolsillo) como línea en el tiempo.

Sección 6 — RITMO DE GASTO (tarjeta destacada) usando ritmoGastoCiclo del ciclo quincenal actual, para el bolsillo Gastos generales:
- "Llevas gastado $X de $Y ingresado este ciclo".
- Barra de progreso (roja si se pasó).
- "Vas a un ritmo de $Z/día; a este paso terminarás el ciclo en $Proyección".
- Un mensaje interpretativo: "Vas bien" / "Vas ajustado" / "Te estás pasando" según si la proyección supera lo ingresado del ciclo.

Verifica los gráficos y el ritmo con datos reales (o de ejemplo).
```

---

## Cómo probar los gráficos (tienes pocos datos aún)

Para ver que todo funciona sin esperar semanas, registra unos movimientos de ejemplo y luego bórralos:
- 1 ingreso repartido (ej. 2.000.000).
- 3–4 egresos en distintas categorías y fechas (ej. Mercado 150.000, Transporte 40.000, Comida fuera 60.000, Servicios 80.000).
- Revisa que KPIs, dona de categorías, barras ingreso/egreso, evolución de patrimonio y ritmo de gasto se vean coherentes.
- Cuando confirmes que funciona, borra esos movimientos de prueba (Movimientos → Borrar) para dejar tus datos reales limpios.

## Checklist de cierre de Fase 4

- [ ] Página Estadísticas en el menú, con selector de periodo funcional.
- [ ] KPIs (ingresos, egresos, neto, tasa de ahorro) correctos para el periodo.
- [ ] Gráfico ingresos vs egresos por mes.
- [ ] Dona de gasto por categoría + mini-tabla con %.
- [ ] Línea de evolución del patrimonio.
- [ ] Gasto por bolsillo + evolución de un bolsillo elegido.
- [ ] Tarjeta de ritmo de gasto del ciclo con proyección e interpretación.
- [ ] Todo responsive y con mensaje amable cuando no hay datos.

Cuando cierres esto, sigue **Metas de ahorro** (Fase 5) o **Proyecciones y alertas** más avanzadas.
```
