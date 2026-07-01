# Prompts — Fase 5: Metas de ahorro

Cada meta es su **propio bolsillo** (tipo "meta") con nombre, monto objetivo y fecha límite. Se alimenta con lo que ya tienes construido: transferencias entre bolsillos o ingresos directos. La app calcula progreso, cuánto falta, el aporte sugerido por quincena y si vas en camino o atrasado.

Pega los **Prompts 5.1 → 5.3** en orden. Aprovecha `FinanzasContext`, `calculos.ts`, `sheets.ts` (incluye `sincronizarEncabezados`, `appendRow`, `updateRowById`, `deleteRowById`) y los flujos ya hechos de transferencia entre bolsillos e "ingreso completo a un bolsillo".

**Concepto clave (Claude Code debe respetarlo):**
- Una meta = un bolsillo con `tipo: "meta"` y `porcentaje: 0`. Guarda dinero real (mantiene el cuadre).
- Los bolsillos tipo "meta" NO entran en el reparto automático por % de los ingresos, y NO aparecen en la lista principal de Bolsillos (se muestran en la página Metas). Sí siguen disponibles como destino de transferencias e ingresos, y cuentan para el patrimonio y el cuadre.
- Progreso, faltante y aporte sugerido se CALCULAN; no se guardan como verdad fija.

---

## Prompt 5.1 — Modelo y motor de metas

```
Prepara el modelo de datos y el motor para Metas de ahorro.

1) Tipo de bolsillo "meta": actualiza los tipos y la lógica para que un bolsillo pueda tener tipo "meta" (además de "acumula" y "gasto"). 
   - Los bolsillos tipo "meta" NO participan en el reparto automático por porcentaje de los ingresos (exclúyelos de calcularReparto y de la previsualización de reparto).
   - Sí cuentan para saldos, patrimonio y cuadre (guardan dinero real).

2) Hoja Metas: asegúrate (con sincronizarEncabezados) de que tenga estas columnas, agregando las que falten sin borrar datos:
   id | nombre | monto_objetivo | fecha_objetivo | bolsillo_id | bolsillo_origen_default_id | estado | notas
   - bolsillo_id = el id del bolsillo (tipo meta) que representa la bolsa de esta meta.
   - bolsillo_origen_default_id = bolsillo sugerido por defecto para aportar (opcional, ej. Ahorro).
   - estado ∈ activa | cumplida | pausada.

3) En calculos.ts, funciones puras (reciben metas, bolsillos, saldos ya calculados del store):
   - progresoMeta(meta, saldos): { actual: saldo del bolsillo_id, objetivo, porcentaje: actual/objetivo*100 (tope 100 para la barra), faltante: max(0, objetivo-actual), cumplida: actual>=objetivo }.
   - aporteSugerido(meta, saldos, hoy, config): faltante dividido entre el número de quincenas restantes hasta fecha_objetivo (mínimo 1). Devuelve también quincenasRestantes y diasRestantes.
   - estadoMeta(meta, saldos, hoy): "cumplida" | "en_camino" | "atrasada" | "sin_fecha". "atrasada" si al ritmo necesario ya no es alcanzable cómodamente (p. ej. faltan menos días de los razonables) o si fecha_objetivo ya pasó y no está cumplida.

4) Expón en FinanzasContext: metas (con sus campos calculados: progreso, aporteSugerido, estado) y helpers para obtener el bolsillo de una meta.

Verifica con una meta de ejemplo (objetivo 3.000.000, fecha dentro de 6 meses, bolsillo con saldo 500.000): progreso 16,7%, faltante 2.500.000, y un aporteSugerido coherente por quincena. El cuadre no cambia.
```

---

## Prompt 5.2 — Página Metas (crear, ver progreso, editar)

