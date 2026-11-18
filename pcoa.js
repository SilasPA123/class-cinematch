// Principal coordinates analysis (classical multidimensional scaling).
// Input: a symmetric n×n distance matrix D. Output: 2-D coordinates per row, plus the share of
// variation each axis captures (eigenvalue / sum of positive eigenvalues, as is usual for PCoA).
// Small classes only (the Jacobi eigen-solver is O(n³) per sweep), which is fine for a room of people.

function jacobiEigen(S) {
  const n = S.length;
  const a = S.map(r => r.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  return { values: a.map((r, i) => r[i]), vectors: V };
}

export function pcoa(D) {
  const n = D.length;
  if (n < 3) return null;
  // Gower's centred matrix: B = -1/2 · J D² J
  const A = D.map(r => r.map(d => -0.5 * d * d));
  const rowMean = A.map(r => r.reduce((s, x) => s + x, 0) / n);
  const grand = rowMean.reduce((s, x) => s + x, 0) / n;
  const B = A.map((r, i) => r.map((x, j) => x - rowMean[i] - rowMean[j] + grand));

  const { values, vectors } = jacobiEigen(B);
  const order = values.map((v, i) => i).sort((i, j) => values[j] - values[i]);
  const positive = values.filter(v => v > 1e-10).reduce((s, v) => s + v, 0);
  if (positive <= 0) return { coords: D.map(() => [0, 0]), explained: [0, 0] };

  const axes = order.slice(0, 2).map(k => {
    const lam = Math.max(values[k], 0);
    let col = vectors.map(r => r[k] * Math.sqrt(lam));
    // Eigenvector signs are arbitrary; fix them so the map doesn't flip as people join.
    let big = 0;
    for (const x of col) if (Math.abs(x) > Math.abs(big)) big = x;
    if (big < 0) col = col.map(x => -x);
    return { col, share: lam / positive };
  });
  return {
    coords: D.map((_, i) => [axes[0].col[i], axes[1] ? axes[1].col[i] : 0]),
    explained: axes.map(a => a.share)
  };
}
