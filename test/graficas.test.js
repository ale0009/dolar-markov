import { test } from 'node:test';
import assert from 'node:assert/strict';
import { svgDiagrama, grosor, posiciones, histogramaCambios, svgPronostico } from '../js/graficas.js';
import { ESTADOS_3 } from '../js/markov.js';

test('diagrama: una flecha por probabilidad positiva y grosor proporcional', () => {
  const P = [[0.5, 0, 0.5], [0.2, 0.3, 0.5], [0.4, 0.1, 0.5]];
  const svg = svgDiagrama(P, ESTADOS_3, { actual: 2 });
  assert.equal((svg.match(/class="d-flecha/g) || []).length, 8); // 9 celdas, una en cero
  assert.match(svg, />HOY</);
  assert.ok(grosor(0.8) > grosor(0.4) && grosor(0.4) > grosor(0.1));
  assert.equal(grosor(0), 0);
  const pos = posiciones(3, 0, 0, 10);
  assert.ok(Math.abs(pos[1].x) < 1e-9 && pos[1].y < 0); // «estable» arriba
});

test('histograma de cambios y pronóstico apilado', () => {
  const { bins, fuera } = histogramaCambios([{ pct: -0.05 }, { pct: 0.05 }, { pct: 0.07 }, { pct: 9 }], 0.1, 1);
  assert.equal(fuera, 1);
  assert.equal(bins.reduce((a, b) => a + b.n, 0), 3);
  const svg = svgPronostico([[0.2, 0.3, 0.5]], [0.3, 0.3, 0.4], ESTADOS_3);
  assert.equal((svg.match(/<rect/g) || []).length, 6);
});
