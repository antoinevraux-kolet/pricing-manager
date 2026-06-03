// ── Basic stats ───────────────────────────────────────────────────────────────

export function mean(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

export function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}

export function stdDev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

// ── Normal distribution ───────────────────────────────────────────────────────

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const r = 1 - p * Math.exp(-x * x);
  return x >= 0 ? r : -r;
}

function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function twoTailedP(t: number): number {
  return 2 * (1 - normalCDF(Math.abs(t)));
}

// ── Matrix operations ─────────────────────────────────────────────────────────

function transpose(A: number[][]): number[][] {
  return A[0].map((_, j) => A.map(row => row[j]));
}

function matMul(A: number[][], B: number[][]): number[][] {
  const [m, p, n] = [A.length, A[0].length, B[0].length];
  const C = Array.from({ length: m }, () => Array(n).fill(0) as number[]);
  for (let i = 0; i < m; i++)
    for (let k = 0; k < p; k++)
      if (A[i][k] !== 0)
        for (let j = 0; j < n; j++)
          C[i][j] += A[i][k] * B[k][j];
  return C;
}

// Solve Ax = b via Gauss-Jordan elimination with partial pivoting. Returns null if singular.
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-14) return null;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// ── OLS ───────────────────────────────────────────────────────────────────────

export interface OLSResult {
  beta: number[];
  stdErrors: number[];
  tStats: number[];
  pValues: number[];
  rSquared: number;
  adjRSquared: number;
  rss: number;
  residuals: number[];
  fitted: number[];
  durbinWatson: number;
  n: number;
  k: number;
}

// X: n×k design matrix (first column = 1 for intercept), y: length n
export function ols(X: number[][], y: number[]): OLSResult | null {
  const n = X.length;
  const k = X[0].length;
  if (n <= k + 1) return null;

  const Xt  = transpose(X);
  const XtX = matMul(Xt, X);
  const Xty = matMul(Xt, y.map(v => [v])).map(r => r[0]);

  const beta = solveLinear(XtX, Xty);
  if (!beta) return null;

  const fitted    = X.map(row => row.reduce((s, x, j) => s + x * beta[j], 0));
  const residuals = y.map((yi, i) => yi - fitted[i]);
  const rss       = residuals.reduce((s, r) => s + r ** 2, 0);
  const yMean     = mean(y);
  const tss       = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
  const rSq       = tss > 0 ? 1 - rss / tss : 0;
  const adjRSq    = 1 - (1 - rSq) * (n - 1) / (n - k - 1);
  const sigma2    = rss / (n - k);

  // SE(β_j) = √(σ² · [(X'X)⁻¹]_{jj}) — get diagonal via solve XtX·e_j = I_j
  const stdErrors = beta.map((_, j) => {
    const ej = Array(k).fill(0); ej[j] = 1;
    const col = solveLinear(XtX, ej);
    return col ? Math.sqrt(Math.max(0, sigma2 * col[j])) : NaN;
  });

  const tStats  = beta.map((b, j) => b / stdErrors[j]);
  const pValues = tStats.map(twoTailedP);

  // Durbin-Watson statistic
  let dwNum = 0;
  for (let t = 1; t < residuals.length; t++) dwNum += (residuals[t] - residuals[t - 1]) ** 2;
  const dw = rss > 0 ? dwNum / rss : NaN;

  return { beta, stdErrors, tStats, pValues, rSquared: rSq, adjRSquared: adjRSq, rss, residuals, fitted, durbinWatson: dw, n, k };
}

// ── Bootstrap CI ──────────────────────────────────────────────────────────────

function resample<T>(arr: T[]): T[] {
  return Array.from({ length: arr.length }, () => arr[Math.floor(Math.random() * arr.length)]);
}

export function bootstrapElasticityCI(
  before: { meanPrice: number; nOrders: number }[],
  after:  { meanPrice: number; nOrders: number }[],
  B = 1000,
): [number, number] | null {
  if (before.length < 2 || after.length < 2) return null;
  const eps: number[] = [];
  for (let b = 0; b < B; b++) {
    const rb = resample(before);
    const ra = resample(after);
    const pb = mean(rb.map(d => d.meanPrice));
    const pa = mean(ra.map(d => d.meanPrice));
    const qb = mean(rb.map(d => d.nOrders));
    const qa = mean(ra.map(d => d.nOrders));
    const dp = pa - pb;
    if (!pb || !qb || Math.abs(dp) < 1e-10) continue;
    const e = ((qa - qb) / qb) / (dp / pb);
    if (isFinite(e)) eps.push(e);
  }
  if (eps.length < 20) return null;
  eps.sort((a, b) => a - b);
  return [eps[Math.floor(eps.length * 0.025)], eps[Math.floor(eps.length * 0.975)]];
}

// ── Date helpers ──────────────────────────────────────────────────────────────

export function weekOfYear(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z');
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getUTCDay() + 1) / 7);
}

export function monthOf(dateStr: string): number {
  return parseInt(dateStr.split('-')[1], 10);
}

export function diffDays(a: string, b: string): number {
  return (new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000;
}

// ── Log-log OLS design matrix ─────────────────────────────────────────────────

export interface DailyPoint {
  date: string;
  exchangeRate: number;
  nOrders: number;
  meanPrice: number;
  meanCatalogPrice: number;
  nDiscounted: number;
}

// Columns: intercept, log(P), week#, month_2..month_12 (11 dummies, Jan=ref), has_promo
export const OLS_COL_NAMES = [
  'Intercept', 'log(P)', 'Week #',
  'Month Feb', 'Month Mar', 'Month Apr', 'Month May', 'Month Jun',
  'Month Jul', 'Month Aug', 'Month Sep', 'Month Oct', 'Month Nov', 'Month Dec',
  'Has Promo',
];

export function buildLogLogMatrix(pts: DailyPoint[]): { X: number[][]; y: number[] } | null {
  const valid = pts.filter(p => p.meanPrice > 0 && p.nOrders > 0);
  if (valid.length < OLS_COL_NAMES.length + 2) return null;

  const X = valid.map(p => {
    const mo = monthOf(p.date);
    const wk = weekOfYear(p.date);
    const monthDummies = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => mo === m ? 1 : 0);
    return [1, Math.log(p.meanPrice), wk, ...monthDummies, p.nDiscounted > 0 ? 1 : 0];
  });
  const y = valid.map(p => Math.log(p.nOrders));
  return { X, y };
}
