// Gráficas en SVG como texto (sin DOM): diagrama de estados, serie de la TRM, pronóstico a n pasos e histograma.
import { fmtProb, fechaCorta, msFecha, DIA_MS } from './trm.js';

const r1 = (x) => Math.round(x * 10) / 10;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Posiciones de los nodos en un polígono regular, con el estado del medio arriba. */
export function posiciones(k, cx, cy, radio) {
  const mid = (k - 1) / 2;
  return Array.from({ length: k }, (_, i) => {
    const a = (-90 + (i - mid) * (360 / k)) * (Math.PI / 180);
    return { x: cx + radio * Math.cos(a), y: cy + radio * Math.sin(a), a };
  });
}

/** Grosor de una flecha según su probabilidad (proporcional; 0 → no se dibuja). */
export function grosor(p, max = 16) {
  return p <= 0 ? 0 : r1(1 + (max - 1) * p);
}

function punta(x, y, ux, uy, w) {
  // triángulo con la punta en (x, y) y dirección (ux, uy)
  const L = 7 + w * 1.1, A = 4 + w * 0.8;
  const bx = x - ux * L, by = y - uy * L;
  return `${r1(x)},${r1(y)} ${r1(bx - uy * A)},${r1(by + ux * A)} ${r1(bx + uy * A)},${r1(by - ux * A)}`;
}

function etiqueta(x, y, txt, clase = '') {
  const w = 8 + txt.length * 8.4;
  return `<g class="d-eti ${clase}"><rect x="${r1(x - w / 2)}" y="${r1(y - 11)}" width="${r1(w)}" height="22" rx="2"/><text x="${r1(x)}" y="${r1(y + 5)}" text-anchor="middle">${txt}</text></g>`;
}

/**
 * Diagrama de estados. P: matriz k×k; estados: [{nombre, clase}]; actual: índice resaltado (o null).
 * Las flechas que salen del estado actual van en tinta plena; las demás, atenuadas.
 */
