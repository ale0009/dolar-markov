// TRM (tasa representativa del mercado, pesos por dólar) desde datos.gov.co, conjunto 32sa-8pi3.
// Funciones puras: no tocan el DOM ni la red.

export const API = 'https://www.datos.gov.co/resource/32sa-8pi3.json';
export const DIA_MS = 86400000;

/** URL de la API Socrata: las `limite` TRM más recientes, solo los campos que se usan. */
export function construirURL(limite = 1000) {
  const q = new URLSearchParams({
    $select: 'valor,vigenciadesde',
    $order: 'vigenciadesde DESC',
    $limit: String(limite),
  });
  return `${API}?${q}`;
}

/**
 * Convierte las filas de la API en una serie ordenada del más antiguo al más reciente:
 * [{ fecha: 'AAAA-MM-DD', valor: number }]. Descarta filas sin valor o sin fecha y
 * fechas repetidas (se queda con la primera que aparece).
 */
export function parsearTRM(filas) {
  if (!Array.isArray(filas)) throw new TypeError('La respuesta de la TRM no es una lista');
  const vistas = new Map();
  for (const f of filas) {
    const fecha = typeof f?.vigenciadesde === 'string' ? f.vigenciadesde.slice(0, 10) : '';
    const valor = Number.parseFloat(f?.valor);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(valor) || valor <= 0) continue;
    if (!vistas.has(fecha)) vistas.set(fecha, valor);
  }
  return [...vistas].map(([fecha, valor]) => ({ fecha, valor })).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

/** Milisegundos UTC de una fecha 'AAAA-MM-DD'. */
export function msFecha(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

/** Días de calendario entre dos fechas 'AAAA-MM-DD' (b − a). */
export function diasEntre(a, b) {
  return Math.round((msFecha(b) - msFecha(a)) / DIA_MS);
}

/**
 * Cambios porcentuales entre TRM consecutivas publicadas (un paso = una TRM nueva,
 * normalmente un día hábil; el fin de semana comparte una sola TRM).
 * Devuelve [{ fecha, anterior, valor, pct }], donde fecha es la de la TRM nueva.
 */
export function cambiosPct(serie) {
  const out = [];
  for (let i = 1; i < serie.length; i++) {
    const a = serie[i - 1].valor;
    const b = serie[i].valor;
    out.push({ fecha: serie[i].fecha, anterior: a, valor: b, pct: ((b - a) / a) * 100 });
  }
  return out;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '2026-11-11' → '11 nov 2026'. */
export function fechaCorta(fecha, conAnio = true) {
  const [a, m, d] = fecha.split('-').map(Number);
  return `${d} ${MESES[m - 1]}${conAnio ? ` ${a}` : ''}`;
}

/** 3297.07 → '$3.297,07' (formato colombiano). */
export function fmtPesos(v) {
  const [ent, dec] = v.toFixed(2).split('.');
  return `$${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

/** Porcentaje con coma decimal y espacio fino irrompible: 0.8312 → '0,83 %'; con signo opcional. */
export function fmtPct(v, dec = 2, signo = false) {
  const s = Math.abs(v).toFixed(dec).replace('.', ',');
  const pre = signo ? (v > 0 ? '+' : v < 0 ? '−' : '') : v < 0 ? '−' : '';
  return `${pre}${s}\u202F%`;
}

/** Probabilidad 0..1 → '41 %' (entero) o con decimales. */
export function fmtProb(p, dec = 0) {
  return `${(p * 100).toFixed(dec).replace('.', ',')}\u202F%`;
}
