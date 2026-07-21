# Prompts — Módulo Préstamos (dinero que te deben)

Para llevar registro de a quién le prestaste, cuánto, cuándo te deben pagar y saber quién te debe. Cuando prestas, la plata sale de tu saldo real; queda como "por cobrar" aparte (no se cuenta como disponible). Cuando te pagan, vuelve a tu saldo.

Pega los **Prompts 1 → 3** en orden. Aprovecha `sheets.ts` (`sincronizarEncabezados`, `appendRow`, `updateRowById`, `deleteRowById`), `calculos.ts` y `FinanzasContext`.

**Conceptos clave (Claude Code debe respetarlos):**
- Dos tipos de movimiento nuevos: `prestamo_otorgado` (RESTA cuenta y bolsillo) y `prestamo_devuelto` (SUMA cuenta y bolsillo). Ambos afectan saldos y mantienen el cuadre, pero **se excluyen** de los totales de ingreso/egreso y de las estadísticas de gasto (no son ni ingreso ni gasto).
- El dinero "por cobrar" se rastrea en la hoja `Prestamos`, **aparte** del cuadre cuentas=bolsillos. Nunca se suma al patrimonio líquido ni al disponible.
- Préstamos "iniciales" (los que ya te debían antes de usar la app) NO crean movimiento (no descuentan saldo), solo entran a la lista por cobrar.

---

## Prompt 1 — Modelo de datos y motor

```
Agrega el módulo de Préstamos (dinero que me deben).

1) Hoja "Prestamos": usa sincronizarEncabezados para crearla/actualizarla con estas columnas:
   id | persona | monto | fecha_prestamo | fecha_esperada | monto_pagado | estado | tipo_registro | movimiento_id | notas
   - estado: pendiente | parcial | pagado
   - tipo_registro: en_app (creado con la app, descontó saldo) | inicial (ya me debían antes, no descontó saldo)
   - movimiento_id: id del movimiento de otorgamiento (solo si tipo_registro = en_app)
   Crea/actualiza también el tipo TypeScript PrestamoRow y la definición HOJAS.

2) Nuevos tipos de movimiento en el motor de saldos (calculos.ts):
   - "prestamo_otorgado": RESTA monto del bolsillo (bolsillo_id) y de la cuenta (cuenta_id).
   - "prestamo_devuelto": SUMA monto al bolsillo (bolsillo_id) y a la cuenta (cuenta_id).
   Ambos afectan saldos y el cuadre igual que egreso/ingreso, PERO deben EXCLUIRSE de los totales de ingreso/egreso (totalesPeriodo), de gastoPorCategoria y de gastoPorBolsillo, para que no se cuenten como gasto ni ingreso en Estadísticas.

3) Funciones puras (reciben los préstamos ya cargados del store):
   - montoPendiente(prestamo) = monto - monto_pagado.
   - estadoPrestamo(prestamo, hoy): "pagado" (monto_pagado >= monto) | "vencido" (fecha_esperada pasó y no está pagado) | "parcial" (monto_pagado > 0 y < monto) | "pendiente".
   - totalPorCobrar(prestamos) = suma de montoPendiente de los no pagados.

4) FinanzasContext: expón prestamos (con campos calculados: pendiente, estado) y totalPorCobrar.

Verifica con un préstamo de ejemplo (monto 200000, monto_pagado 50000): pendiente 150000, estado "parcial", y que totalPorCobrar lo sume. El cuadre no cambia por tener préstamos en la lista.
```

---

## Prompt 2 — Página Préstamos (prestar, ver, registrar pago)