export function svgDiagrama(P, estados, { actual = null, titulo = 'Diagrama de estados', W = 460, H = 400, absorbentes = [] } = {}) {
  const k = P.length;
  const cx = W / 2, cy = H / 2 + (k === 3 ? 22 : 12);
  const R = k === 3 ? 128 : k === 4 ? 128 : 138;
  const rn = k === 3 ? 42 : k === 4 ? 36 : 33;
  const pos = posiciones(k, cx, cy, R);
  const minFlecha = k <= 3 ? 0 : 0.03;
  const minEti = k <= 4 ? 0.0001 : 0.12;
  const capas = { atenuadas: [], plenas: [], etiquetas: [] };
  for (let i = 0; i < k; i++) {
    const capa = actual === null || actual === i ? 'plenas' : 'atenuadas';
    for (let j = 0; j < k; j++) {
      const p = P[i][j];
      if (p <= minFlecha) continue;
      const w = grosor(p, k <= 3 ? 16 : 11);
      const clase = `d-flecha ${estados[j].clase}`;
      if (i === j) {
        // lazo hacia afuera del centro
        const a = pos[i].a, sp = 0.42;
        const x0 = pos[i].x + rn * Math.cos(a - sp), y0 = pos[i].y + rn * Math.sin(a - sp);
        const x1 = pos[i].x + rn * Math.cos(a + sp), y1 = pos[i].y + rn * Math.sin(a + sp);
        const ext = rn + 46;
        const c0x = pos[i].x + ext * Math.cos(a - 0.75), c0y = pos[i].y + ext * Math.sin(a - 0.75);
        const c1x = pos[i].x + ext * Math.cos(a + 0.75), c1y = pos[i].y + ext * Math.sin(a + 0.75);
        // tangente final: de c1 a x1
        let ux = x1 - c1x, uy = y1 - c1y; const n = Math.hypot(ux, uy); ux /= n; uy /= n;
        const L = 7 + w * 1.1;
        capas[capa].push(`<g class="${clase}"><path d="M${r1(x0)} ${r1(y0)} C${r1(c0x)} ${r1(c0y)} ${r1(c1x)} ${r1(c1y)} ${r1(x1 - ux * L * 0.8)} ${r1(y1 - uy * L * 0.8)}" stroke-width="${w}"/><polygon points="${punta(x1, y1, ux, uy, w)}"/></g>`);
        if (p >= minEti) {
          const ex = pos[i].x + (rn + 40) * Math.cos(a), ey = pos[i].y + (rn + 40) * Math.sin(a);
          capas.etiquetas.push(etiqueta(ex, ey, fmtProb(p), capa === 'atenuadas' ? 'tenue' : ''));
        }
        continue;
      }
      const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y, d = Math.hypot(dx, dy);
      const ux = dx / d, uy = dy / d;
      const nx = -uy, ny = ux; // normal a la derecha del sentido de viaje
      const curva = d * 0.17;
      const cxp = (pos[i].x + pos[j].x) / 2 + nx * curva, cyp = (pos[i].y + pos[j].y) / 2 + ny * curva;
      const sa = Math.atan2(cyp - pos[i].y, cxp - pos[i].x), ea = Math.atan2(cyp - pos[j].y, cxp - pos[j].x);
      const x0 = pos[i].x + rn * Math.cos(sa), y0 = pos[i].y + rn * Math.sin(sa);
      const x2 = pos[j].x + (rn + 2) * Math.cos(ea), y2 = pos[j].y + (rn + 2) * Math.sin(ea);
      let tx = x2 - cxp, ty = y2 - cyp; const tn = Math.hypot(tx, ty); tx /= tn; ty /= tn;
      const L = 7 + w * 1.1;
      capas[capa].push(`<g class="${clase}"><path d="M${r1(x0)} ${r1(y0)} Q${r1(cxp)} ${r1(cyp)} ${r1(x2 - tx * L * 0.8)} ${r1(y2 - ty * L * 0.8)}" stroke-width="${w}"/><polygon points="${punta(x2, y2, tx, ty, w)}"/></g>`);
      if (p >= minEti) {
        const mx = 0.25 * x0 + 0.5 * cxp + 0.25 * x2, my = 0.25 * y0 + 0.5 * cyp + 0.25 * y2;
        capas.etiquetas.push(etiqueta(mx + nx * 6, my + ny * 6, fmtProb(p), capa === 'atenuadas' ? 'tenue' : ''));
      }
    }
  }
  const nodos = pos.map((q, i) => {
    const e = estados[i];
    const hoy = i === actual;
    const partes = e.nombre.split(' ');
    const txt = partes.length > 1
      ? `<text x="${r1(q.x)}" y="${r1(q.y - 3)}" text-anchor="middle">${esc(partes[0])}</text><text x="${r1(q.x)}" y="${r1(q.y + 13)}" text-anchor="middle">${esc(partes.slice(1).join(' '))}</text>`
      : `<text x="${r1(q.x)}" y="${r1(q.y + 5)}" text-anchor="middle">${esc(e.nombre)}</text>`;
    return `<g class="d-nodo ${e.clase}${hoy ? ' hoy' : ''}${absorbentes.includes(i) ? ' absorbente' : ''}">
      ${hoy ? `<circle class="d-anillo" cx="${r1(q.x)}" cy="${r1(q.y)}" r="${rn + 7}"/>` : ''}
      ${absorbentes.includes(i) ? `<circle class="d-doble" cx="${r1(q.x)}" cy="${r1(q.y)}" r="${rn - 5}"/>` : ''}
      <circle cx="${r1(q.x)}" cy="${r1(q.y)}" r="${rn}"/>${txt}
      ${hoy ? `<g class="d-hoy"><rect x="${r1(q.x - 22)}" y="${r1(q.y + rn - 4)}" width="44" height="18"/><text x="${r1(q.x)}" y="${r1(q.y + rn + 9)}" text-anchor="middle">HOY</text></g>` : ''}
    </g>`;
  }).join('');
  const resumen = estados.map((e, i) => `${e.nombre}: ${P[i].map((p, j) => `${fmtProb(p)} a ${estados[j].nombre}`).join(', ')}`).join('. ');
  return `<svg viewBox="0 0 ${W} ${H}" class="diagrama k${k}" role="img" aria-label="${esc(`${titulo}. ${resumen}.`)}">
    <g class="d-atenuadas">${capas.atenuadas.join('')}</g>
    <g class="d-plenas">${capas.plenas.join('')}</g>
    ${nodos}
    <g>${capas.etiquetas.join('')}</g>
  </svg>`;
}

