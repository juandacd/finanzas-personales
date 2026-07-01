# Prompts — Fase 3: Gastos fijos programados

Pagos recurrentes (deuda de la U el día 20, servicios, arriendo, etc.) que se agendan, te avisan y **reservan** su monto del bolsillo hasta que los pagas. Introduce el concepto de **disponible real** = saldo − reservas pendientes.

Pega los **Prompts 3.1 → 3.4** en orden. Aprovecha lo ya construido: `sheets.ts`, `calculos.ts`, `FinanzasContext`, la hoja `GastosFijos` (ya existe con sus columnas).

**Concepto clave (Claude Code debe respetarlo):**
- **Reserva:** un gasto fijo activo y no pagado en el periodo reserva su monto en su bolsillo.
- **Disponible real de un bolsillo** = `saldo actual − suma de reservas pendientes de ese bolsillo`.
- Pagar un gasto fijo NO es un tipo nuevo: crea un movimiento `egreso` normal (con `gasto_fijo_id`) y avanza la fecha del próximo pago.

---

## Prompt 3.1 — Motor de próximos pagos y reservas

```
Implementa en calculos.ts el motor de gastos fijos, leyendo la hoja GastosFijos (columnas: id, nombre, monto, frecuencia, dia, bolsillo_id, categoria_id, activo, proximo_pago, ultimo_pago).

Funciones puras (que reciban las filas ya cargadas del store, sin leer red):

1. calcularProximoPago(frecuencia, dia, desde): devuelve la próxima fecha de pago (ISO yyyy-mm-dd) a partir de una fecha base.
   - frecuencia "mensual": el día 'dia' del mes; si ya pasó este mes, el del mes siguiente. Ajusta si el mes no tiene ese día (usa el último día del mes).
   - "quincenal": dos fechas al mes (día 'dia' y 'dia'+15, acotado al fin de mes); devuelve la próxima.
   - "semanal": 'dia' = día de la semana (0-6); la próxima ocurrencia.
   - "anual": el mismo día/mes cada año.

2. estadoGastoFijo(gastoFijo, hoy): devuelve { proximoPago, diasRestantes, estado } donde estado ∈ "vencido" (proximoPago < hoy), "vence_hoy", "proximo" (dentro de 7 días), "futuro".

3. reservasPorBolsillo(gastosFijos, hoy, config): mapa bolsillo_id -> monto reservado. Reserva el monto de cada gasto fijo ACTIVO cuyo proximo_pago esté entre hoy y el fin del MES actual y que no esté marcado como pagado en ese periodo (usa ultimo_pago para saber si ya se pagó el ciclo vigente). Documenta esta regla claramente en un comentario; el horizonte de reserva (fin de mes) debe ser fácil de cambiar.

4. disponibleRealPorBolsillo(saldos, reservas): mapa bolsillo_id -> (saldo − reservado).

No cambies el comportamiento del cuadre (las reservas son una vista, NO movimientos: no alteran saldos reales ni el cuadre).

Añade al FinanzasContext el estado derivado: gastosFijos, reservas, disponibleReal, y una lista ordenada de próximos pagos con su estado.

Verifica con un gasto fijo de ejemplo (mensual, día 20, monto 400000, bolsillo Gastos generales): reservasPorBolsillo debe reservar 400000 en Gastos generales si estamos antes/dentro del mes de pago, y disponibleReal de Gastos = saldo − 400000. El cuadre no debe cambiar.
```

---

## Prompt 3.2 — CRUD de gastos fijos (pantalla de gestión)

```
Crea la página "Gastos fijos" (ruta /fijos) y agrégala al menú de navegación (navItems) con un ícono apropiado, después de Cuentas.

La página muestra la lista de gastos fijos con: nombre, monto (formatCOP), frecuencia + día en texto legible ("Mensual, día 20"), bolsillo (con su color), categoría, estado del próximo pago (badge: Vencido en rojo / Vence hoy / En N días / fecha), y un switch Activo/Inactivo.

Formulario Crear / Editar gasto fijo (usa appendRow / updateRowById en la hoja GastosFijos):
- Nombre.
- Monto (COP).
- Frecuencia: mensual / quincenal / semanal / anual (selector).
- Día: según la frecuencia (día del mes 1-31, o día de la semana). Ayuda contextual.
- Bolsillo de origen (selector con colores).
- Categoría de egreso (selector).
- Activo (por defecto sí).
- Al crear/guardar, calcula y guarda proximo_pago con calcularProximoPago (desde hoy). ultimo_pago vacío al crear.

Permite eliminar un gasto fijo (deleteRowById) con confirmación.

Ordena la lista por proximo_pago ascendente (lo más próximo arriba). Tras cualquier cambio, refresca el store.

Verifica creando el gasto fijo real: "Deuda universidad", mensual, día 20, con el monto y bolsillo que yo indique. Debe aparecer con su badge de días restantes y su próximo pago calculado.
```

