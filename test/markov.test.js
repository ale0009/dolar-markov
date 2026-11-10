import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clasificar, frecuencias, estimarMatriz, potencia, multiplicar, distribucionN, estacionaria, tiemposRegreso,
  tiempoAbsorcion, argmax, estadosDe, resolver,
} from '../js/markov.js';

const cerca = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} no es ${b}`);
const filaSuma1 = (P) => P.forEach((f) => cerca(f.reduce((a, b) => a + b, 0), 1));

// Matriz del ejercicio de clase: ciclo de vida de un producto (alta, estable, baja, descontinuado).
const IPHONE = [
  [0.6, 0.3, 0.1, 0.0],
  [0.2, 0.5, 0.2, 0.1],
  [0.1, 0.3, 0.4, 0.2],
  [0.0, 0.0, 0.0, 1.0],
];

test('clasificar con 3 categorías y umbral ±0,1 %', () => {
  assert.equal(clasificar(-0.5, 0.1, 3), 0);
  assert.equal(clasificar(-0.1, 0.1, 3), 1); // el borde cuenta como estable
  assert.equal(clasificar(0, 0.1, 3), 1);
  assert.equal(clasificar(0.1, 0.1, 3), 1);
  assert.equal(clasificar(0.1001, 0.1, 3), 2);
  assert.throws(() => clasificar(NaN), TypeError);
});

test('clasificar con 5 categorías: «fuerte» pasa del 1 %', () => {
  assert.deepEqual([-1.5, -0.4, 0.05, 0.6, 1.2].map((x) => clasificar(x, 0.1, 5)), [0, 1, 2, 3, 4]);
  assert.equal(clasificar(-1, 0.1, 5), 1);
  assert.equal(estadosDe(5).length, 5);
  assert.throws(() => estadosDe(4), RangeError);
});

test('estimar la matriz cuenta pares consecutivos (n_ij / n_i)', () => {
  const seq = [0, 0, 1, 2, 2, 2, 0, 1];
  const { P, conteos, transiciones, vacias } = estimarMatriz(seq, 3);
  assert.deepEqual(conteos, [[1, 2, 0], [0, 0, 1], [1, 0, 2]]);
  assert.equal(transiciones, 7);
  assert.deepEqual(vacias, []);
  cerca(P[0][1], 2 / 3);
  cerca(P[2][2], 2 / 3);
  filaSuma1(P);
});

test('una fila sin datos se rellena con la frecuencia simple', () => {
  const seq = [0, 2, 0, 2, 2];
  const { P, vacias } = estimarMatriz(seq, 3);
  assert.deepEqual(vacias, [1]);
  assert.deepEqual(P[1], frecuencias(seq, 3));
  filaSuma1(P);
});

test('Chapman-Kolmogorov: P^(m+n) = P^m · P^n', () => {
  const P = [[0.5, 0.1, 0.4], [0.6, 0.05, 0.35], [0.45, 0.1, 0.45]];
  const a = potencia(P, 7);
  const b = multiplicar(potencia(P, 3), potencia(P, 4));
  a.forEach((f, i) => f.forEach((x, j) => cerca(x, b[i][j], 1e-12)));
  assert.deepEqual(potencia(P, 0), [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  filaSuma1(potencia(P, 25));
  assert.throws(() => potencia(P, -1), RangeError);
});

test('P² del ejercicio del producto (cálculo a mano de la clase)', () => {
  const P2 = potencia(IPHONE, 2);
  // fila «alta demanda»: 0,6·0,6 + 0,3·0,2 + 0,1·0,1 = 0,43
  cerca(P2[0][0], 0.43);
  cerca(P2[0][3], 0.3 * 0.1 + 0.1 * 0.2);
  cerca(distribucionN([0, 1, 0, 0], IPHONE, 2)[3], P2[1][3]);
});

test('distribución estacionaria: π P = π y suma 1', () => {
  const P = [[0.9, 0.1], [0.5, 0.5]];
  const pi = estacionaria(P);
  cerca(pi[0], 5 / 6);
  cerca(pi[1], 1 / 6);
  const piP = multiplicar([pi], P)[0];
  piP.forEach((x, i) => cerca(x, pi[i]));
});

test('con un estado absorbente, la estacionaria se concentra en él', () => {
  const pi = estacionaria(IPHONE);
  cerca(pi[3], 1, 1e-9);
  cerca(pi[0], 0, 1e-9);
  // Pⁿ con n grande converge a la misma conclusión
  cerca(potencia(IPHONE, 400)[0][3], 1, 1e-6);
});

test('tiempo medio de regreso m_i = 1 / π_i', () => {
  assert.deepEqual(tiemposRegreso([0.5, 0.25, 0.25]), [2, 4, 4]);
  assert.equal(tiemposRegreso([1, 0])[1], Infinity);
});

test('tiempo esperado hasta la absorción: (I − Q)⁻¹ · 1', () => {
  const { transitorios, pasos } = tiempoAbsorcion(IPHONE);
  assert.deepEqual(transitorios, [0, 1, 2]);
  // Comprobación de la ecuación t = 1 + Q t
  transitorios.forEach((i, a) => {
    const der = 1 + transitorios.reduce((s, j, b) => s + IPHONE[i][j] * pasos[b], 0);
    cerca(pasos[a], der, 1e-9);
  });
  assert.ok(pasos[0] > pasos[2]); // desde alta demanda tarda más en descontinuarse que desde baja
  assert.throws(() => tiempoAbsorcion([[0.5, 0.5], [0.5, 0.5]]));
});

test('resolver detecta matrices singulares', () => {
  assert.equal(resolver([[1, 2], [2, 4]], [1, 2]), null);
  assert.deepEqual(resolver([[2, 0], [0, 4]], [2, 8]), [1, 2]);
});

test('argmax desempata con el segundo vector', () => {
  assert.equal(argmax([0.4, 0.4, 0.2]), 0);
  assert.equal(argmax([0.4, 0.4, 0.2], [0.1, 0.6, 0.3]), 1);
});
