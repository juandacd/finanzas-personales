# Prompts — Fase 0: Cimientos

Esta fase deja la base lista: proyecto React funcionando, entras con tu cuenta de Google, y la app crea/lee/escribe en un Google Sheets en tu Drive.

**Orden:** primero haces el **Paso A** (manual, en Google Cloud, ~10 min) y luego pegas los **Prompts 0.1 → 0.4** en Claude Code, uno por uno, esperando que termine cada uno antes del siguiente.

---

## Paso A — Configuración manual en Google Cloud (lo haces tú una vez)

Necesitamos un "Client ID" de Google para que la app pueda pedirte login y acceder a tus Sheets. Sigue estos pasos:

1. Entra a https://console.cloud.google.com y crea un proyecto nuevo llamado **"Mis Finanzas"**.
2. En el buscador, ve a **APIs y servicios → Biblioteca**. Busca y **habilita** estas dos APIs:
   - **Google Sheets API**
   - **Google Drive API**
3. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Externo** → Crear.
   - Nombre de la app: **Mis Finanzas**. Correo de soporte: tu correo. Datos de contacto: tu correo. Guarda.
   - En **Usuarios de prueba**, agrega tu propio correo de Google. (Así no necesitas verificación de Google para uso personal.)
4. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - Nombre: **Mis Finanzas Web**.
   - **Orígenes autorizados de JavaScript**: agrega `http://localhost:5173` (y luego, cuando despliegues, tu URL de Vercel/Netlify).
   - Crear. **Copia el "ID de cliente"** (algo como `xxxxx.apps.googleusercontent.com`).

Guarda ese **Client ID**: lo vas a pegar en el Prompt 0.2.

> No necesitas "Client Secret" ni API Key para este enfoque (todo es OAuth desde el navegador con Google Identity Services).

---

## Prompt 0.1 — Crear el proyecto base

```
Crea un proyecto web nuevo para una app personal de finanzas llamada "Mis Finanzas".

Requisitos técnicos:
- React 18 + Vite + TypeScript.
- Tailwind CSS configurado y funcionando.
- React Router para navegación.
- Diseño responsive (debe verse bien en computador y en el navegador del celular).
- Idioma de la interfaz: español. Moneda: peso colombiano (COP), con formato colombiano (separador de miles con punto, sin decimales por defecto). Crea una función utilitaria formatCOP(valor).

Estructura de carpetas:
- src/components (componentes reutilizables)
- src/pages (pantallas)
- src/lib (lógica: google auth, sheets, cálculos)
- src/types (tipos TypeScript del modelo de datos)

Crea un layout base con una barra de navegación lateral (en desktop) / inferior (en móvil) con estos ítems aunque por ahora estén vacíos: Inicio, Movimientos, Bolsillos, Cuentas, Metas, Configuración.

Crea una página de Inicio simple que diga "Mis Finanzas" y un texto de bienvenida.

Configura el proyecto para correr en localhost:5173. Verifica que arranca sin errores con npm run dev.
```

---

## Prompt 0.2 — Login con Google

```
Agrega autenticación con Google usando Google Identity Services (GIS) en el navegador, sin backend.

- Usa mi Client ID de OAuth: PEGA_AQUI_TU_CLIENT_ID
- Solicita estos scopes: 
  https://www.googleapis.com/auth/spreadsheets
  https://www.googleapis.com/auth/drive.file
- Implementa un botón "Entrar con Google". Al autenticarse, guarda el access token en memoria (y refréscalo cuando expire).
- Crea un contexto de Auth (AuthContext) que exponga: usuario, token, login(), logout(), y si está autenticado.
- Si no estoy autenticado, muestra solo la pantalla de login. Si lo estoy, muestra la app y mi nombre/correo en la barra.
- Maneja el caso de token expirado pidiendo re-login de forma silenciosa cuando sea posible.

Verifica que puedo entrar con mi cuenta de Google y que el token queda disponible para llamar a las APIs de Google.
```

> Recuerda reemplazar `PEGA_AQUI_TU_CLIENT_ID` por el Client ID del Paso A.

---

