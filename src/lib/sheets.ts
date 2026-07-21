/**
 * Capa de datos sobre Google Sheets, usando las APIs de Sheets y Drive
 * directamente desde el navegador con el access token de Google (obtenido por
 * el AuthContext). No hay backend.
 *
 * Responsabilidades:
 * - Bootstrap: encontrar (o crear) el archivo "Mis Finanzas - Datos" en Drive,
 *   con todas las hojas, encabezados y datos iniciales.
 * - Funciones genéricas tipadas: getRows, appendRow, updateRow, deleteRow.
 */

import type {
  HojaNombre,
  RowPorHoja,
  BolsilloRow,
  CuentaRow,
  CategoriaRow,
  ConfigRow,
} from '@/types/sheets'
import { hoyLocal } from './format'

// ---------------------------------------------------------------------------
// Constantes de API
// ---------------------------------------------------------------------------

const NOMBRE_ARCHIVO = 'Mis Finanzas - Datos'
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'
/** Prefijo de la clave en localStorage; el id se guarda POR USUARIO. */
const LS_KEY_PREFIX = 'mf_spreadsheet_id'

/** Clave de localStorage del spreadsheet para un usuario concreto. */
function claveUsuario(userId: string): string {
  return `${LS_KEY_PREFIX}:${userId}`
}

// ---------------------------------------------------------------------------
// Definición de hojas (fuente de verdad para columnas, orden y tipos)
// ---------------------------------------------------------------------------

type ColTipo = 'string' | 'number' | 'boolean'

interface ColumnaDef {
  key: string
  tipo: ColTipo
}

interface HojaDef {
  columnas: ColumnaDef[]
}

const s = (key: string): ColumnaDef => ({ key, tipo: 'string' })
const n = (key: string): ColumnaDef => ({ key, tipo: 'number' })
const b = (key: string): ColumnaDef => ({ key, tipo: 'boolean' })

/** Definición de columnas por hoja (el orden define el orden en la hoja). */
const HOJAS: Record<HojaNombre, HojaDef> = {
  Bolsillos: {
    columnas: [
      s('id'),
      s('nombre'),
      n('porcentaje'),
      s('tipo'),
      s('color'),
      n('saldo_inicial'),
      b('activo'),
    ],
  },
  Cuentas: {
    columnas: [s('id'), s('nombre'), s('tipo'), n('saldo_inicial'), b('activo')],
  },
  Movimientos: {
    columnas: [
      s('id'),
      s('fecha'),
      s('tipo'),
      n('monto'),
      s('bolsillo_id'),
      s('bolsillo_destino_id'),
      s('cuenta_id'),
      s('cuenta_destino_id'),
      s('categoria_id'),
      s('descripcion'),
      s('gasto_fijo_id'),
      s('origen'),
      b('conciliado'),
      s('grupo_id'),
      b('es_quincena'),
    ],
  },
  Categorias: {
    columnas: [s('id'), s('nombre'), s('tipo'), s('bolsillo_default_id')],
  },
  GastosFijos: {
    columnas: [
      s('id'),
      s('nombre'),
      n('monto'),
      s('frecuencia'),
      n('dia'),
      s('bolsillo_id'),
      s('categoria_id'),
      b('activo'),
      s('proximo_pago'),
      s('ultimo_pago'),
    ],
  },
  Metas: {
    columnas: [
      s('id'),
      s('nombre'),
      n('monto_objetivo'),
      s('fecha_objetivo'),
      s('bolsillo_id'),
      s('bolsillo_origen_default_id'),
      s('estado'),
      s('notas'),
    ],
  },
  Prestamos: {
    columnas: [
      s('id'),
      s('persona'),
      n('monto'),
      s('fecha_prestamo'),
      s('fecha_esperada'),
      n('monto_pagado'),
      s('estado'),
      s('tipo_registro'),
      s('movimiento_id'),
      s('notas'),
    ],
  },
  Config: {
    columnas: [s('clave'), s('valor')],
  },
}

/** Orden en que se crean las hojas. */
const ORDEN_HOJAS = Object.keys(HOJAS) as HojaNombre[]

// ---------------------------------------------------------------------------
// Estado del token y del spreadsheet (en memoria)
// ---------------------------------------------------------------------------

let accessToken: string | null = null
let spreadsheetId: string | null = null
/** Mapa nombre de hoja → sheetId numérico (gid), necesario para borrar filas. */
let mapaSheetId: Record<string, number> | null = null

