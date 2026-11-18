// Class superlatives, computed from the entries and the match scores (sim(a, b) → 0-100).
const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;

// Everyone tied for the best value wins together.
function best(people, value, higher = true) {
  const vals = people.map(p => ({ p, v: value(p) })).filter(x => Number.isFinite(x.v));
  if (!vals.length) return null;
  const top = higher ? Math.max(...vals.map(x => x.v)) : Math.min(...vals.map(x => x.v));
  return { winners: vals.filter(x => Math.abs(x.v - top) < 1e-9).map(x => x.p), value: top };
}

export function classAwards(people, sim) {
  if (people.length < 3) return [];
  const out = [];
  const avgSim = p => mean(people.filter(q => q.id !== p.id).map(q => sim(p, q)));

  let twin = null;
  for (let i = 0; i < people.length; i++)
    for (let j = i + 1; j < people.length; j++) {
      const v = sim(people[i], people[j]);
      if (!twin || v > twin.value) twin = { winners: [people[i], people[j]], value: v };
    }
  out.push({ key: "twins", title: "Taste twins", ...twin, detail: v => `${v}% match` });

  const main = best(people, avgSim, true);
  out.push({ key: "mainstream", title: "Most mainstream", ...main, detail: v => `${Math.round(v)}% average match with everyone` });
  const wild = best(people.filter(p => !main.winners.includes(p)), avgSim, false);
  if (wild) out.push({ key: "wild", title: "Wild card", ...wild, detail: v => `only ${Math.round(v)}% average match` });

  const years = p => { const ys = p.films.map(f => f.year).filter(Boolean); return ys.length ? mean(ys) : NaN; };
  const old = best(people, years, false);
  if (old) out.push({ key: "time", title: "Time traveler", ...old, detail: v => `films average ${Math.round(v)}` });

  const places = p => new Set([...p.films.flatMap(f => f.countries || []), ...p.films.map(f => f.lang).filter(l => l && l !== "en").map(l => "lang:" + l)]).size;
  const globe = best(people, places, true);
  if (globe && globe.value > 1) out.push({ key: "globe", title: "Globetrotter", ...globe, detail: v => `${v} countries and languages in 4 films` });

  const genres = p => new Set(p.films.flatMap(f => f.genres || [])).size;
  const expl = best(people, genres, true);
  if (expl && expl.value > 0) out.push({ key: "genre", title: "Genre explorer", ...expl, detail: v => `${v} different genres in 4 films` });

  return out.filter(a => a.winners && a.winners.length).map(a => ({ ...a, detail: a.detail(a.value) }));
}