## Prompt 0.3 — Conexión a Google Sheets + crear el archivo de datos

```
Implementa la capa de datos sobre Google Sheets, usando el access token de Google ya disponible (APIs de Sheets y Drive desde el navegador).

Comportamiento de arranque (bootstrap):
1. Al entrar, busca en mi Drive un archivo de Google Sheets llamado "Mis Finanzas - Datos".
2. Si no existe, créalo automáticamente con las hojas (pestañas) y encabezados que defino abajo, e inserta los datos iniciales indicados.
3. Guarda el spreadsheetId para usarlo en toda la app.

Crea en src/lib un módulo "sheets.ts" con funciones genéricas: getRows(hoja), appendRow(hoja, datos), updateRow(hoja, fila, datos), deleteRow(hoja, fila). Todas tipadas.

HOJAS Y ENCABEZADOS:

Hoja "Bolsillos": id | nombre | porcentaje | tipo | color | saldo_inicial | activo
Datos iniciales:
- Diezmo, 10, acumula, #6366f1, 0, TRUE
- Inversión, 10, acumula, #10b981, 0, TRUE
- Ofrenda, 5, acumula, #f59e0b, 0, TRUE
- Ahorro, 5, acumula, #3b82f6, 0, TRUE
- Gastos generales, 70, gasto, #ef4444, 0, TRUE

Hoja "Cuentas": id | nombre | tipo | saldo_inicial | activo
Datos iniciales:
- Bancolombia, banco, 0, TRUE
- Efectivo, efectivo, 0, TRUE

Hoja "Movimientos": id | fecha | tipo | monto | bolsillo_id | bolsillo_destino_id | cuenta_id | cuenta_destino_id | categoria_id | descripcion | gasto_fijo_id | origen | conciliado
(tipo puede ser: ingreso, egreso, transferencia_cuenta, transferencia_bolsillo, ajuste)

Hoja "Categorias": id | nombre | tipo | bolsillo_default_id
Datos iniciales de ejemplo (egreso): Mercado, Transporte, Comida fuera, Servicios, Salud, Entretenimiento, Educación. (ingreso): Quincena, Ingreso extra.

Hoja "GastosFijos": id | nombre | monto | frecuencia | dia | bolsillo_id | categoria_id | activo | proximo_pago | ultimo_pago

Hoja "Metas": id | nombre | monto_objetivo | fecha_objetivo | bolsillo_origen_id | aporte_sugerido | saldo_actual | estado

Hoja "Config": clave | valor
Datos iniciales:
- moneda, COP
- ciclo, quincenal
- fecha_inicio_ciclo, (fecha de hoy)

Genera los id como identificadores únicos (por ejemplo timestamp + aleatorio). 
Crea también en src/types los tipos TypeScript correspondientes a cada hoja.

Verifica que al entrar por primera vez se crea el archivo en mi Drive con todas las hojas y datos iniciales, y que puedo leer las filas de "Bolsillos" y mostrarlas en una pantalla de prueba.
```

---

## Prompt 0.4 — Pantalla de verificación

```
Crea una pantalla temporal "Diagnóstico" (accesible desde Configuración) que confirme que todo funciona:
- Muestra mi correo de Google conectado.
- Muestra el nombre y el ID del Google Sheets detectado/creado, con un enlace para abrirlo.
- Lista las hojas encontradas y cuántas filas tiene cada una.
- Un botón "Probar escritura" que agregue una fila de prueba a "Movimientos" y luego la borre, mostrando OK si funcionó.

Esto me sirve para confirmar que la conexión de lectura y escritura está bien antes de seguir.
```

---

## Checklist de cierre de Fase 0

- [ ] El proyecto corre con `npm run dev` sin errores.
- [ ] Puedo entrar con mi cuenta de Google.
- [ ] Se creó "Mis Finanzas - Datos" en mi Google Drive con las 7 hojas y datos iniciales.
- [ ] La pantalla de Diagnóstico muestra lectura y escritura OK.

Cuando marques todo esto, avísame y pasamos a la **Fase 1 (Bolsillos + Registro)**, que es el corazón del producto.
```