---

## Prompt 3.3 — Registrar el pago de un gasto fijo

```
En la página Gastos fijos, cada gasto con pago pendiente (vencido / vence hoy / próximo) debe tener un botón "Registrar pago".

Flujo de "Registrar pago" (modal o pantalla):
- Muestra nombre, monto sugerido (editable, porque a veces el valor real varía), bolsillo de origen (precargado, editable), cuenta de origen (selector Bancolombia/Efectivo), fecha de pago (por defecto hoy), nota opcional.
- Al confirmar:
  1) crea un movimiento tipo "egreso" con bolsillo_id, cuenta_id, categoria_id, monto, fecha, descripcion (por defecto el nombre del gasto fijo), origen "manual", y gasto_fijo_id = id del gasto fijo (para trazabilidad).
  2) actualiza el gasto fijo: ultimo_pago = fecha del pago, y proximo_pago = calcularProximoPago(frecuencia, dia, día siguiente a la fecha de pago).
  3) refresca el store.
- Valida sobregiro igual que en el egreso normal (advertencia + confirmar de todas formas).

Efecto esperado: tras pagar, el bolsillo baja por el egreso real, la reserva de ese gasto desaparece (porque proximo_pago pasó al siguiente ciclo) y el disponible real se recalcula. El cuadre se mantiene.

Verifica pagando la "Deuda universidad": debe crear el egreso, el saldo del bolsillo y de la cuenta bajan por el monto, el próximo pago avanza al mes siguiente, y el disponible real ya no descuenta esa reserva.
```

---

## Prompt 3.4 — Integrar disponible real y alertas en el resto de la app

```
Integra el concepto de disponible real y las alertas de gastos fijos en las pantallas existentes, usando el estado del FinanzasContext.

1) Página BOLSILLOS: en cada tarjeta muestra, además del saldo actual, el "Disponible real" (saldo − reservado) cuando haya reservas, y una línea pequeña "Reservado para pagos fijos: $X" si aplica. Que se note visualmente la diferencia.

2) Formulario de EGRESO (RegistrarEgreso): el selector de bolsillo debe mostrar el DISPONIBLE REAL además del saldo, y la advertencia de sobregiro debe basarse en el disponible real (avisando "estás usando plata reservada para pagos fijos") aunque igual permita continuar.

3) Página INICIO: agrega una tarjeta "Próximos pagos" que liste los gastos fijos pendientes ordenados por fecha, con su badge de estado (vencido / vence hoy / en N días) y monto. Los vencidos y los que vencen hoy deben resaltarse. Cada uno con acceso directo a "Registrar pago".

4) Un indicador global (en Inicio) tipo "Tienes N pagos próximos por $TOTAL en los próximos 7 días" si los hay.

Verifica que al tener la "Deuda universidad" pendiente, Inicio muestra la alerta, Bolsillos muestra el disponible real de Gastos generales descontando la reserva, y el formulario de egreso refleja ese disponible real.
```

---

## Checklist de cierre de Fase 3

- [ ] Puedo crear/editar/borrar gastos fijos y ver su próximo pago calculado.
- [ ] Registré mi "Deuda universidad" (mensual, día 20) con su monto y bolsillo reales.
- [ ] En Bolsillos veo el **disponible real** (saldo − reservado) del bolsillo afectado.
- [ ] En Inicio veo la tarjeta de **próximos pagos** con badges (vencido / vence hoy / en N días).
- [ ] El formulario de **egreso** muestra disponible real y avisa si uso plata reservada.
- [ ] Al **registrar el pago**, se crea el egreso, baja el saldo, avanza el próximo pago al mes siguiente y desaparece la reserva.
- [ ] El **cuadre** se mantiene ✓ en todo momento (las reservas no alteran saldos reales).

Cuando cierres esto, ya tienes presupuesto + reporte + gastos fijos con reserva: el núcleo "asistente financiero" funcionando. Después seguiríamos con **Dashboard/estadísticas** o **Metas**.

---

### Datos que necesito de ti para probar con tu caso real
Para el Prompt 3.2, ten a la mano de tu **deuda de la U**: el **monto** de la cuota y de qué **bolsillo** sale (imagino Gastos generales, pero puede ser un bolsillo propio si prefieres separarla). Si quieres, podemos crear un bolsillo dedicado "Deudas" más adelante.
