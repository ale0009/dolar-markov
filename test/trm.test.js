import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsearTRM, cambiosPct, construirURL, diasEntre, fechaCorta, fmtPesos, fmtPct, fmtProb } from '../js/trm.js';
import { modelar, backtest, enVentana, veredicto } from '../js/modelo.js';

// Muestra real: 400 TRM de datos.gov.co (conjunto 32sa-8pi3), descargadas el 10 nov 2026.
const filas = JSON.parse(readFileSync(new URL('./muestra-trm.json', import.meta.url), 'utf8'));
const serie = parsearTRM(filas);
const cambios = cambiosPct(serie);

test('parsear la muestra real: orden ascendente, sin duplicados, valores numéricos', () => {
  assert.equal(serie.length, 400);
  assert.equal(serie[0].fecha, '2025-03-04');
  assert.deepEqual(serie.at(-1), { fecha: '2026-11-11', valor: 3297.07 });
  for (let i = 1; i < serie.length; i++) assert.ok(serie[i - 1].fecha < serie[i].fecha);
});

test('parsear descarta filas rotas y fechas repetidas', () => {
  const s = parsearTRM([
    { valor: '4000.5', vigenciadesde: '2024-01-03T00:00:00.000' },
    { valor: 'x', vigenciadesde: '2024-01-04T00:00:00.000' },
    { valor: '4100', vigenciadesde: null },
    { valor: '3999', vigenciadesde: '2024-01-03T00:00:00.000' },
    { valor: '4010', vigenciadesde: '2024-01-02T00:00:00.000' },
  ]);
  assert.deepEqual(s, [{ fecha: '2024-01-02', valor: 4010 }, { fecha: '2024-01-03', valor: 4000.5 }]);
  assert.throws(() => parsearTRM({}), TypeError);
});

test('cambio porcentual entre TRM consecutivas (dato real del 11 nov 2026)', () => {
  const u = cambios.at(-1);
  assert.equal(u.fecha, '2026-11-11');
  assert.equal(u.anterior, 3269.88);
  assert.ok(Math.abs(u.pct - 0.83153) < 1e-4);
  assert.equal(cambios.length, serie.length - 1);
});

test('URL de la API, fechas y formatos en español', () => {
  const url = new URL(construirURL(1000));
  assert.equal(url.hostname, 'www.datos.gov.co');
  assert.equal(url.searchParams.get('$order'), 'vigenciadesde DESC');
  assert.equal(url.searchParams.get('$limit'), '1000');
  assert.equal(diasEntre('2026-11-07', '2026-11-10'), 3);
  assert.equal(fechaCorta('2026-11-11'), '11 nov 2026');
  assert.equal(fmtPesos(3297.07), '$3.297,07');
  assert.equal(fmtPct(-0.8315, 2, true), '−0,83\u202F%');
  assert.equal(fmtProb(0.4639), '46\u202F%');
});

test('ventana por días de calendario', () => {
  const v = enVentana(cambios, '2026-11-11', 7);
  assert.ok(v.every((c) => diasEntre(c.fecha, '2026-11-11') < 7));
  assert.equal(v.at(-1).fecha, '2026-11-11');
  assert.ok(v.length >= 4 && v.length <= 7);
});

test('modelar la muestra real: matriz estocástica y pronóstico coherente', () => {
  const m = modelar(cambios, { umbral: 0.1, k: 3, ventana: 365, horizonte: 12 });
  assert.equal(m.actual, 2); // la TRM del 11 nov subió 0,83 %
  m.P.forEach((f) => assert.ok(Math.abs(f.reduce((a, b) => a + b, 0) - 1) < 1e-9));
  assert.deepEqual(m.manana, m.P[m.actual]);
  assert.equal(m.pronostico.length, 12);
  // a 12 pasos ya casi no importa el estado de hoy: se parece a la estacionaria
  m.pronostico[11].forEach((p, j) => assert.ok(Math.abs(p - m.pi[j]) < 0.01));
  assert.ok(m.transiciones > 200 && m.transiciones < 260);
});

test('backtest con datos reales: tres modelos, aciertos entre 0 y 1, sin mirar el futuro', () => {
  const b = backtest(cambios, { umbral: 0.1, k: 3, ventana: 180, pruebas: 120 });
  assert.equal(b.n, 120);
  assert.equal(b.hasta, '2026-11-11');
  for (const m of Object.values(b.modelos)) {
    assert.ok(m.acierto >= 0 && m.acierto <= 1);
    assert.ok(m.brier >= 0 && m.brier <= 2);
  }
  // persistencia da probabilidad 1 a una sola categoría: su Brier es 2 × (1 − acierto)
  const p = b.modelos.persistencia;
  assert.ok(Math.abs(p.brier - 2 * (1 - p.acierto)) < 1e-9);
  // Sin mirar el futuro: quitar el último día no cambia ninguna predicción anterior
  const corto = backtest(cambios.slice(0, -1), { umbral: 0.1, k: 3, ventana: 180, pruebas: 119 });
  assert.equal(corto.n, 119);
  assert.deepEqual(corto.dias, b.dias.slice(0, 119));
  assert.ok(['gana', 'empate', 'pierde'].includes(b.veredicto.resultado));
});

test('backtest sobre una serie inventada donde Markov SÍ debe ganar (alterna sube/baja)', () => {
  const sintetica = Array.from({ length: 300 }, (_, i) => ({
    fecha: new Date(Date.UTC(2024, 0, 1) + i * 86400000).toISOString().slice(0, 10),
    pct: i % 2 ? 0.5 : -0.5,
  }));
  const b = backtest(sintetica, { umbral: 0.1, k: 3, ventana: 90, pruebas: 100 });
  assert.equal(b.modelos.markov.acierto, 1);
  assert.equal(b.modelos.persistencia.acierto, 0);
  assert.equal(b.veredicto.resultado, 'gana');
});

test('veredicto: empate técnico cuando la diferencia es pequeña', () => {
  const pares = Array.from({ length: 100 }, (_, i) => [i % 2, (i + 1) % 2, 0]);
  const modelos = { markov: { acierto: 0.5 }, persistencia: { acierto: 0.5 }, frecuencia: { acierto: 0 } };
  const v = veredicto(modelos, pares);
  assert.equal(v.rival, 'persistencia');
  assert.equal(v.resultado, 'empate');
});

test('racha máxima de aciertos (combo)', async () => {
  const { rachaMaxima } = await import('../js/modelo.js');
  const dias = [1, 1, 0, 1, 1, 1, 0].map((ok) => ({ real: 2, pred: { markov: ok ? 2 : 0 } }));
  assert.equal(rachaMaxima(dias), 3);
  assert.equal(rachaMaxima([]), 0);
});
