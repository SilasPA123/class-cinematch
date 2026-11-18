// Taste groups: average-linkage (UPGMA) hierarchical clustering on a distance matrix,
// cut at the number of groups (2-6) with the highest mean silhouette width.

function silhouette(D, labels) {
  const n = D.length, ks = [...new Set(labels)];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const own = labels.map((l, j) => (l === labels[i] && j !== i ? j : -1)).filter(j => j >= 0);
    if (!own.length) continue; // singletons count as 0
    const a = own.reduce((s, j) => s + D[i][j], 0) / own.length;
    let b = Infinity;
    for (const k of ks) {
      if (k === labels[i]) continue;
      const m = labels.map((l, j) => (l === k ? j : -1)).filter(j => j >= 0);
      b = Math.min(b, m.reduce((s, j) => s + D[i][j], 0) / m.length);
    }
    total += (b - a) / Math.max(a, b);
  }
  return total / n;
}

export function tasteGroups(D, { minSilhouette = 0.15 } = {}) {
  const n = D.length;
  if (n < 4) return null;
  let clusters = D.map((_, i) => [i]);
  const avg = (A, B) => { let s = 0; for (const i of A) for (const j of B) s += D[i][j]; return s / (A.length * B.length); };
  const cuts = new Map();
  while (clusters.length > 1) {
    let bi = 0, bj = 1, bd = Infinity;
    for (let i = 0; i < clusters.length; i++)
      for (let j = i + 1; j < clusters.length; j++) {
        const d = avg(clusters[i], clusters[j]);
        if (d < bd) { bd = d; bi = i; bj = j; }
      }
    clusters = clusters.filter((_, k) => k !== bi && k !== bj).concat([clusters[bi].concat(clusters[bj])]);
    if (clusters.length <= 6) cuts.set(clusters.length, clusters.map(c => c.slice()));
  }
  let pick = null;
  for (let k = 2; k <= Math.min(6, n - 1); k++) {
    const cs = cuts.get(k);
    if (!cs) continue;
    const labels = Array(n);
    cs.forEach((c, ci) => c.forEach(i => { labels[i] = ci; }));
    const s = silhouette(D, labels);
    if (!pick || s > pick.silhouette + 1e-9) pick = { k, silhouette: s, clusters: cs };
  }
  if (!pick || pick.silhouette < minSilhouette) return { k: 1, silhouette: pick ? pick.silhouette : 0, labels: null };
  // biggest group first, so colors stay stable-ish as people join
  const ordered = pick.clusters.slice().sort((a, b) => b.length - a.length || Math.min(...a) - Math.min(...b));
  const labels = Array(n);
  ordered.forEach((c, ci) => c.forEach(i => { labels[i] = ci; }));
  return { k: pick.k, silhouette: pick.silhouette, labels, members: ordered };
}

// What a group has in common: top genres, directors shared by 2+ members, most common decade.
export function describeGroup(people) {
  const count = (arr) => { const m = new Map(); for (const x of arr) m.set(x, (m.get(x) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const genres = count(people.flatMap(p => p.films.flatMap(f => f.genres || [])));
  const dirs = count(people.flatMap(p => [...new Set(p.films.flatMap(f => f.directors || []))])).filter(([, c]) => c >= 2 && people.length >= 2);
  const decades = count(people.flatMap(p => p.films.map(f => (f.year ? Math.floor(f.year / 10) * 10 : null)).filter(Boolean)));
  return { genres: genres.slice(0, 3).map(g => g[0]), directors: dirs.slice(0, 2).map(d => d[0]), decade: decades[0] ? decades[0][0] : null };
}
