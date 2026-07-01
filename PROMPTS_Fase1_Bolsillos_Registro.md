# Prompts — Fase 1: Bolsillos + Registro (el núcleo)

Aquí la herramienta empieza a servir de verdad: defines tus saldos de arranque, registras ingresos (con reparto automático por % o completos a un bolsillo) y egresos (eligiendo bolsillo y cuenta), y ves los saldos moverse en vivo.

Pega los **Prompts 1.1 → 1.5** en Claude Code, uno por uno, esperando que termine cada uno. En cada prompt, aprovecha los stubs y contextos ya creados (`sheets.ts`, `calculos.ts`, `AuthContext`, `DataContext`).

**Reglas de negocio que Claude Code debe respetar (válidas para toda la fase):**
- Los saldos NO se guardan como verdad fija: se **calculan** a partir de `saldo_inicial` + los movimientos. La fuente de verdad son los movimientos.
- Regla de oro: **suma de saldos de todas las cuentas = suma de saldos de todos los bolsillos** (todo el dinero pertenece a algún bolsillo y está en alguna cuenta).
- Moneda COP, sin decimales, con `formatCOP`.

---

## Prompt 1.1 — Saldos iniciales y cuadre

```
Implementa una sección "Saldos iniciales" dentro de la página Configuración.

Objetivo: poder fijar el saldo con el que arranca cada CUENTA y cada BOLSILLO (el campo saldo_inicial de las hojas Cuentas y Bolsillos), editándolo desde la app con updateRow.

Requisitos:
- Muestra una lista editable de cuentas (Bancolombia, Efectivo) con un input de monto para su saldo_inicial.
- Muestra una lista editable de bolsillos con un input de monto para su saldo_inicial.
- Un botón "Guardar saldos iniciales" que persista los cambios en la hoja.
- Un INDICADOR DE CUADRE visible: suma de saldos_iniciales de cuentas vs. suma de saldos_iniciales de bolsillos. Si son iguales muestra "✓ Cuadrado"; si no, muestra en rojo la diferencia y una advertencia ("El total de cuentas debe ser igual al total de bolsillos").
- Formatea todos los montos con formatCOP y acepta entrada numérica cómoda (permitir escribir 280622).

Con esto voy a fijar: Bancolombia = 280622, Efectivo = 0, bolsillo "Gastos generales" = 280622, y los demás bolsillos en 0. Verifica que tras guardar, el indicador diga "✓ Cuadrado".
```

> Tras aplicar este prompt, entra a Configuración y fija esos valores (Bancolombia 280622 y Gastos generales 280622). Confirma que quede "✓ Cuadrado".

---

## Prompt 1.2 — Cálculo de saldos (motor)

```
Implementa en src/lib/calculos.ts el motor de saldos, leyendo las hojas con getRows.

Añade primero una columna nueva "grupo_id" a la hoja Movimientos (al final de las columnas) y actualiza el tipo MovimientoRow y la definición HOJAS en sheets.ts para incluirla. grupo_id sirve para agrupar los movimientos que nacen de un mismo ingreso repartido.

Reglas de cálculo de un MOVIMIENTO sobre saldos:
- tipo "ingreso": SUMA monto al bolsillo (bolsillo_id) y SUMA monto a la cuenta (cuenta_id).
- tipo "egreso": RESTA monto del bolsillo (bolsillo_id) y RESTA monto de la cuenta (cuenta_id).
- tipo "transferencia_cuenta": RESTA de cuenta_id y SUMA a cuenta_destino_id. NO toca bolsillos.
- tipo "transferencia_bolsillo": RESTA de bolsillo_id y SUMA a bolsillo_destino_id. NO toca cuentas.
- tipo "ajuste": puede sumar o restar según el signo del monto; afecta el bolsillo y/o la cuenta indicados.

Funciones a exponer (todas devuelven números ya calculados):
- saldoPorBolsillo(): mapa bolsillo_id -> saldo (saldo_inicial + efecto de movimientos).
- saldoPorCuenta(): mapa cuenta_id -> saldo.
- saldoTotal(): total del patrimonio líquido.
- verificarCuadre(): devuelve {totalCuentas, totalBolsillos, cuadrado: boolean, diferencia}.

Verifica con los datos actuales: bolsillo Gastos generales = 280622, los demás en 0; Bancolombia = 280622, Efectivo = 0; total = 280622; verificarCuadre().cuadrado === true.
```

---

## Prompt 1.3 — Registrar INGRESO (con toggle de reparto)

```
Crea el formulario de registrar INGRESO (accesible desde la página Movimientos con un botón "+ Ingreso", y también desde un botón rápido en Inicio).

Campos:
- Monto (COP).
- Cuenta destino (dónde entra la plata): selección Bancolombia / Efectivo.
- Fecha (por defecto hoy).
- Categoría de ingreso (opcional): de la hoja Categorias tipo ingreso.
- Descripción / nota (opcional).

TOGGLE de destino en bolsillos (esto es clave), dos modos:
1) "Repartir automático por %": divide el monto entre los bolsillos activos según su porcentaje (Diezmo 10, Inversión 10, Ofrenda 5, Ahorro 5, Gastos generales 70). 
   - Muestra en pantalla, antes de confirmar, la PREVISUALIZACIÓN de cuánto le toca a cada bolsillo.
   - Permite ajustar manualmente los montos por bolsillo antes de confirmar (para ingresos especiales), respetando que la suma sea igual al monto total.
   - Maneja el redondeo: si por porcentajes la suma no da exacta, asigna la diferencia al bolsillo Gastos generales para que la suma cuadre exactamente con el monto.
2) "Entra completo a un bolsillo": selecciono UN bolsillo y todo el monto va ahí.

Al confirmar:
- En modo reparto: crea UN movimiento tipo "ingreso" por cada bolsillo con su porción, todos con la misma cuenta_id, la misma fecha, y un mismo grupo_id (generado con generarId) para agruparlos.
- En modo completo: crea un solo movimiento tipo "ingreso" al bolsillo elegido.
- Usa appendRow. Tras guardar, refresca los saldos.

Verifica registrando un ingreso de prueba de 2000000 en modo reparto: debe crear 5 movimientos (200000/200000/100000/100000/1400000) y los saldos de los bolsillos deben subir en consecuencia, con el cuadre intacto.
```

