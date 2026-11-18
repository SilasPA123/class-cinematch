// Recommendations from the class's own lists (user-based collaborative filtering).
// `sim(a, b)` returns the match score (0-100) between two people, the same one the match cards show.
// Only films someone in class picked can be recommended; nothing comes from outside the class.

function tally(people, exclude, weightOf) {
  const scores = new Map();
  for (const p of people) {
    const w = weightOf(p);
    if (!(w > 0)) continue;
    for (const f of p.films) {
      if (exclude.has(f.id)) continue;
      const e = scores.get(f.id) || { film: f, score: 0, by: [] };
      e.score += w;
      e.by.push({ person: p, w });
      scores.set(f.id, e);
    }
  }
  return [...scores.values()]
    .map(e => ({ ...e, by: e.by.sort((x, y) => y.w - x.w) }))
    .sort((x, y) => y.score - x.score || y.by.length - x.by.length || x.film.title.localeCompare(y.film.title));
}

// Films the people most like `me` picked and `me` didn't, weighted by how well each one matches.
export function recommendFor(me, people, sim, n = 3) {
  const others = people.filter(p => p.id !== me.id);
  const own = new Set(me.films.map(f => f.id));
  return tally(others, own, p => sim(me, p) / 100).slice(0, n);
}

// A film neither person picked, backed by people who match BOTH of them at least `minSim`%
// (each such voter counts with the lower of their two match scores).
export function recommendForPair(a, b, people, sim, n = 1, minSim = 40) {
  const others = people.filter(p => p.id !== a.id && p.id !== b.id);
  const own = new Set([...a.films, ...b.films].map(f => f.id));
  return tally(others, own, p => {
    const w = Math.min(sim(a, p), sim(b, p));
    return w >= minSim ? w / 100 : 0;
  }).slice(0, n);
}
