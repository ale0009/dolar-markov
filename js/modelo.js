// Modelo y prueba honesta (backtest) sobre la serie de cambios de la TRM. Funciones puras.
import {
  clasificar, estimarMatriz, frecuencias, potencia, estacionaria, tiemposRegreso, unoEn, argmax, estadosDe,
} from './markov.js';
import { diasEntre } from './trm.js';

/** Cambios cuya fecha cae en (fin − ventanaDias, fin], en días de calendario. */
export function enVentana(cambios, fin, ventanaDias) {
  return cambios.filter((c) => c.fecha <= fin && diasEntre(c.fecha, fin) < ventanaDias);
}

/**
 * Estima la cadena con la ventana que termina en el último cambio publicado.
 * Devuelve la matriz, el estado actual, Pⁿ para n = 1..horizonte, la estacionaria y los tiempos de regreso.
 */
export function modelar(cambios, { umbral = 0.1, k = 3, ventana = 365, horizonte = 10 } = {}) {
  if (cambios.length < 3) throw new Error('Hacen falta al menos tres TRM para estimar la cadena');
  const ultimo = cambios[cambios.length - 1];
  const tramo = enVentana(cambios, ultimo.fecha, ventana);
  const seq = tramo.map((c) => clasificar(c.pct, umbral, k));
  const est = estimarMatriz(seq, k);
  const actual = clasificar(ultimo.pct, umbral, k);
  const pronostico = [];
  for (let n = 1; n <= horizonte; n++) pronostico.push(potencia(est.P, n)[actual]);
  const pi = estacionaria(est.P);
  return {
    estados: estadosDe(k), umbral, k, ventana, ultimo, actual, tramo, seq, ...est,
    manana: pronostico[0], pronostico, pi, regreso: tiemposRegreso(pi), frecuencia: frecuencias(seq, k),
  };
}

function brier(p, real) {
  return p.reduce((a, pj, j) => a + (pj - (j === real ? 1 : 0)) ** 2, 0);
}

/**
 * Prueba hacia adelante (walk-forward): para cada uno de los últimos `pruebas` cambios se estima la matriz
 * SOLO con la ventana anterior a ese día y se predice la categoría. Se comparan tres modelos:
 *  - markov: la categoría más probable de la fila del estado de hoy;
 *  - persistencia: «mañana igual que hoy» (repite la categoría de hoy);
 *  - frecuencia: la categoría más frecuente de la ventana, sin mirar el estado de hoy.
 * Acierto = proporción de días con la categoría exacta. Brier = error cuadrático de las probabilidades (menor es mejor).
 */
export function backtest(cambios, { umbral = 0.1, k = 3, ventana = 365, pruebas = 250 } = {}) {
  const sts = cambios.map((c) => clasificar(c.pct, umbral, k));
  const inicio = Math.max(2, cambios.length - pruebas);
  const nombres = ['markov', 'persistencia', 'frecuencia'];
  const acc = Object.fromEntries(nombres.map((m) => [m, { aciertos: 0, brier: 0 }]));
  const pares = []; // por día: [aciertoMarkov, aciertoPersistencia, aciertoFrecuencia]
  const dias = []; // por día: { fecha, real, pred }
  let lo = 0;
  for (let i = inicio; i < cambios.length; i++) {
    const fin = cambios[i - 1].fecha;
    while (lo < i && diasEntre(cambios[lo].fecha, fin) >= ventana) lo++;
    const seq = sts.slice(lo, i);
    if (seq.length < 2) continue;
    const { P } = estimarMatriz(seq, k);
    const f = frecuencias(seq, k);
    const hoy = sts[i - 1];
    const real = sts[i];
    const probs = { markov: P[hoy], persistencia: unoEn(hoy, k), frecuencia: f };
    const pred = { markov: argmax(P[hoy], f), persistencia: hoy, frecuencia: argmax(f) };
    const fila = [];
    for (const m of nombres) {
      const ok = pred[m] === real ? 1 : 0;
      acc[m].aciertos += ok;
      acc[m].brier += brier(probs[m], real);
      fila.push(ok);
    }
    pares.push(fila);
    dias.push({ fecha: cambios[i].fecha, real, pred });
  }
  const n = pares.length;
  const modelos = Object.fromEntries(nombres.map((m) => [m, {
    aciertos: acc[m].aciertos, acierto: n ? acc[m].aciertos / n : 0, brier: n ? acc[m].brier / n : 0,
  }]));
  return {
    n, desde: n ? cambios[cambios.length - n].fecha : null, hasta: n ? cambios[cambios.length - 1].fecha : null,
    modelos, dias, veredicto: veredicto(modelos, pares),
  };
}

/**
 * ¿Gana Markov? Se compara con la mejor línea base usando la diferencia pareada de aciertos día a día:
 * gana si la ventaja supera 2 errores estándar, pierde si queda 2 errores estándar por debajo; si no, empate técnico.
 */
export function veredicto(modelos, pares) {
  const n = pares.length;
  if (!n) return { resultado: 'sin-datos', rival: null, diferencia: 0, error: 0 };
  const rival = modelos.persistencia.acierto >= modelos.frecuencia.acierto ? 'persistencia' : 'frecuencia';
  const col = rival === 'persistencia' ? 1 : 2;
  const d = pares.map((p) => p[0] - p[col]);
  const media = d.reduce((a, b) => a + b, 0) / n;
  const varianza = n > 1 ? d.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1) : 0;
  const error = Math.sqrt(varianza / n);
  let resultado = 'empate';
  if (media > 2 * error && media > 0) resultado = 'gana';
  else if (media < -2 * error && media < 0) resultado = 'pierde';
  return { resultado, rival, diferencia: media, error };
}

/** Racha más larga de aciertos seguidos de un modelo en el backtest (el «combo»). */
export function rachaMaxima(dias, modelo = 'markov') {
  let mejor = 0, actual = 0;
  for (const d of dias) {
    actual = d.pred[modelo] === d.real ? actual + 1 : 0;
    if (actual > mejor) mejor = actual;
  }
  return mejor;
}