---

## Prompt 1.4 — Registrar EGRESO (eligiendo bolsillo y cuenta)

```
Crea el formulario de registrar EGRESO (gasto), accesible desde Movimientos con un botón "+ Gasto" y desde un botón rápido en Inicio.

Campos:
- Monto (COP).
- Bolsillo de origen (de qué bolsillo sale): selección entre los bolsillos activos, mostrando al lado el saldo disponible de cada uno.
- Cuenta de origen (de dónde sale físicamente la plata): Bancolombia / Efectivo.
- Categoría de egreso (de la hoja Categorias tipo egreso).
- Fecha (por defecto hoy).
- Descripción / nota (opcional).

Validación: si el monto supera el saldo del bolsillo elegido, muestra una ADVERTENCIA clara ("Te pasas del saldo de este bolsillo por $X") pero permite continuar si el usuario confirma (a veces se usa plata de otro lado).

Al confirmar: crea un movimiento tipo "egreso" con bolsillo_id, cuenta_id, categoria_id, monto, fecha, descripcion, origen "manual". Usa appendRow y refresca saldos.

Verifica registrando un gasto de 50000 desde Gastos generales / Bancolombia: el saldo de Gastos y de Bancolombia deben bajar 50000 cada uno, y el cuadre seguir intacto.
```

---

## Prompt 1.5 — Pantallas en vivo: Bolsillos, Cuentas, Inicio y lista de Movimientos

```
Actualiza las pantallas para mostrar todo en vivo usando el motor de calculos.ts. Cachea la lectura y refresca tras cada registro.

1) Página BOLSILLOS: tarjeta por bolsillo con su color, nombre, porcentaje y SALDO ACTUAL (formatCOP). 
   - Para el bolsillo "Gastos generales" (tipo gasto) muestra además un VELOCÍMETRO simple del periodo: cuánto se ha gastado en el ciclo actual (usa Config: ciclo=quincenal, fecha_inicio_ciclo) y una barra de progreso. Por ahora, si falta lógica de ciclo, calcula el ciclo como la quincena calendario en curso (1–15 y 16–fin de mes) y muéstralo; lo afinamos después.
   - Muestra arriba el SALDO TOTAL y el indicador de cuadre (✓ Cuadrado / diferencia).

2) Página CUENTAS: tarjeta por cuenta (Bancolombia, Efectivo) con su saldo actual. Botón "Transferir / Retiro" que crea un movimiento tipo "transferencia_cuenta" (mueve entre cuentas sin tocar bolsillos).

3) Página INICIO (dashboard mínimo): saldo total, saldo de cada bolsillo en una fila compacta, y dos botones grandes de acceso rápido: "+ Ingreso" y "+ Gasto".

4) Página MOVIMIENTOS: lista de todos los movimientos ordenados por fecha descendente, mostrando fecha, tipo (con color/ícono), descripción, bolsillo, cuenta, categoría y monto (ingresos en verde, egresos en rojo). 
   - Filtro por tipo y por bolsillo.
   - Permite EDITAR y BORRAR un movimiento (updateRow/deleteRow) con confirmación; al borrar un movimiento que tiene grupo_id, pregunta si borrar todo el grupo (todo el ingreso repartido) o solo esa porción.
   - Tras editar/borrar, refresca saldos.

Verifica que al registrar ingresos y egresos, las tres pantallas (Bolsillos, Cuentas, Inicio) reflejan los saldos correctos en vivo y el cuadre se mantiene.
```

---

## Checklist de cierre de Fase 1

- [ ] En Configuración fijé saldos iniciales (Bancolombia 280.622, Gastos generales 280.622) y dice "✓ Cuadrado".
- [ ] Puedo registrar un **ingreso repartido** por % y ver la previsualización + los 5 movimientos creados.
- [ ] Puedo registrar un **ingreso completo** a un bolsillo específico.
- [ ] Puedo registrar un **egreso** eligiendo bolsillo y cuenta, con advertencia si excede el saldo.
- [ ] Bolsillos, Cuentas e Inicio muestran saldos correctos en vivo.
- [ ] El indicador de **cuadre** se mantiene ✓ después de varios movimientos.
- [ ] Puedo editar y borrar movimientos (y borrar un ingreso repartido completo por su grupo).

Cuando esto quede, tienes ya un presupuestador funcional. Avísame y seguimos con la **Fase 2 (Cuentas/conciliación fina)** o saltamos a **Fase 3 (Gastos fijos programados)** según lo que más te sirva.

---

### Nota sobre las dos features que pediste
- **Ingreso:** el toggle "Repartir automático por %" vs. "Entra completo a un bolsillo" está en el Prompt 1.3. ✅
- **Egreso:** la selección de bolsillo de origen (y de cuenta) está en el Prompt 1.4. ✅
