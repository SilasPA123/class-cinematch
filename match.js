// Affinity matching between two participants (4 films each).
// With so few films, exact overlap is rare, so the score combines shared films with directors,
// genres, themes, era, country/language and cast. Each component that contributes also yields an explanation.

const decadeOf = y => (y ? Math.floor(y / 10) * 10 : null);
const inter = (a, b) => [...a].filter(x => b.has(x));
const jaccard = (a, b) => {
  const u = new Set([...a, ...b]);
  return u.size ? inter(a, b).length / u.size : 0;
};
const list = arr => {
  if (arr.length <= 1) return arr.join("");
  if (arr.length === 2) return arr[0] + " and " + arr[1];
  return arr.slice(0, -1).join(", ") + ", and " + arr[arr.length - 1];
};
const quote = t => "“" + t + "”";

let regionNames, langNames;
try {
  regionNames = new Intl.DisplayNames(["en"], { type: "region" });
  langNames = new Intl.DisplayNames(["en"], { type: "language" });
} catch { /* no Intl.DisplayNames: fall back to codes */ }
const regionName = c => { try { return regionNames?.of(c) || c; } catch { return c; } };
const langName = c => { try { return langNames?.of(c) || c; } catch { return c; } };

function profile(p) {
  const fs = p.films;
  return {
    ids: new Set(fs.map(f => f.id)),
    dir: new Set(fs.flatMap(f => f.directors || [])),
    gen: new Set(fs.flatMap(f => f.genres || [])),
    kw: new Set(fs.flatMap(f => f.keywords || [])),
    dec: new Set(fs.map(f => decadeOf(f.year)).filter(Boolean)),
    cty: new Set(fs.flatMap(f => f.countries || [])),
    lang: new Set(fs.map(f => f.lang).filter(Boolean)),
    cast: new Set(fs.flatMap(f => f.cast || []))
  };
}

const withValue = (p, key, val) => p.films.filter(f => (f[key] || []).includes(val));

export function compare(a, b, mine = false) {
  // mine = the viewer is person a, so the text says "you" instead of naming both people.
  const both = mine ? "You both" : "They both";
  const aName = mine ? "You" : a.name;
  const between = mine ? "between you" : "between them";
  const A = profile(a), B = profile(b);
  const sharedFilms = a.films.filter(f => B.ids.has(f.id));
  const sd = inter(A.dir, B.dir);
  const sg = inter(A.gen, B.gen);
  const sk = inter(A.kw, B.kw);
  const sdec = inter(A.dec, B.dec).sort((x, y) => x - y);
  const scty = inter(A.cty, B.cty);
  const slang = inter(A.lang, B.lang);
  const scast = inter(A.cast, B.cast);

  const raw = 40 * sharedFilms.length + 15 * sd.length + 20 * jaccard(A.gen, B.gen) +
    15 * jaccard(A.kw, B.kw) + 10 * jaccard(A.dec, B.dec) + 8 * jaccard(A.cty, B.cty) +
    4 * jaccard(A.lang, B.lang) + 6 * Math.min(3, scast.length);
  const pct = Math.round(100 * (1 - Math.exp(-raw / 55)));

  const lower = g => g.toLowerCase();
  const country = c => { const n = regionName(c); return /^United/.test(n) ? "the " + n : n; };
  const words = ["no", "one", "two", "three", "four"];

  const reasons = [];
  for (const f of sharedFilms) reasons.push({ kind: "film", text: `${both} picked ${quote(f.title)}.` });
  for (const d of sd) {
    const fa = withValue(a, "directors", d).filter(f => !B.ids.has(f.id));
    const fb = withValue(b, "directors", d).filter(f => !A.ids.has(f.id));
    if (fa.length && fb.length)
      reasons.push({ kind: "director", text: `${aName} picked ${list(fa.map(f => quote(f.title)))} and ${b.name} picked ${list(fb.map(f => quote(f.title)))}. Same director, ${d}.` });
    else if (fa.length + fb.length)
      reasons.push({ kind: "director", text: `There is more than one ${d} film ${between}.` });
  }
  if (sg.length) {
    const ranked = sg.map(g => [g, withValue(a, "genres", g).length + withValue(b, "genres", g).length])
      .sort((x, y) => y[1] - x[1]).map(x => lower(x[0]));
    reasons.push({ kind: "genre", text: `Both lists have ${list(ranked.slice(0, 3))}.` });
  }
  if (sk.length) reasons.push({ kind: "theme", text: `Some of the same themes come up: ${list(sk.slice(0, 4))}.` });
  if (scast.length) reasons.push({ kind: "cast", text: `${list(scast.slice(0, 3))} ${scast.length === 1 ? "is" : "are"} in films on both lists.` });
  if (sdec.length) reasons.push({ kind: "era", text: `${both} went for films from the ${list(sdec.map(d => d + "s"))}.` });
  const nonEn = slang.filter(l => l !== "en");
  const abroad = scty.filter(c => c !== "US");
  if (nonEn.length) reasons.push({ kind: "lang", text: `${both} picked something in ${list(nonEn.map(langName))}.` });
  else if (abroad.length) reasons.push({ kind: "country", text: `${both} picked films from ${list(abroad.map(country))}.` });

  let summary;
  if (sharedFilms.length >= 2) summary = `${words[sharedFilms.length][0].toUpperCase() + words[sharedFilms.length].slice(1)} of the same films.`;
  else if (sharedFilms.length === 1) summary = `${both} have ${quote(sharedFilms[0].title)}.`;
  else if (sd.length) summary = `${both} have something by ${sd[0]}.`;
  else if (sg.length >= 3) summary = `No films in common, but a lot of the same genres.`;
  else if (reasons.length) summary = `Not much in common, just a few small things.`;
  else summary = `Nothing in common. Good excuse to trade recommendations.`;

  return { pct, raw, reasons, summary, sharedFilms };
}

export function allPairs(people) {
  const out = [];
  for (let i = 0; i < people.length; i++)
    for (let j = i + 1; j < people.length; j++)
      out.push({ a: people[i], b: people[j], ...compare(people[i], people[j]) });
  return out.sort((x, y) => y.raw - x.raw);
}