```
Crea la página "Préstamos" (ruta /prestamos) y agrégala al menú. Como el menú ya tiene varios ítems, en móvil hazlo compacto o con scroll horizontal para que quepan bien todos.

Arriba: total destacado "Te deben $X" (totalPorCobrar), y cuántos préstamos están pendientes/vencidos.

Registrar préstamo nuevo (formulario "+ Préstamo"):
- Persona (a quién le prestaste), monto, fecha del préstamo (hoy por defecto), fecha esperada de pago (opcional), notas.
- Cuenta de origen (de dónde sale la plata) y bolsillo de origen (de qué bolsillo). Muestra el saldo disponible; valida sobregiro con aviso + continuar.
- Al confirmar: crea un movimiento tipo "prestamo_otorgado" (resta cuenta y bolsillo) y una fila en Prestamos con tipo_registro "en_app", movimiento_id = ese movimiento, monto_pagado 0, estado "pendiente". Refresca.

Lista de préstamos pendientes (tarjeta por préstamo):
- Persona, monto, cuánto va pagado y cuánto falta, fecha esperada.
- Badge de estado: Pendiente / Vencido (rojo) / Parcial (ámbar) / Pagado (verde).
- Botones: "Registrar pago", "Editar", "Eliminar".

Registrar pago (abono total o parcial):
- Monto del abono (por defecto el pendiente), cuenta destino (a dónde entra la plata) y bolsillo destino, fecha.
- Al confirmar: crea un movimiento "prestamo_devuelto" (suma cuenta y bolsillo), aumenta monto_pagado del préstamo y actualiza su estado (pagado si se completó). Refresca.

Editar préstamo: persona, monto, fechas, notas.
Eliminar préstamo: confirmación. Si es tipo_registro "en_app" y tiene movimiento de otorgamiento, pregunta si también revertir ese movimiento (para que la plata "vuelva" a tu saldo) o solo borrar el registro. Nunca descuadres.

Sección "Pagados" (historial) al final.

Verifica: presta $100.000 desde Ahorro/Bancolombia → tu saldo baja $100.000, aparece en la lista con "Te deben". Registra un abono parcial y luego el resto → tu saldo sube y el préstamo pasa a Pagado. El cuadre se mantiene ✓ en todo momento.
```

---

## Prompt 3 — Préstamos iniciales (Configuración) e integración en Inicio

```
Dos cosas:

1) Sección "Préstamos iniciales" en Configuración: para registrar dinero que ya me debían ANTES de empezar a usar la app.
- Formulario: persona, monto, fecha del préstamo, fecha esperada (opcional), notas.
- Al guardar: crea una fila en Prestamos con tipo_registro "inicial", monto_pagado 0, estado "pendiente", y SIN crear ningún movimiento (no descuenta saldo, porque esa plata ya había salido antes de usar la app). 
- Estos préstamos aparecen en la página Préstamos junto con los demás y también suman al "Te deben $X".
- Importante: cuando a un préstamo inicial le registro un pago (en la página Préstamos), SÍ se crea el movimiento "prestamo_devuelto" (la plata entra de verdad a mi cuenta ahora).

2) Integración en Inicio: agrega un indicador/tarjeta "Te deben $X" con los préstamos pendientes (máx. 3, con enlace a la página Préstamos). Resalta los vencidos. 
- Deja MUY claro que ese dinero por cobrar NO está incluido en el patrimonio líquido ni en el disponible (por ejemplo, con una etiqueta "no incluido en tu saldo").
- Opcional: muestra como dato informativo separado "Patrimonio + por cobrar = $Y", sin mezclarlo con el saldo real.

Verifica: agrega un préstamo inicial de $300.000 en Configuración → NO cambia tu saldo real ni el cuadre, pero aparece en "Te deben" en Inicio y en la página Préstamos. Al registrarle un pago, tu saldo sí sube.
```

---

## Checklist de cierre del módulo Préstamos

- [ ] Puedo registrar un préstamo nuevo: baja mi saldo (cuenta + bolsillo) y aparece en "Te deben".
- [ ] Puedo registrar **préstamos iniciales** en Configuración sin que me descuenten saldo.
- [ ] Puedo registrar **abonos parciales** y el pago total; al pagar, mi saldo sube.
- [ ] La lista muestra estado (pendiente/vencido/parcial/pagado) y el total "Te deben $X".
- [ ] El dinero por cobrar **no** se mezcla con mi patrimonio líquido ni con el disponible.
- [ ] Los préstamos **no** aparecen como gasto ni ingreso en Estadísticas.
- [ ] El **cuadre** se mantiene ✓ en todos los casos.

Cuando lo termines y pruebes, recuerda publicar: `git add -A`, `git commit -m "Módulo de préstamos"`, `git push`.
```
