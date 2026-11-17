import { TMDB_KEY, LETTERBOXD_PROXY } from "./config.js";
import { DEMO_CATALOG } from "./demo.js";

export const hasTMDB = Boolean(TMDB_KEY);
const BASE = "https://api.themoviedb.org/3";
const LANG = "en-US";

export const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const yearOf = d => (d ? Number(String(d).slice(0, 4)) || null : null);

async function tmdb(path, params = {}, signal) {
  const url = new URL(BASE + path);
  const opts = { headers: {}, signal };
  if (TMDB_KEY.startsWith("eyJ")) opts.headers.Authorization = "Bearer " + TMDB_KEY;
  else url.searchParams.set("api_key", TMDB_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error("TMDB " + res.status);
  return res.json();
}

const stub = r => ({ id: String(r.id), title: r.title, year: yearOf(r.release_date), poster: r.poster_path || null });

// Autocomplete search. Returns light objects {id,title,year,poster}.
export async function searchFilms(query, signal) {
  const q = query.trim();
  if (q.length < 2) return [];
  if (!hasTMDB) {
    const n = norm(q);
    return DEMO_CATALOG.filter(f => norm(f.title).includes(n)).slice(0, 6);
  }
  const data = await tmdb("/search/movie", { query: q, language: LANG, include_adult: "false" }, signal);
  return (data.results || []).slice(0, 6).map(stub);
}

// Resolves a preset [title, year] to a light film object, or null.
const presetCache = new Map();
export async function resolvePreset(title, year) {
  const key = title + "|" + year;
  if (presetCache.has(key)) return presetCache.get(key);
  let found = null;
  if (!hasTMDB) {
    found = DEMO_CATALOG.find(f => norm(f.title) === norm(title)) || null;
  } else {
    const data = await tmdb("/search/movie", { query: title, year: String(year), language: LANG, include_adult: "false" });
    const results = data.results || [];
    const exact = results.find(r => norm(r.title) === norm(title));
    found = stub(exact || results[0] || { id: 0 });
    if (!found.title) found = null;
  }
  if (found) presetCache.set(key, found);
  return found;
}

// Letterboxd import. On localhost, falls back to the dev proxy (node worker/dev-proxy.mjs).
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
export const letterboxdProxy = LETTERBOXD_PROXY || (isLocal ? "http://localhost:8766" : "");

// Returns { films: [full film objects], missing: [titles we could not resolve] }.
export async function importLetterboxd(username) {
  const user = username.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?letterboxd\.com\//i, "").replace(/\/.*$/, "");
  if (!/^[A-Za-z0-9_]{1,40}$/.test(user)) throw new Error("invalid_user");
  const url = new URL(letterboxdProxy);
  url.searchParams.set("user", user);
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "proxy_error");
  const films = [], missing = [];
  for (const { title, year } of data.films || []) {
    try {
      const s = await resolvePreset(title, year);
      if (s) films.push(await getFilm(s)); else missing.push(title);
    } catch { missing.push(title); }
  }
  return { films, missing };
}

export const presetAvailableOffline = title => hasTMDB || DEMO_CATALOG.some(f => norm(f.title) === norm(title));

// Full metadata used by the matching. Called once, when the student picks a film.
export async function getFilm(s) {
  if (!hasTMDB) return DEMO_CATALOG.find(f => f.id === s.id) || s;
  const d = await tmdb("/movie/" + s.id, { language: LANG, append_to_response: "credits,keywords" });
  const overview = (d.overview || "").trim();
  return {
    id: String(d.id),
    title: d.title,
    year: yearOf(d.release_date),
    poster: d.poster_path || null,
    directors: (d.credits?.crew || []).filter(c => c.job === "Director").map(c => c.name).slice(0, 3),
    genres: (d.genres || []).map(g => g.name),
    keywords: (d.keywords?.keywords || []).map(k => k.name).slice(0, 12),
    countries: (d.production_countries || []).map(c => c.iso_3166_1),
    lang: d.original_language || null,
    cast: (d.credits?.cast || []).slice(0, 3).map(c => c.name),
    overview: overview.length > 280 ? overview.slice(0, 277) + "..." : overview,
    runtime: d.runtime || null
  };
}

export function posterUrl(film, size = "w185") {
  return film.poster ? `https://image.tmdb.org/t/p/${size}${film.poster}` : null;
}
