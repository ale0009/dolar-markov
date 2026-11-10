// Carga de datos (navegador): API Socrata de datos.gov.co con tiempo límite y respaldo local fechado.
import { construirURL, parsearTRM } from './trm.js';

export const RESPALDO = { ruta: 'datos/ejemplo-2026-11-10.json', fecha: '10 nov 2026' };
export const LIMITE_FILAS = 1000; // ≈ 4 años de TRM: alcanza para la ventana de 730 días + 250 días de prueba
const LIMITE_MS = 12000;

function motivo(err) {
  if (err?.name === 'AbortError') return 'datos.gov.co tardó más de 12 s en responder';
  if (err?.estado) return `datos.gov.co respondió con el código HTTP ${err.estado}`;
  if (err instanceof TypeError) return 'no hay conexión o el navegador bloqueó la petición';
  return err?.message || 'error desconocido';
}

async function pedirJSON(url, senal) {
  const r = await fetch(url, { signal: senal, headers: { Accept: 'application/json' } });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { estado: r.status });
  return r.json();
}

/**
 * Devuelve { serie, origen: 'vivo'|'respaldo', error: string|null, consultado: Date }.
 * `base` es la ruta a la raíz del sitio ('' en /, '../' en /proceso/).
 * Con ?sin-conexion en la URL se fuerza el respaldo (para probar ese estado).
 */
export async function cargarTRM(base = '') {
  const forzar = new URLSearchParams(globalThis.location?.search ?? '').has('sin-conexion');
  let error;
  if (!forzar) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), LIMITE_MS);
    try {
      const serie = parsearTRM(await pedirJSON(construirURL(LIMITE_FILAS), ctl.signal));
      if (serie.length < 30) throw new Error('la API devolvió muy pocas TRM');
      return { serie, origen: 'vivo', error: null, consultado: new Date() };
    } catch (e) {
      error = motivo(e);
    } finally {
      clearTimeout(t);
    }
  } else {
    error = 'modo sin conexión forzado con ?sin-conexion';
  }
  const serie = parsearTRM(await pedirJSON(`${base}${RESPALDO.ruta}`));
  return { serie, origen: 'respaldo', error, consultado: null };
}