/** Escala lineal con «ticks» redondos. */
export function ticks(min, max, n = 4) {
  const paso0 = (max - min) / n;
  const mag = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= paso0);
  const out = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Serie de la TRM: línea de los últimos `dias` de calendario, con la ventana de estimación sombreada
 * y el último punto marcado.
 */
export function svgSerie(serie, { dias = 400, ventana = 365, W = 720, H = 230 } = {}) {
  if (!serie.length) return '';
  const fin = serie[serie.length - 1].fecha;
  const t1 = msFecha(fin), t0 = t1 - dias * DIA_MS;
  const pts = serie.filter((p) => msFecha(p.fecha) >= t0);
  const vals = pts.map((p) => p.valor);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || 10; lo -= pad; hi += pad;
  const m = { l: 58, r: 14, t: 14, b: 28 };
  const X = (ms) => m.l + ((ms - t0) / (t1 - t0)) * (W - m.l - m.r);
  const Y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${r1(X(msFecha(p.fecha)))} ${r1(Y(p.valor))}`).join(' ');
  const xv = X(Math.max(t0, t1 - (ventana - 1) * DIA_MS));
  const yt = ticks(lo, hi, 4).map((v) => `<line class="g-reji" x1="${m.l}" x2="${W - m.r}" y1="${r1(Y(v))}" y2="${r1(Y(v))}"/><text class="g-eje" x="${m.l - 6}" y="${r1(Y(v) + 4)}" text-anchor="end">${v.toLocaleString('es-CO')}</text>`).join('');
  const meses = [];
  const f0 = new Date(t0);
  for (let a = f0.getUTCFullYear(), mm = f0.getUTCMonth() + 1; ; mm++) {
    if (mm > 11) { mm = 0; a++; }
    const ms = Date.UTC(a, mm, 1);
    if (ms > t1) break;
    if ((mm % (dias > 200 ? 2 : 1)) === 0) meses.push(`<text class="g-eje" x="${r1(X(ms))}" y="${H - 8}" text-anchor="middle">${MES[mm]}${mm === 0 ? ` ${String(a).slice(2)}` : ''}</text><line class="g-reji" x1="${r1(X(ms))}" x2="${r1(X(ms))}" y1="${H - m.b}" y2="${H - m.b + 4}"/>`);
  }
  const u = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" class="grafica serie" role="img" aria-label="Serie de la TRM de los últimos ${dias} días; último valor ${u.valor.toLocaleString('es-CO')} pesos el ${fechaCorta(u.fecha)}. La zona sombreada es la ventana de ${ventana} días usada para estimar la matriz.">
    <rect class="s-ventana" x="${r1(xv)}" y="${m.t}" width="${r1(W - m.r - xv)}" height="${H - m.t - m.b}"/>
    <text class="s-vent-t" x="${r1(xv + 6)}" y="${m.t + 14}">ventana: ${ventana} días</text>
    ${yt}${meses.join('')}
    <line class="g-base" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>
    <path class="s-linea" d="${d}"/>
    <circle class="s-ultimo" cx="${r1(X(t1))}" cy="${r1(Y(u.valor))}" r="5.5"/>
  </svg>`;
}

/**
 * Pronóstico a n pasos: una barra apilada por cada n (fila del estado de hoy en Pⁿ) y una final con la estacionaria π.
 */