/**
 * Función opcional para refrescar el token de forma silenciosa. La registra el
 * AuthContext; se invoca automáticamente si una llamada devuelve 401.
 */
let refrescarToken: (() => Promise<string | null>) | null = null

/** Establece el access token que usarán las llamadas a las APIs de Google. */
export function setAccessToken(token: string | null): void {
  accessToken = token
}

/** Registra la función de refresco silencioso del token. */
export function registrarRefrescador(
  fn: (() => Promise<string | null>) | null,
): void {
  refrescarToken = fn
}

/** Devuelve el spreadsheetId actual (o `null` si aún no se ha inicializado). */
export function getSpreadsheetId(): string | null {
  return spreadsheetId
}

function requerirSpreadsheetId(): string {
  if (!spreadsheetId) {
    throw new Error(
      'La base de datos aún no está inicializada. Llama a inicializarDatos() primero.',
    )
  }
  return spreadsheetId
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Genera un identificador único (timestamp en base36 + aleatorio). */
export function generarId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

function parseCelda(valor: string, tipo: ColTipo): string | number | boolean {
  if (tipo === 'number') {
    const num = Number(valor)
    return Number.isFinite(num) ? num : 0
  }
  if (tipo === 'boolean') {
    return String(valor).trim().toUpperCase() === 'TRUE'
  }
  return valor ?? ''
}

function formatCelda(valor: unknown, tipo: ColTipo): string {
  if (valor === undefined || valor === null) return ''
  if (tipo === 'boolean') return valor ? 'TRUE' : 'FALSE'
  return String(valor)
}

function objetoDesdeFila(def: HojaDef, fila: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  def.columnas.forEach((col, i) => {
    obj[col.key] = parseCelda(fila[i] ?? '', col.tipo)
  })
  return obj
}

function filaDesdeObjeto(def: HojaDef, obj: Record<string, unknown>): string[] {
  return def.columnas.map((col) => formatCelda(obj[col.key], col.tipo))
}

// ---------------------------------------------------------------------------
// Cliente HTTP con Bearer token y reintento ante 401
// ---------------------------------------------------------------------------

/** Fetch con Bearer token y reintento ante 401, SIN lanzar en !ok. */
async function apiFetchRaw(
  url: string,
  init: RequestInit = {},
  yaReintento = false,
): Promise<Response> {
  if (!accessToken) {
    throw new Error('No hay una sesión de Google activa.')
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  })

  // Token expirado/invalidado: intenta refrescar una vez y reintenta.
  if (res.status === 401 && !yaReintento && refrescarToken) {
    const nuevo = await refrescarToken()
    if (nuevo) {
      accessToken = nuevo
      return apiFetchRaw(url, init, true)
    }
  }

  return res
}

/** Como apiFetchRaw pero lanza un Error claro si la respuesta no es ok. */
async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await apiFetchRaw(url, init)
  if (!res.ok) {
    const detalle = await res.text().catch(() => '')
    if (res.status === 403 && /SCOPE|insufficient/i.test(detalle)) {
      throw new Error(
        'Permisos de Google insuficientes (scope). Cierra sesión y vuelve a ' +
          'entrar para conceder el acceso a Drive.',
      )
    }
    throw new Error(`Google API respondió ${res.status}: ${detalle}`)
  }
  return res
}

async function apiJson<T = unknown>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(url, init)
  return (await res.json()) as T
}