```
Implementa la página Metas (ruta /metas, ya está en el menú) para gestionar metas de ahorro.

Crear meta (formulario):
- Nombre (ej. "Viaje", "Fondo de emergencia").
- Monto objetivo (COP).
- Fecha objetivo (date picker).
- Color (para el bolsillo de la meta).
- Bolsillo de origen por defecto (opcional): selector de bolsillos existentes (ej. Ahorro) para sugerir de dónde aportar.
Al crear:
  1) crea un bolsillo nuevo con tipo "meta", porcentaje 0, el color elegido, saldo_inicial 0, activo TRUE (appendRow en Bolsillos).
  2) crea la fila en Metas con bolsillo_id = ese bolsillo, estado "activa".
  3) refresca el store.

Lista de metas: una tarjeta por meta con:
- Nombre, monto objetivo y fecha límite.
- Barra de progreso con el color de la meta y el porcentaje.
- "Llevas $X de $Y — te falta $Z".
- Aporte sugerido: "Aporta $W por quincena para llegar a tiempo" (con quincenas/días restantes).
- Badge de estado: Cumplida (verde), En camino (azul), Atrasada (ámbar/rojo), Sin fecha.
- Botones: "Aportar" (Prompt 5.3), "Editar", "Eliminar".

Editar meta: nombre, monto objetivo, fecha, color, bolsillo origen por defecto, estado (activa/pausada). Actualiza Metas y, si cambia nombre/color, también el bolsillo asociado.

Eliminar meta: confirmación. Si el bolsillo de la meta tiene saldo > 0, advierte y ofrece mover ese saldo a otro bolsillo (transferencia_bolsillo) antes de eliminar; luego borra la fila de Metas y el bolsillo (o márcalo inactivo). Nunca dejes dinero "huérfano" ni descuadres el cuadre.

Separa las metas cumplidas en una sección "Cumplidas" al final.

Verifica creando la meta real que yo indique (nombre, objetivo, fecha) y comprueba que aparece con su progreso en 0% y su aporte sugerido calculado.
```

---

## Prompt 5.3 — Aportar a una meta + integración

```
Implementa el flujo "Aportar" y la integración de metas en el resto de la app.

Botón "Aportar" en cada meta abre un modal con dos formas de aportar:

A) "Desde un bolsillo" (mover plata que ya tengo): selecciono bolsillo de origen (por defecto el bolsillo_origen_default de la meta; muestra su disponible), y un monto. Al confirmar crea un movimiento tipo "transferencia_bolsillo" desde el bolsillo origen hacia el bolsillo de la meta (no toca cuentas). Valida que no exceda el saldo del origen (con advertencia + continuar).

B) "Ingreso nuevo para la meta" (plata que entra de afuera para esta meta): monto + cuenta destino (Bancolombia/Efectivo) + fecha. Al confirmar crea un movimiento tipo "ingreso" que entra completo al bolsillo de la meta (reutiliza la lógica de "ingreso completo a un bolsillo").

Tras aportar: refresca; si el saldo alcanza o supera el objetivo, marca la meta como "cumplida" y muestra un mensaje de felicitación.

Integración:
- Página Bolsillos: NO listes los bolsillos tipo "meta" en la lista principal (ya se ven en Metas). Opcional: una pequeña sección "Metas" con su progreso resumido, o nada.
- Reparto de ingresos: confirma que los bolsillos tipo "meta" no aparecen en la previsualización del reparto por %.
- Inicio: agrega una tarjeta compacta "Metas" con las metas activas, su barra de progreso y % (máx 3, con enlace a la página Metas).

Verifica: aporta a la meta desde el bolsillo Ahorro (transferencia_bolsillo) y con un ingreso externo; el progreso sube, el cuadre se mantiene, y al llegar al objetivo la meta pasa a "cumplida".
```

---

## Checklist de cierre de Fase 5

- [ ] Puedo crear una meta (crea su bolsillo tipo "meta" automáticamente).
- [ ] La meta muestra progreso, faltante, aporte sugerido por quincena y badge de estado.
- [ ] Puedo **aportar desde un bolsillo** (transferencia) y con un **ingreso externo**.
- [ ] Los bolsillos tipo "meta" **no** salen en el reparto por % ni en la lista principal de Bolsillos.
- [ ] Al alcanzar el objetivo, la meta se marca **cumplida** y felicita.
- [ ] Eliminar una meta con saldo ofrece mover el dinero antes de borrar (sin descuadrar).
- [ ] Inicio muestra un resumen de metas.
- [ ] El **cuadre** se mantiene ✓ en todos los casos.

Con esto tienes el sistema casi completo: presupuesto, registro, gastos fijos, estadísticas y metas. Después quedaría **Importar extracto de Bancolombia** (conciliación) y afinamientos.

---

### Dato que necesito de ti para probar
Ten lista una **meta real**: nombre, monto objetivo y fecha (ej. "Fondo de emergencia", 3.000.000, diciembre 2026). Y de qué bolsillo sueles aportar (¿Ahorro?).
