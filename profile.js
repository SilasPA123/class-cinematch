// Taste profiles from the Worker in worker/taste-worker.js. Off when TASTE_PROXY is empty.
import { TASTE_PROXY } from "./config.js";

export const hasProfiles = Boolean(TASTE_PROXY);
const memo = new Map();

export function tasteProfile(person) {
  if (!hasProfiles) return Promise.resolve(null);
  const films = person.films.map(f => ({ title: f.title, year: f.year, genres: (f.genres || []).slice(0, 4), directors: (f.directors || []).slice(0, 2) }));
  const key = films.map(f => f.title + "|" + f.year).sort().join("\n");
  if (!memo.has(key)) {
    memo.set(key, (async () => {
      try { const saved = sessionStorage.getItem("taste:" + key); if (saved) return saved; } catch { /* ignore */ }
      const res = await fetch(TASTE_PROXY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ films }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.profile !== "string") throw new Error(data.error || "profile_error");
      try { sessionStorage.setItem("taste:" + key, data.profile); } catch { /* ignore */ }
      return data.profile;
    })().catch(err => { memo.delete(key); throw err; }));
  }
  return memo.get(key);
}