export function svgPronostico(pronostico, pi, estados, { W = 440, fila = 24 } = {}) {
  const filas = [...pronostico.map((p, i) => ({ etiqueta: `n=${i + 1}`, p })), { etiqueta: 'a la larga', p: pi, pi: true }];
  const m = { l: 90, r: 10, t: 6 };
  const H = m.t + filas.length * (fila + 6) + 8;
  const ancho = W - m.l - m.r;
  const cuerpo = filas.map((f, r) => {
    const y = m.t + r * (fila + 6) + (f.pi ? 4 : 0);
    let x = m.l;
    const seg = f.p.map((p, j) => {
      const w = p * ancho;
      const s = `<rect class="${estados[j].clase}" x="${r1(x)}" y="${y}" width="${r1(Math.max(0, w))}" height="${fila}"><title>${esc(`${f.etiqueta}: ${estados[j].nombre} ${fmtProb(p, 1)}`)}</title></rect>${w > 38 ? `<text class="p-v ${estados[j].clase}-t" x="${r1(x + w / 2)}" y="${y + fila / 2 + 4.5}" text-anchor="middle">${fmtProb(p)}</text>` : ''}`;
      x += w;
      return s;
    }).join('');
    return `<text class="g-eje${f.pi ? ' p-pi' : ''}" x="${m.l - 8}" y="${y + fila / 2 + 4}" text-anchor="end">${f.etiqueta}</text>${seg}`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="grafica pronostico" role="img" aria-label="Probabilidades a n pasos desde el estado de hoy, y distribución estacionaria: ${esc(pi.map((p, j) => `${estados[j].nombre} ${fmtProb(p)}`).join(', '))}.">${cuerpo}</svg>`;
}

/** Histograma de cambios diarios (%) con los umbrales marcados. Bins de `paso` puntos porcentuales. */
export function histogramaCambios(cambios, paso = 0.1, limite = 2.5) {
  const nb = Math.round((2 * limite) / paso);
  const bins = Array.from({ length: nb }, (_, i) => ({ desde: -limite + i * paso, n: 0 }));
  let fuera = 0;
  for (const c of cambios) {
    const i = Math.floor((c.pct + limite) / paso + 1e-9);
    if (i < 0 || i >= nb) { fuera++; continue; }
    bins[i].n++;
  }
  return { bins, fuera };
}

export function svgHistograma(cambios, { umbral = 0.1, paso = 0.1, limite = 2.5, W = 640, H = 220 } = {}) {
  const { bins, fuera } = histogramaCambios(cambios, paso, limite);
  const max = Math.max(...bins.map((b) => b.n), 1);
  const m = { l: 36, r: 8, t: 10, b: 28 };
  const bw = (W - m.l - m.r) / bins.length;
  const X = (v) => m.l + ((v + limite) / (2 * limite)) * (W - m.l - m.r);
  const Y = (n) => m.t + (1 - n / max) * (H - m.t - m.b);
  const barras = bins.map((b, i) => {
    const centro = b.desde + paso / 2;
    const clase = centro < -umbral ? 'e-baja' : centro > umbral ? 'e-sube' : 'e-estable';
    return `<rect class="h-barra ${clase}" x="${r1(m.l + i * bw + 0.5)}" y="${r1(Y(b.n))}" width="${r1(bw - 1)}" height="${r1(H - m.b - Y(b.n))}"><title>${b.desde.toFixed(1)} a ${(b.desde + paso).toFixed(1)} %: ${b.n} días</title></rect>`;
  }).join('');
  const ejes = ticks(-limite, limite, 5).map((v) => `<text class="g-eje" x="${r1(X(v))}" y="${H - 8}" text-anchor="middle">${String(v).replace('.', ',').replace('-', '−')} %</text>`).join('');
  const yt = ticks(0, max, 3).map((v) => `<line class="g-reji" x1="${m.l}" x2="${W - m.r}" y1="${r1(Y(v))}" y2="${r1(Y(v))}"/><text class="g-eje" x="${m.l - 5}" y="${r1(Y(v) + 4)}" text-anchor="end">${v}</text>`).join('');
  const lineas = [-umbral, umbral].map((u) => `<line class="h-umbral" x1="${r1(X(u))}" x2="${r1(X(u))}" y1="${m.t}" y2="${H - m.b}"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="grafica" role="img" aria-label="Histograma de ${cambios.length} cambios diarios de la TRM en bloques de ${paso} puntos; líneas en ±${umbral} %. ${fuera} cambios caen fuera de ±${limite} %.">${yt}${barras}${lineas}<line class="g-base" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>${ejes}</svg>`;
}
