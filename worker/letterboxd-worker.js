// Cloudflare Worker: reads the 4 "favorite films" of a PUBLIC Letterboxd profile.
// GET /?user=<username>  ->  { user, films: [{ title, year }] }
// The browser cannot read letterboxd.com directly (CORS), so the site calls this instead.
// It only fetches the public profile page; it stores nothing.

const ALLOWED_ORIGIN = "*"; // tighten to your site, e.g. "https://<user>.github.io"

const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};
const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors, ...extra } });

const decode = s => s
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

export function parseFavorites(html) {
  const section = html.match(/<section[^>]*id="favourites"[\s\S]*?<\/section>/);
  if (!section) return [];
  const films = [];
  for (const m of section[0].matchAll(/data-(?:item|film)-name="([^"]+)"/g)) {
    const name = decode(m[1]);
    const parts = name.match(/^(.*) \((\d{4})\)$/);
    const film = parts ? { title: parts[1], year: Number(parts[2]) } : { title: name, year: null };
    if (!films.some(f => f.title === film.title && f.year === film.year)) films.push(film);
    if (films.length === 4) break;
  }
  return films;
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

    const user = (new URL(request.url).searchParams.get("user") || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{1,40}$/.test(user)) return json({ error: "invalid_user" }, 400);

    let res;
    try {
      res = await fetch(`https://letterboxd.com/${user}/`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          "Accept": "text/html",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
    } catch {
      return json({ error: "upstream_unreachable" }, 502);
    }
    if (res.status === 404) return json({ error: "user_not_found" }, 404);
    if (!res.ok) return json({ error: "upstream_blocked", status: res.status }, 502);

    const films = parseFavorites(await res.text());
    if (!films.length) return json({ error: "no_favorites", user }, 404);
    return json({ user, films }, 200, { "Cache-Control": "public, max-age=600" });
  }
};
