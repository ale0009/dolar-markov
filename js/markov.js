// Cadena de Markov de tiempo discreto: clasificar, estimar la matriz, potencias (Chapman-Kolmogorov),
// distribución estacionaria, tiempo de regreso y tiempo hasta absorción. Funciones puras.

/** Estados con 3 categorías (índices 0..2). */
export const ESTADOS_3 = [
  { id: 'baja', nombre: 'Baja', clase: 'e-baja' },
  { id: 'estable', nombre: 'Estable', clase: 'e-estable' },
  { id: 'sube', nombre: 'Sube', clase: 'e-sube' },
];
/** Estados con 5 categorías (índices 0..4). «Fuerte» = más de 1 % en un paso. */
export const ESTADOS_5 = [
  { id: 'baja-fuerte', nombre: 'Baja fuerte', clase: 'e-baja-f' },
  { id: 'baja', nombre: 'Baja', clase: 'e-baja' },
  { id: 'estable', nombre: 'Estable', clase: 'e-estable' },
  { id: 'sube', nombre: 'Sube', clase: 'e-sube' },
  { id: 'sube-fuerte', nombre: 'Sube fuerte', clase: 'e-sube-f' },
];
export const UMBRAL_FUERTE = 1; // % por paso

export function estadosDe(k) {
  if (k === 3) return ESTADOS_3;
  if (k === 5) return ESTADOS_5;
  throw new RangeError('Solo hay 3 o 5 categorías');
}

/**
 * Clasifica un cambio porcentual. Con k = 3: |pct| ≤ umbral → estable (1), menor → baja (0), mayor → sube (2).
 * Con k = 5 además: pct < −1 % → baja fuerte (0) y pct > +1 % → sube fuerte (4).
 * El umbral va en puntos porcentuales (0,1 significa ±0,1 %).
 */
export function clasificar(pct, umbral = 0.1, k = 3) {
  if (!Number.isFinite(pct)) throw new TypeError('Cambio no numérico');
  const fuerte = Math.max(UMBRAL_FUERTE, umbral);
  if (k === 3) return pct < -umbral ? 0 : pct > umbral ? 2 : 1;
  if (k === 5) {
    if (pct < -fuerte) return 0;
    if (pct < -umbral) return 1;
    if (pct <= umbral) return 2;
    if (pct <= fuerte) return 3;
    return 4;
  }
  throw new RangeError('Solo hay 3 o 5 categorías');
}

/** Frecuencia relativa de cada estado en una secuencia (vector de k). */
export function frecuencias(seq, k) {
  const f = new Array(k).fill(0);
  for (const s of seq) f[s]++;
  const n = seq.length;
  return n ? f.map((x) => x / n) : f.map(() => 1 / k);
}

/**
 * Estimación de máxima verosimilitud: P[i][j] = n_ij / n_i, contando los pares consecutivos de la secuencia.
 * Si un estado nunca aparece como origen (n_i = 0), su fila se llena con la frecuencia simple
 * de la secuencia (marcada en `vacias`), para que la matriz siga siendo estocástica.
 */
export function estimarMatriz(seq, k) {
  const conteos = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let t = 1; t < seq.length; t++) conteos[seq[t - 1]][seq[t]]++;
  const base = frecuencias(seq, k);
  const vacias = [];
  const P = conteos.map((fila, i) => {
    const n = fila.reduce((a, b) => a + b, 0);
    if (!n) { vacias.push(i); return [...base]; }
    return fila.map((x) => x / n);
  });
  return { P, conteos, transiciones: Math.max(0, seq.length - 1), vacias };
}

export function identidad(k) {
  return Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 1 : 0)));
}

export function multiplicar(A, B) {
  const n = A.length, m = B[0].length, p = B.length;
  const C = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++) for (let r = 0; r < p; r++) {
    const a = A[i][r];
    if (a) for (let j = 0; j < m; j++) C[i][j] += a * B[r][j];
  }
  return C;
}

/** Pⁿ por cuadrados sucesivos. Chapman-Kolmogorov: P^(m+n) = P^m · P^n. */
export function potencia(P, n) {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('n debe ser un entero ≥ 0');
  let R = identidad(P.length), B = P, e = n;
  while (e > 0) {
    if (e & 1) R = multiplicar(R, B);
    B = multiplicar(B, B);
    e >>= 1;
  }
  return R;
}

/** Distribución después de n pasos: p0 · Pⁿ. */
export function distribucionN(p0, P, n) {
  return multiplicar([p0], potencia(P, n))[0];
}

/** Vector one-hot del estado i. */
export function unoEn(i, k) {
  return Array.from({ length: k }, (_, j) => (j === i ? 1 : 0));
}

/** Resuelve A x = b con eliminación gaussiana y pivoteo parcial. Devuelve null si es singular. */
export function resolver(A, b) {
  const n = A.length;
  const M = A.map((f, i) => [...f, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      if (f) for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((f, i) => f[n] / f[i]);
}

/**
 * Distribución estacionaria π: π P = π y Σ π = 1. Se resuelve el sistema lineal (Pᵀ − I) πᵀ = 0
 * cambiando una ecuación por la de normalización. Si es singular (varias clases cerradas),
 * se aproxima con 2000 iteraciones desde la distribución uniforme.
 */
export function estacionaria(P) {
  const k = P.length;
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => P[j][i] - (i === j ? 1 : 0)));
  A[k - 1] = new Array(k).fill(1);
  const b = new Array(k).fill(0);
  b[k - 1] = 1;
  let pi = resolver(A, b);
  if (!pi || pi.some((x) => !Number.isFinite(x) || x < -1e-9)) {
    pi = distribucionN(new Array(k).fill(1 / k), P, 2000);
  }
  const limpio = pi.map((x) => (Math.abs(x) < 1e-12 ? 0 : x));
  const s = limpio.reduce((a, c) => a + c, 0);
  return limpio.map((x) => x / s);
}

/** Tiempo medio de regreso a cada estado (en pasos): m_i = 1 / π_i (Kac). Infinity si π_i = 0. */
export function tiemposRegreso(pi) {
  return pi.map((p) => (p > 0 ? 1 / p : Infinity));
}

/**
 * Cadena absorbente: pasos esperados hasta caer en un estado absorbente desde cada estado transitorio.
 * t = (I − Q)⁻¹ · 1, con Q la submatriz de transitorios. Devuelve { transitorios, pasos }.
 */
export function tiempoAbsorcion(P) {
  const k = P.length;
  const abs = P.map((f, i) => f[i] === 1);
  const tr = [...Array(k).keys()].filter((i) => !abs[i]);
  if (tr.length === k) throw new Error('La cadena no tiene estados absorbentes');
  const A = tr.map((i) => tr.map((j) => (i === j ? 1 : 0) - P[i][j]));
  const pasos = resolver(A, tr.map(() => 1));
  return { transitorios: tr, pasos };
}

/** Índice del máximo; en empate gana el que tenga más `desempate` (o el de menor índice). */
export function argmax(v, desempate = null) {
  let mejor = 0;
  for (let i = 1; i < v.length; i++) {
    if (v[i] > v[mejor] + 1e-12) mejor = i;
    else if (Math.abs(v[i] - v[mejor]) <= 1e-12 && desempate && desempate[i] > desempate[mejor]) mejor = i;
  }
  return mejor;
}
