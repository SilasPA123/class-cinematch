// Recommendations from outside the class, built from TMDB's per-film recommendations.
// Each seed film "votes" for the films TMDB recommends for it; higher-ranked TMDB results count more.
// Films already on anyone's list in class are skipped (those are covered by recommend.js).
import { tmdbRecs } from "./films.js";

async function votes(seeds, skip) {
  const lists = await Promise.all(seeds.map(s => tmdbRecs(s.film.id)));
  const out = new Map();
  lists.forEach((list, i) => list.forEach((r, rank) => {
    if (skip.has(r.id)) return;
    const e = out.get(r.id) || { film: r, score: 0, because: [] };
    e.score += seeds[i].w * (1 - rank / 25);
    if (!e.because.some(b => b.film.id === seeds[i].film.id)) e.because.push(seeds[i]);
    out.set(r.id, e);
  }));
  return out;
}

// For one person: seeds are their own films (weight 1) plus the films of their closest matches
// (weight 0.6 × match score), so the suggestions lean toward what similar people like too.
export async function beyondFor(me, closest, classIds, n = 4) {
  const mine = new Set(me.films.map(f => f.id));
  const seeds = me.films.map(f => ({ film: f, w: 1, who: null })).concat(
    closest.flatMap(({ person, pct }) => person.films.filter(f => !mine.has(f.id))
      .map(f => ({ film: f, w: 0.6 * pct / 100, who: person }))));
  const scored = await votes(seeds, classIds);
  return [...scored.values()].sort((x, y) => y.score - x.score).slice(0, n)
    .map(e => ({ ...e, because: e.because.sort((x, y) => y.w - x.w) }));
}

// For a pair: prefer films TMDB recommends from BOTH people's lists (score = product of the two sides);
// if nothing overlaps, fall back to the best film from either side.
export async function beyondForPair(a, b, classIds) {
  const [va, vb] = await Promise.all([
    votes(a.films.map(f => ({ film: f, w: 1, who: a })), classIds),
    votes(b.films.map(f => ({ film: f, w: 1, who: b })), classIds)
  ]);
  const both = [...va.keys()].filter(id => vb.has(id)).map(id => ({
    film: va.get(id).film, score: va.get(id).score * vb.get(id).score,
    because: [va.get(id).because[0], vb.get(id).because[0]], both: true
  })).sort((x, y) => y.score - x.score);
  if (both.length) return both[0];
  const any = [...va.values(), ...vb.values()].sort((x, y) => y.score - x.score)[0];
  return any ? { ...any, because: any.because.slice(0, 1), both: false } : null;
}