function jsonBody(body: unknown): RequestInit {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

// ---------------------------------------------------------------------------
// Datos iniciales
// ---------------------------------------------------------------------------

function bolsillosIniciales(): BolsilloRow[] {
  const base: Omit<BolsilloRow, 'id'>[] = [
    { nombre: 'Diezmo', porcentaje: 10, tipo: 'acumula', color: '#6366f1', saldo_inicial: 0, activo: true },
    { nombre: 'Inversión', porcentaje: 10, tipo: 'acumula', color: '#10b981', saldo_inicial: 0, activo: true },
    { nombre: 'Ofrenda', porcentaje: 5, tipo: 'acumula', color: '#f59e0b', saldo_inicial: 0, activo: true },
    { nombre: 'Ahorro', porcentaje: 5, tipo: 'acumula', color: '#3b82f6', saldo_inicial: 0, activo: true },
    { nombre: 'Gastos generales', porcentaje: 70, tipo: 'gasto', color: '#ef4444', saldo_inicial: 0, activo: true },
  ]
  return base.map((x) => ({ id: generarId(), ...x }))
}

function cuentasIniciales(): CuentaRow[] {
  const base: Omit<CuentaRow, 'id'>[] = [
    { nombre: 'Bancolombia', tipo: 'banco', saldo_inicial: 0, activo: true },
    { nombre: 'Efectivo', tipo: 'efectivo', saldo_inicial: 0, activo: true },
  ]
  return base.map((x) => ({ id: generarId(), ...x }))
}

function categoriasIniciales(): CategoriaRow[] {
  const egresos = [
    'Mercado',
    'Transporte',
    'Comida fuera',
    'Servicios',
    'Salud',
    'Entretenimiento',
    'Educación',
  ]
  const ingresos = ['Quincena', 'Ingreso extra']
  return [
    ...egresos.map(
      (nombre): CategoriaRow => ({
        id: generarId(),
        nombre,
        tipo: 'egreso',
        bolsillo_default_id: '',
      }),
    ),
    ...ingresos.map(
      (nombre): CategoriaRow => ({
        id: generarId(),
        nombre,
        tipo: 'ingreso',
        bolsillo_default_id: '',
      }),
    ),
  ]
}

function configInicial(): ConfigRow[] {
  const hoy = hoyLocal()
  return [
    { clave: 'moneda', valor: 'COP' },
    { clave: 'ciclo', valor: 'quincenal' },
    { clave: 'fecha_inicio_ciclo', valor: hoy },
    { clave: 'dias_ciclo', valor: '15' },
  ]
}

/** Filas iniciales por hoja (las que no aparecen arrancan solo con encabezados). */
function datosIniciales(): Partial<Record<HojaNombre, Record<string, unknown>[]>> {
  return {
    Bolsillos: bolsillosIniciales(),
    Cuentas: cuentasIniciales(),
    Categorias: categoriasIniciales(),
    Config: configInicial(),
  } as unknown as Partial<Record<HojaNombre, Record<string, unknown>[]>>
}

// ---------------------------------------------------------------------------
// Bootstrap: encontrar o crear el archivo
// ---------------------------------------------------------------------------

/**
 * Verifica un archivo por id con drive.files.get (permitido con drive.file para
 * archivos creados por la app). Devuelve:
 * - 'ok' si existe y no está en la papelera,
 * - 'no_existe' si es 404 o está en la papelera,
 * - lanza un Error claro ante 403 de scope u otros fallos.
 */
async function verificarArchivo(id: string): Promise<'ok' | 'no_existe'> {
  const res = await apiFetchRaw(
    `${DRIVE_FILES}/${encodeURIComponent(id)}?fields=id,trashed`,
  )
  if (res.status === 404) return 'no_existe'
  if (!res.ok) {
    const detalle = await res.text().catch(() => '')
    if (res.status === 403 && /SCOPE|insufficient/i.test(detalle)) {
      throw new Error(
        'Permisos de Google insuficientes (scope). Cierra sesión y vuelve a ' +
          'entrar para conceder el acceso a Drive.',
      )
    }
    throw new Error(`No se pudo verificar la hoja (${res.status}): ${detalle}`)
  }
  const data = (await res.json()) as { trashed?: boolean }
  return data.trashed ? 'no_existe' : 'ok'
}

/** Escribe encabezados y datos iniciales en todas las hojas de una sola vez. */
async function escribirDatosIniciales(id: string): Promise<void> {
  const iniciales = datosIniciales()
  const data = ORDEN_HOJAS.map((hoja) => {
    const def = HOJAS[hoja]
    const encabezados = def.columnas.map((c) => c.key)
    const filas = (iniciales[hoja] ?? []).map((obj) =>
      filaDesdeObjeto(def, obj),
    )
    return { range: `${hoja}!A1`, values: [encabezados, ...filas] }
  })

  await apiFetch(
    `${SHEETS_BASE}/${id}/values:batchUpdate`,
    { method: 'POST', ...jsonBody({ valueInputOption: 'RAW', data }) },
  )
}

async function crearArchivo(): Promise<string> {
  const body = {
    properties: { title: NOMBRE_ARCHIVO },
    sheets: ORDEN_HOJAS.map((nombre) => ({ properties: { title: nombre } })),
  }
  const data = await apiJson<{ spreadsheetId: string }>(SHEETS_BASE, {
    method: 'POST',
    ...jsonBody(body),
  })
  await escribirDatosIniciales(data.spreadsheetId)
  return data.spreadsheetId
}

/**
 * Sincroniza (migración ligera) la fila de encabezados de cada hoja para que
 * coincida exactamente con las columnas definidas en HOJAS. Solo reescribe la
 * fila 1 de las hojas cuyo encabezado difiere; no toca los datos existentes.
 * Es idempotente: si todo está correcto, no realiza ninguna escritura.
 *
 * @returns Los nombres de las hojas cuyo encabezado fue corregido.
 */
export async function sincronizarEncabezados(): Promise<string[]> {
  const id = requerirSpreadsheetId()

  // Lee la fila 1 de todas las hojas de una sola vez.
  const query = ORDEN_HOJAS.map(
    (h) => `ranges=${encodeURIComponent(`${h}!1:1`)}`,
  ).join('&')
  const vg = await apiJson<{ valueRanges?: { values?: string[][] }[] }>(
    `${SHEETS_BASE}/${id}/values:batchGet?${query}`,
  )
  const valueRanges = vg.valueRanges ?? []

  const data: { range: string; values: string[][] }[] = []
  const corregidas: string[] = []

  ORDEN_HOJAS.forEach((hoja, i) => {
    const esperado = HOJAS[hoja].columnas.map((c) => c.key)
    const actual = valueRanges[i]?.values?.[0] ?? []
    const coincide =
      actual.length === esperado.length &&
      esperado.every((clave, j) => actual[j] === clave)
    if (!coincide) {
      data.push({ range: `${hoja}!A1`, values: [esperado] })
      corregidas.push(hoja)
    }
  })

  if (data.length > 0) {
    await apiFetch(`${SHEETS_BASE}/${id}/values:batchUpdate`, {
      method: 'POST',
      ...jsonBody({ valueInputOption: 'RAW', data }),
    })
  }

  return corregidas
}

/** Usuario para el que se resolvió el spreadsheet actual (sub/id de Google). */
let usuarioActualId: string | null = null

function guardarIdLocal(userId: string, id: string): void {
  try {
    localStorage.setItem(claveUsuario(userId), id)
  } catch {
    /* localStorage puede no estar disponible; no es crítico. */
  }
}

/**
 * Bootstrap de la base de datos SIN usar drive.files.list (con scope drive.file
 * no se puede buscar por nombre). El id del spreadsheet se guarda por usuario
 * en localStorage:
 * 1) Si hay id guardado para el usuario, se verifica con drive.files.get; si
 *    existe, se usa.
 * 2) Si no hay id guardado, o el archivo ya no existe (404), se crea uno nuevo
 *    con todas las hojas y datos iniciales, y se guarda su id.
 *
 * @param userId Identificador estable del usuario (sub/id de Google).
 */
export async function inicializarDatos(userId: string): Promise<string> {
  if (spreadsheetId && usuarioActualId === userId) return spreadsheetId

  const cacheado =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(claveUsuario(userId))
      : null

  let id: string | null = null
  if (cacheado && (await verificarArchivo(cacheado)) === 'ok') {
    id = cacheado
  } else {
    // No hay id válido guardado para este usuario/dispositivo: crea uno nuevo.
    id = await crearArchivo()
    guardarIdLocal(userId, id)
  }

  spreadsheetId = id
  usuarioActualId = userId
  mapaSheetId = null

  // Migración ligera: asegura que los encabezados incluyan cualquier columna
  // nueva (p. ej. grupo_id) sin tocar los datos existentes. Idempotente.
  await sincronizarEncabezados()

  return id
}

/**
 * Conecta manualmente una hoja existente (creada por la app) pegando su id.
 * Verifica el acceso con drive.files.get y lo guarda para el usuario actual,
 * evitando crear un archivo duplicado al cambiar de dispositivo.
 */
export async function conectarSpreadsheetId(
  userId: string,
  id: string,
): Promise<void> {
  const limpio = id.trim()
  if (!limpio) throw new Error('Pega un id de hoja válido.')
  const estado = await verificarArchivo(limpio)
  if (estado !== 'ok') {
    throw new Error(
      'No se encontró esa hoja o la app no tiene acceso a ella (debe haber ' +
        'sido creada por esta app).',
    )
  }
  spreadsheetId = limpio
  usuarioActualId = userId
  mapaSheetId = null
  guardarIdLocal(userId, limpio)
  await sincronizarEncabezados()
}

// ---------------------------------------------------------------------------
// Funciones genéricas de acceso a datos
// ---------------------------------------------------------------------------

/**
 * Lee todas las filas de datos de una hoja (excluye la fila de encabezados).
 * Nota: en la hoja, la primera fila de datos es la fila 2 (la 1 es encabezado);
 * por eso el índice `i` del arreglo devuelto corresponde a la fila `i + 2`.
 */
export async function getRows<K extends HojaNombre>(
  hoja: K,
): Promise<RowPorHoja[K][]> {
  const id = requerirSpreadsheetId()
  const url = `${SHEETS_BASE}/${id}/values/${encodeURIComponent(hoja)}`
  const data = await apiJson<{ values?: string[][] }>(url)
  const filas = data.values ?? []
  if (filas.length <= 1) return []
  const def = HOJAS[hoja]
  return filas
    .slice(1)
    .map((f) => objetoDesdeFila(def, f)) as unknown as RowPorHoja[K][]
}

/** Agrega una fila al final de la hoja. */
export async function appendRow<K extends HojaNombre>(
  hoja: K,
  datos: RowPorHoja[K],
): Promise<void> {
  const id = requerirSpreadsheetId()
  const def = HOJAS[hoja]
  const fila = filaDesdeObjeto(def, datos as unknown as Record<string, unknown>)
  const range = encodeURIComponent(`${hoja}!A1`)
  const url =
    `${SHEETS_BASE}/${id}/values/${range}:append` +
    `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
  await apiFetch(url, { method: 'POST', ...jsonBody({ values: [fila] }) })
}

/**
 * Reemplaza el contenido de una fila.
 * @param fila Número de fila en la hoja (1-based; la fila 1 es el encabezado,
 *   los datos empiezan en la fila 2).
 */
export async function updateRow<K extends HojaNombre>(
  hoja: K,
  fila: number,
  datos: RowPorHoja[K],
): Promise<void> {
  const id = requerirSpreadsheetId()
  const def = HOJAS[hoja]
  const valores = filaDesdeObjeto(
    def,
    datos as unknown as Record<string, unknown>,
  )
  const range = encodeURIComponent(`${hoja}!A${fila}`)
  const url = `${SHEETS_BASE}/${id}/values/${range}?valueInputOption=RAW`
  await apiFetch(url, { method: 'PUT', ...jsonBody({ values: [valores] }) })
}

async function obtenerMapaSheetId(): Promise<Record<string, number>> {
  if (mapaSheetId) return mapaSheetId
  const id = requerirSpreadsheetId()
  const data = await apiJson<{
    sheets?: { properties?: { title?: string; sheetId?: number } }[]
  }>(`${SHEETS_BASE}/${id}?fields=${encodeURIComponent('sheets.properties(title,sheetId)')}`)
  const mapa: Record<string, number> = {}
  for (const s of data.sheets ?? []) {
    const title = s.properties?.title
    const sheetId = s.properties?.sheetId
    if (title && typeof sheetId === 'number') mapa[title] = sheetId
  }
  mapaSheetId = mapa
  return mapa
}

/**
 * Elimina una fila de la hoja.
 * @param fila Número de fila en la hoja (1-based; la 1 es el encabezado).
 */
export async function deleteRow<K extends HojaNombre>(
  hoja: K,
  fila: number,
): Promise<void> {
  const id = requerirSpreadsheetId()
  const mapa = await obtenerMapaSheetId()
  const sheetId = mapa[hoja]
  if (sheetId === undefined) {
    throw new Error(`No se encontró la hoja "${hoja}".`)
  }
  const body = {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: fila - 1, // 0-based inclusivo
            endIndex: fila, // exclusivo
          },
        },
      },
    ],
  }
  await apiFetch(`${SHEETS_BASE}/${id}:batchUpdate`, {
    method: 'POST',
    ...jsonBody(body),
  })
}

/**
 * Utilidad: devuelve el número de fila (1-based) cuyo `id` coincide, o `null`.
 * Útil para usar updateRow/deleteRow a partir del id de un registro.
 */
export async function buscarFilaPorId<K extends HojaNombre>(
  hoja: K,
  id: string,
): Promise<number | null> {
  const filas = await getRows(hoja)
  const indice = filas.findIndex(
    (r) => (r as { id?: string }).id === id,
  )
  return indice === -1 ? null : indice + 2 // +2: salta encabezado y pasa a 1-based
}

/** Reemplaza una fila localizándola por su `id`. */
export async function updateRowById<K extends HojaNombre>(
  hoja: K,
  id: string,
  datos: RowPorHoja[K],
): Promise<void> {
  const fila = await buscarFilaPorId(hoja, id)
  if (fila === null) {
    throw new Error(`No se encontró el registro ${id} en "${hoja}".`)
  }
  await updateRow(hoja, fila, datos)
}

/** Elimina una fila localizándola por su `id`. Devuelve `true` si existía. */
export async function deleteRowById<K extends HojaNombre>(
  hoja: K,
  id: string,
): Promise<boolean> {
  const fila = await buscarFilaPorId(hoja, id)
  if (fila === null) return false
  await deleteRow(hoja, fila)
  return true
}

/**
 * Elimina varias filas por sus `id` en una sola operación. Ordena los borrados
 * de mayor a menor índice para que las eliminaciones no desplacen a las
 * siguientes. Devuelve cuántas filas se eliminaron.
 */
export async function deleteRowsByIds<K extends HojaNombre>(
  hoja: K,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0
  const spId = requerirSpreadsheetId()
  const filasHoja = await getRows(hoja)
  const idSet = new Set(ids)
  const filas: number[] = []
  filasHoja.forEach((r, i) => {
    if (idSet.has((r as { id?: string }).id ?? '')) filas.push(i + 2)
  })
  if (filas.length === 0) return 0

  const mapa = await obtenerMapaSheetId()
  const sheetId = mapa[hoja]
  if (sheetId === undefined) {
    throw new Error(`No se encontró la hoja "${hoja}".`)
  }

  const requests = filas
    .sort((a, b) => b - a) // descendente: borrar primero las filas de más abajo
    .map((fila) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: fila - 1,
          endIndex: fila,
        },
      },
    }))

  await apiFetch(`${SHEETS_BASE}/${spId}:batchUpdate`, {
    method: 'POST',
    ...jsonBody({ requests }),
  })
  return filas.length
}

// ---------------------------------------------------------------------------
// Diagnóstico
// ---------------------------------------------------------------------------

/** URL para abrir el spreadsheet en el navegador. */
export function getSpreadsheetUrl(): string | null {
  return spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    : null
}

export interface ResumenHoja {
  nombre: string
  /** Número de columnas (según la fila de encabezados). */
  columnas: number
  /** Número de filas de datos (excluye la fila de encabezados). */
  filas: number
}

export interface ResumenSpreadsheet {
  titulo: string
  spreadsheetId: string
  url: string
  hojas: ResumenHoja[]
}

/**
 * Devuelve el título del spreadsheet y, por cada hoja encontrada, su nombre y
 * cuántas filas de datos tiene. Usa una llamada de metadatos y un `batchGet`.
 */
export async function obtenerResumenHojas(): Promise<ResumenSpreadsheet> {
  const id = requerirSpreadsheetId()

  const meta = await apiJson<{
    properties?: { title?: string }
    sheets?: { properties?: { title?: string } }[]
  }>(
    `${SHEETS_BASE}/${id}?fields=${encodeURIComponent(
      'properties.title,sheets.properties(title)',
    )}`,
  )

  const titulos = (meta.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t))

  let valueRanges: { values?: string[][] }[] = []
  if (titulos.length > 0) {
    const rangesQuery = titulos
      .map((t) => `ranges=${encodeURIComponent(t)}`)
      .join('&')
    const vg = await apiJson<{ valueRanges?: { values?: string[][] }[] }>(
      `${SHEETS_BASE}/${id}/values:batchGet?${rangesQuery}`,
    )
    valueRanges = vg.valueRanges ?? []
  }

  const hojas: ResumenHoja[] = titulos.map((nombre, i) => {
    const values = valueRanges[i]?.values ?? []
    const columnas = values[0]?.length ?? 0
    return { nombre, columnas, filas: Math.max(0, values.length - 1) }
  })

  return {
    titulo: meta.properties?.title ?? '(sin título)',
    spreadsheetId: id,
    url: `https://docs.google.com/spreadsheets/d/${id}/edit`,
    hojas,
  }
}
