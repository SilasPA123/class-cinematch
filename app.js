import { createStore } from "./store.js";
import { searchFilms, getFilm, posterUrl, hasTMDB, resolvePreset, presetAvailableOffline, importLetterboxd, letterboxdProxy } from "./films.js";
import { beyondFor, beyondForPair } from "./beyond.js";
import { compare, allPairs } from "./match.js";
import { PRESETS } from "./presets.js";
import { pcoa } from "./pcoa.js";
import { recommendFor, recommendForPair } from "./recommend.js";
import { classAwards } from "./awards.js";
import { tasteGroups, describeGroup } from "./groups.js";
import { hasProfiles, tasteProfile } from "./profile.js";

// categorical colors for taste groups (validated for color-vision deficiency; dots always carry a name label too)
const GROUP_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];

// match score between two people, cached until the class list changes
let simCache = new Map();
const sim = (a, b) => {
  if (a.id === b.id) return 100;
  const key = a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id;
  if (!simCache.has(key)) simCache.set(key, compare(a, b).pct);
  return simCache.get(key);
};
const firstName = p => p.name.replace(/\s*\(demo\)$/, "");

const store = createStore();
const state = {
  people: [], myId: null, name: "", slots: [null, null, null, null],
  saving: false, showAll: false, hydrated: false, presetIds: new Map(), loadingPreset: null
};

// ---------- helpers ----------
const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, "");
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  return e;
};
const $ = id => document.getElementById(id);
const mine = () => state.people.find(p => p.id === state.myId);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function filmCard(f, { small = false, onRemove, detail = false } = {}) {
  const url = posterUrl(f);
  const meta = [f.year, (f.directors || []).join(", ")].filter(Boolean).join(" · ");
  return h("div", { class: "film" + (small ? " small" : "") },
    url ? h("img", { class: "poster", src: url, alt: "", loading: "lazy" })
        : h("div", { class: "ph", "aria-hidden": "true" }, (f.title || "?")[0]),
    h("div", {},
      h("div", { class: "t" }, f.title),
      h("div", { class: "m" }, meta),
      detail && (f.genres || []).length ? h("div", { class: "m" }, f.genres.join(", ")) : null,
      detail && f.overview ? h("p", { class: "ov" }, f.overview) : null),
    onRemove ? h("button", { class: "x", type: "button", "aria-label": "Remove film", onclick: onRemove }, "×") : null);
}

// ---------- form ----------
function renderForm() {
  const root = $("form");
  root.replaceChildren();
  const name = h("input", { type: "text", maxlength: "40", placeholder: "What should we call you?", autocomplete: "nickname", value: state.name });
  name.addEventListener("input", () => { state.name = name.value; updateSubmit(); });
  root.append(h("label", { class: "field" }, "Name", name));

  if (letterboxdProxy) root.append(letterboxdRow());

  const slotsEl = h("div", { class: "slots" });
  const presetsEl = h("details", { class: "presets", open: true });
  root.append(slotsEl, presetsEl);
  refreshPicker();

  const msg = h("span", { class: "msg", id: "form-msg", role: "status" });
  const submit = h("button", { class: "primary", id: "submit", type: "button", onclick: submitEntry });
  const actions = h("div", { class: "actions" }, submit, msg);
  if (mine()) actions.append(h("button", { class: "link", type: "button", onclick: removeMine }, "Remove me"));
  root.append(actions);
  updateSubmit();
}

const LB_ERRORS = {
  invalid_user: "That doesn't look like a Letterboxd username.",
  user_not_found: "We couldn't find that Letterboxd profile.",
  no_favorites: "That profile doesn't have favorite films set.",
  upstream_blocked: "Letterboxd isn't answering right now. Pick your films below instead.",
  upstream_unreachable: "Letterboxd isn't answering right now. Pick your films below instead."
};

function letterboxdRow() {
  const input = h("input", { type: "text", maxlength: "60", placeholder: "Letterboxd username", "aria-label": "Letterboxd username", autocomplete: "off", autocapitalize: "none", spellcheck: "false" });
  const btn = h("button", { class: "secondary", type: "button" }, "Import");
  const run = async () => {
    if (!input.value.trim()) return;
    btn.disabled = true; setMsg("Checking Letterboxd...");
    try {
      const { films, missing } = await importLetterboxd(input.value);
      if (!films.length) throw new Error("no_match");
      state.slots = [0, 1, 2, 3].map(i => films[i] || null);
      refreshPicker(); updateSubmit();
      setMsg(missing.length
        ? `Got ${films.length} of ${films.length + missing.length}. We couldn't find ${missing.join(", ")}. Add the rest below.`
        : "Got your four favorites. Change anything you like, then join.", missing.length > 0);
    } catch (err) {
      setMsg(LB_ERRORS[err.message] || "That didn't work. Pick your films below instead.", true);
    } finally {
      btn.disabled = false;
    }
  };
  btn.addEventListener("click", run);
  input.addEventListener("keydown", e => { if (e.key === "Enter") run(); });
  return h("div", { class: "lb" },
    h("div", { class: "lb-label" }, "On Letterboxd? Bring in your four favorites"),
    h("div", { class: "lb-row" }, input, btn),
    h("div", { class: "lb-or" }, "or pick them here"));
}

function refreshPicker() {
  const slotsEl = document.querySelector("#form .slots");
  const presetsEl = document.querySelector("#form .presets");
  if (slotsEl) renderSlots(slotsEl);
  if (presetsEl) renderPresets(presetsEl);
}

function renderSlots(slotsEl) {
  slotsEl.replaceChildren();
  state.slots.forEach((film, i) => {
    const box = h("div", { class: "slot" }, h("div", { class: "num" }, "ADMIT ONE · № 0" + (i + 1)));
    if (film) box.append(filmCard(film, { onRemove: () => { state.slots[i] = null; refreshPicker(); updateSubmit(); } }));
    else box.append(searchBox(i));
    slotsEl.append(box);
  });
}

function searchBox(i) {
  const input = h("input", { type: "text", placeholder: "Search for a film", "aria-label": `Search film ${i + 1}`, autocomplete: "off" });
  const results = h("div", { class: "results", hidden: true });
  let timer, ctrl;
  const close = () => { results.hidden = true; };
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value;
    if (q.trim().length < 2) return close();
    timer = setTimeout(async () => {
      ctrl?.abort(); ctrl = new AbortController();
      try {
        const found = await searchFilms(q, ctrl.signal);
        results.replaceChildren();
        if (!found.length) results.append(h("div", { class: "none" }, "Nothing found. Check the spelling, or try the list below."));
        for (const f of found) results.append(h("button", { type: "button", onclick: () => addFilm(f, i) }, filmCard(f, { small: true })));
        results.hidden = false;
      } catch (err) {
        if (err.name === "AbortError") return;
        results.replaceChildren(h("div", { class: "none" }, "The search didn't work. Try again."));
        results.hidden = false;
      }
    }, 250);
  });
  input.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  document.addEventListener("click", e => { if (!results.parentElement?.contains(e.target)) close(); });
  return h("div", {}, input, results);
}

function renderPresets(el) {
  el.replaceChildren(h("summary", {}, "Need ideas? Here are some popular ones"));
  for (const g of PRESETS) {
    const chips = g.films.filter(([t]) => presetAvailableOffline(t)).map(([title, year]) => {
      const key = title + "|" + year;
      const id = state.presetIds.get(key);
      const selected = id && state.slots.some(s => s && s.id === id);
      return h("button", {
        type: "button", class: "chip pick" + (selected ? " on" : ""), "aria-pressed": selected ? "true" : "false",
        disabled: state.loadingPreset === key,
        onclick: () => togglePreset(title, year)
      }, `${title} (${year})`);
    });
    if (chips.length) el.append(h("div", { class: "group" }, h("h4", {}, g.group), h("div", { class: "chips" }, chips)));
  }
}

async function togglePreset(title, year) {
  const key = title + "|" + year;
  const knownId = state.presetIds.get(key);
  const idx = knownId ? state.slots.findIndex(s => s && s.id === knownId) : -1;
  if (idx >= 0) { state.slots[idx] = null; refreshPicker(); updateSubmit(); return; }
  const free = state.slots.findIndex(s => !s);
  if (free < 0) return setMsg("You already have four. Remove one to swap it.", true);
  state.loadingPreset = key; refreshPicker();
  try {
    const s = await resolvePreset(title, year);
    if (!s) throw new Error("not found");
    state.presetIds.set(key, s.id);
    state.loadingPreset = null;
    await addFilm(s, state.slots.findIndex(x => !x));
  } catch (err) {
    state.loadingPreset = null; refreshPicker();
    setMsg("That one didn't load. Try searching for it.", true);
  }
}

async function addFilm(stub, i) {
  if (i < 0) return setMsg("You already have four. Remove one to swap it.", true);
  if (state.slots.some(s => s && s.id === stub.id)) return setMsg("You already picked that one.", true);
  try {
    setMsg("Loading...");
    state.slots[i] = await getFilm(stub);
    setMsg("");
  } catch (err) {
    state.slots[i] = null;
    setMsg("That one didn't load. Try again.", true);
  }
  refreshPicker();
  updateSubmit();
}

function setMsg(text, err = false) {
  const m = $("form-msg");
  if (!m) return;
  m.textContent = text;
  m.className = "msg" + (err ? " err" : "");
}

function updateSubmit() {
  const btn = $("submit");
  if (!btn) return;
  const ready = state.name.trim().length > 0 && state.slots.every(Boolean);
  btn.disabled = !ready || state.saving;
  btn.textContent = mine() ? "Save changes" : "Print my ticket";
}

async function submitEntry() {
  state.saving = true; updateSubmit();
  try {
    await store.save({ name: state.name.trim().slice(0, 40), films: state.slots });
    setMsg("Ticket printed. Your matches are below.");
    setTimeout(() => { const m = $("mine"); if (m && !m.hidden) m.scrollIntoView({ behavior: "smooth", block: "start" }); }, 600);
  } catch (err) {
    console.error(err);
    setMsg("That didn't save. Check your connection and try again.", true);
  } finally {
    state.saving = false; updateSubmit();
  }
}

async function removeMine() {
  if (!confirm("Remove yourself from the class?")) return;
  await store.remove();
  state.slots = [null, null, null, null];
  renderForm();
}

// ---------- results ----------
function pairCard(pair, { open = false } = {}) {
  const { a, b, pct, summary, reasons } = pair;
  const tile = f => {
    const url = posterUrl(f, "w342");
    const shared = pair.sharedFilms.some(s => s.id === f.id);
    return h("figure", { class: "tile" + (shared ? " shared" : ""), title: f.overview || f.title },
      url ? h("img", { src: url, alt: f.title, loading: "lazy" })
          : h("div", { class: "ph" }, f.title),
      h("figcaption", {},
        h("b", {}, f.title),
        h("span", {}, [f.year, (f.directors || [])[0]].filter(Boolean).join(" · ")),
        (f.genres || []).length ? h("span", { class: "g" }, f.genres.slice(0, 2).join(", ")) : null));
  };
  const col = p => h("div", {}, h("h4", {}, pair.mine && p === a ? "You" : p.name), h("div", { class: "tiles" }, p.films.map(tile)));
  const newBox = beyondPair(pair);
  const profBoxes = [pair.mine ? null : profileLine(a), profileLine(b)].filter(Boolean);
  const lazy = [...profBoxes, newBox].filter(Boolean);
  const details = h("details", { class: "pair", open },
    h("summary", {},
      h("span", { class: "names" }, pair.mine ? b.name : `${a.name} and ${b.name}`),
      h("span", { class: "pct" }, pct + "%"),
      h("span", { class: "sum" }, summary),
      h("span", { class: "bar" }, h("i", { style: `width:${pct}%` }))),
    h("div", { class: "body" },
      ...profBoxes,
      reasons.length ? h("ul", {}, reasons.map(r => h("li", {}, r.text))) : h("p", { class: "msg" }, "Nothing in common that we could find."),
      watchTogether(pair),
      newBox,
      h("div", { class: "cols" }, col(a), col(b))));
  if (lazy.length) {
    let loaded = false;
    const loadAll = () => { if (!loaded) { loaded = true; lazy.forEach(b => b.load()); } };
    if (open) queueMicrotask(loadAll);
    details.addEventListener("toggle", () => { if (details.open) loadAll(); });
  }
  return details;
}

const quoted = t => "“" + t + "”";
const classFilmIds = () => new Set(state.people.flatMap(p => p.films.map(f => f.id)));
const whoName = p => (!p || p.id === state.myId ? "you" : firstName(p));

function newTile(film, why) {
  const url = posterUrl(film, "w342");
  return h("figure", { class: "tile new" },
    url ? h("img", { src: url, alt: film.title, loading: "lazy" }) : h("div", { class: "ph" }, film.title),
    h("figcaption", {}, h("b", {}, film.title), film.year ? h("span", {}, String(film.year)) : null, h("span", { class: "why" }, why)));
}

// Fill `el` once the async result is ready, unless the page re-rendered in the meantime.
function fillLater(el, promise, render) {
  promise.then(res => { if (el.isConnected) el.replaceChildren(...render(res)); })
    .catch(() => { if (el.isConnected) el.replaceChildren(h("p", { class: "msg" }, "Couldn't reach TMDB just now.")); });
}

function beyondPair(pair) {
  if (!hasTMDB) return null;
  const box = h("div", { class: "together-new" }, h("p", { class: "msg" }, "Looking beyond the class..."));
  const load = () => fillLater(box, beyondForPair(pair.a, pair.b, classFilmIds()), rec => {
    if (!rec) return [h("p", { class: "msg" }, "TMDB had nothing new for this pair.")];
    const parts = rec.because.map(b => `${quoted(b.film.title)} (${whoName(b.who)})`);
    const why = rec.both ? `TMDB links it to ${parts[0]} and ${parts[1]}.` : `TMDB links it to ${parts[0]}.`;
    return [h("span", { class: "together-tag" }, "Or something new"), filmCard(rec.film, { small: true }), h("p", { class: "together-why" }, why)];
  });
  box.load = load;
  return box;
}

function watchTogether(pair) {
  const [rec] = recommendForPair(pair.a, pair.b, state.people, sim, 1);
  if (!rec) return null;
  const voters = rec.by.slice(0, 2).map(v => v.person.id === state.myId ? "you" : firstName(v.person));
  const who = voters.length === 1 ? voters[0] : voters.join(" and ");
  const both = pair.mine ? "you both" : "both of them";
  return h("div", { class: "together" },
    h("span", { class: "together-tag" }, "Watch together"),
    filmCard(rec.film, { small: true }),
    h("p", { class: "together-why" }, `${pair.mine ? "Neither of you" : "Neither of them"} picked it, but ${who} did, and ${voters.length === 1 && voters[0] !== "you" ? "matches" : "match"} ${both} well.`));
}

function profileCard(me) {
  const text = h("p", { class: "profile-text" }, "Reading your ticket stubs...");
  fillLater(text, tasteProfile(me), t => [t || ""]);
  return h("div", { class: "card profile-card" },
    h("h3", {}, "Your taste, in two lines"), text,
    h("p", { class: "msg profile-note" }, "Written by AI (Claude) from your four films."));
}

function profileLine(person) {
  if (!hasProfiles) return null;
  const box = h("p", { class: "profile-line" }, "Reading ticket stubs...");
  box.load = () => fillLater(box, tasteProfile(person), t => [h("b", {}, `${person.id === state.myId ? "Your" : firstName(person) + "'s"} taste: `), t || ""]);
  return box;
}

function recCard(me) {
  const recs = recommendFor(me, state.people, sim, 3);
  const card = h("div", { class: "card rec-card" },
    h("h3", {}, "Recommended for you"),
    h("p", { class: "map-sub" }, "Films your closest matches love, plus new ones TMDB connects to your list."));
  if (!recs.length) {
    card.append(h("p", { class: "msg" }, "Nothing from the class yet. More show up as people join."));
    appendBeyond(card, me);
    return card;
  }
  card.append(h("h4", { class: "rec-sub" }, "From the class"));
  card.append(h("ol", { class: "recs" }, recs.map(r => {
    const top = r.by.slice(0, 2).map(v => `${firstName(v.person)} (${Math.round(v.w * 100)}%)`);
    const more = r.by.length - top.length;
    const why = `Picked by ${top.join(" and ")}${more > 0 ? ` and ${more} more` : ""}.`;
    return h("li", {}, filmCard(r.film, { small: true }), h("p", { class: "rec-why" }, why));
  })));
  appendBeyond(card, me);
  return card;
}

function appendBeyond(card, me) {
  if (!hasTMDB) return;
  const closest = state.people.filter(p => p.id !== me.id)
    .map(p => ({ person: p, pct: sim(me, p) })).sort((x, y) => y.pct - x.pct).slice(0, 2);
  const grid = h("div", { class: "tiles new-tiles" }, h("p", { class: "msg" }, "Looking beyond the class..."));
  card.append(h("h4", { class: "rec-sub" }, "Beyond the class"), grid);
  fillLater(grid, beyondFor(me, closest, classFilmIds(), 4), recs => {
    if (!recs.length) return [h("p", { class: "msg" }, "TMDB had nothing new for your list.")];
    return recs.map(r => {
      const b = r.because.slice(0, 2);
      const why = b.length === 2 && !b[0].who && !b[1].who
        ? `Because you picked ${quoted(b[0].film.title)} and ${quoted(b[1].film.title)}`
        : `Because ${whoName(b[0].who)} picked ${quoted(b[0].film.title)}`;
      return newTile(r.film, why);
    });
  });
}

function renderMine() {
  const me = mine();
  $("mine").hidden = !me;
  if (!me) return;
  const others = state.people.filter(p => p.id !== me.id);
  const root = $("mine-list");
  root.replaceChildren();
  if (!others.length) {
    root.append(h("p", { class: "msg" }, "You're the first one here. Matches show up as soon as someone else joins."));
    return;
  }
  if (hasProfiles) root.append(profileCard(me));
  root.append(recCard(me));
  const ranked = others.map(o => ({ a: me, b: o, mine: true, ...compare(me, o, true) })).sort((x, y) => y.raw - x.raw);
  const shown = state.showAll ? ranked : ranked.slice(0, 5);
  shown.forEach((p, i) => root.append(pairCard(p, { open: i === 0 })));
  if (ranked.length > 5) {
    root.append(h("button", { class: "link", type: "button", onclick: () => { state.showAll = !state.showAll; renderMine(); } },
      state.showAll ? "Show top 5" : `Show all ${ranked.length}`));
  }
}

// ---------- taste map (PCoA on match distances) ----------
const SVG_NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};

function tasteMap(people) {
  const card = h("div", { class: "card map-card" },
    h("h3", {}, "Taste map"),
    h("p", { class: "map-sub" }, "Each dot is a person. The closer two dots are, the more similar their taste."));
  if (people.length < 3) {
    card.append(h("p", { class: "msg" }, "The map appears once at least three people have joined."));
    return card;
  }
  // distance = 1 - match score, from the same compare() the match cards use
  const n = people.length;
  const pct = Array.from({ length: n }, () => Array(n).fill(100));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) pct[i][j] = pct[j][i] = sim(people[i], people[j]);
  const D = pct.map((row, i) => row.map((p, j) => (i === j ? 0 : 1 - p / 100)));
  const res = pcoa(D);
  if (!res) return card;
  const grp = tasteGroups(D);
  const labels = grp && grp.labels;
  const groupInfo = labels ? grp.members.map(m => describeGroup(m.map(i => people[i]))) : [];
  const used = new Set();
  const groupName = groupInfo.map((g, gi) => {
    const pick = g.genres.find(x => !used.has(x)) || g.genres[0] || "Mixed";
    used.add(pick);
    return grp.members[gi].length === 1 ? `Flying solo (${pick.toLowerCase()})` : `The ${pick.toLowerCase()} crowd`;
  });

  const narrow = window.innerWidth < 600;
  const W = narrow ? 440 : 640, H = narrow ? 480 : 420, PAD = narrow ? 28 : 44, LABEL = narrow ? 70 : 120;
  const xs = res.coords.map(c => c[0]), ys = res.coords.map(c => c[1]);
  const span = a => Math.max(1e-6, Math.max(...a) - Math.min(...a));
  // one scale for both axes, so distances on screen stay true to the analysis
  const k = Math.min((W - 2 * PAD - LABEL) / span(xs), (H - 2 * PAD) / span(ys));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const X = x => W / 2 + (x - cx) * k, Y = y => H / 2 - (y - cy) * k;

  const e1 = Math.round(100 * res.explained[0]), e2 = Math.round(100 * (res.explained[1] || 0));
  const meIdx = people.findIndex(p => p.id === state.myId);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": `Taste map of ${n} people. Axis 1 shows ${e1}% and axis 2 shows ${e2}% of the variation in taste.` });
  svg.append(
    s("line", { x1: X(0), y1: 12, x2: X(0), y2: H - 12, class: "map-axis" }),
    s("line", { x1: 12, y1: Y(0), x2: W - 12, y2: Y(0), class: "map-axis" }),
    s("text", { x: W - 14, y: Y(0) + 22, "text-anchor": "end", class: "map-axis-label" }, `PCo1 · ${e1}%`),
    s("text", { x: X(0) + 8, y: 24, class: "map-axis-label" }, `PCo2 · ${e2}%`));

  const tip = h("div", { class: "map-tip", hidden: true, role: "status" });
  const nearest = i => {
    let best = -1;
    for (let j = 0; j < n; j++) if (j !== i && (best < 0 || pct[i][j] > pct[i][best])) best = j;
    return best;
  };
  const show = (i, px, py) => {
    const j = nearest(i);
    tip.replaceChildren(
      h("b", {}, i === meIdx ? "You" : people[i].name),
      labels ? h("span", { class: "tg" }, groupName[labels[i]]) : null,
      h("span", {}, people[i].films.map(f => f.title).join(" · ")),
      j >= 0 ? h("span", { class: "tw" }, `Closest: ${j === meIdx ? "you" : people[j].name} (${pct[i][j]}%)`) : null);
    tip.style.left = (100 * px / W) + "%";
    tip.className = "map-tip" + (px < W * 0.3 ? " lft" : px > W * 0.7 ? " rgt" : "");
    tip.style.top = (100 * py / H) + "%";
    tip.hidden = false;
  };
  const hide = () => { tip.hidden = true; };

  // draw others first, you last (on top)
  const idx = people.map((_, i) => i).sort((a, b) => (a === meIdx) - (b === meIdx));
  for (const i of idx) {
    const px = X(xs[i]), py = Y(ys[i]), mine = i === meIdx;
    const right = px < W - (narrow ? 90 : 150);
    const label = mine ? "You" : people[i].name.replace(/\s*\(demo\)$/, "");
    const g = s("g", { class: "map-pt" + (mine ? " me" : ""), tabindex: "0",
      "aria-label": `${mine ? "You" : people[i].name}: ${people[i].films.map(f => f.title).join(", ")}` },
      s("circle", { cx: px, cy: py, r: 18, class: "hit" }),
      s("circle", { cx: px, cy: py, r: mine ? 10 : 7, class: "dot", style: labels ? `fill:${GROUP_COLORS[labels[i]]}` : null }),
      s("text", { x: px + (right ? 14 : -14), y: py + 5, "text-anchor": right ? "start" : "end", class: "lbl" }, label));
    g.addEventListener("mouseenter", () => show(i, px, py));
    g.addEventListener("focus", () => show(i, px, py));
    g.addEventListener("mouseleave", hide);
    g.addEventListener("blur", hide);
    svg.append(g);
  }

  const side = h("div", { class: "map-side" });
  card.append(h("div", { class: "map-layout" }, h("div", { class: "map-wrap" }, svg, tip), side));
  if (labels) {
    side.append(h("h4", { class: "groups-title" }, "Taste groups"),
      h("ul", { class: "groups" }, grp.members.map((m, gi) => {
        const g = groupInfo[gi];
        const traits = [g.genres.length ? `Mostly ${g.genres.slice(0, 2).map(x => x.toLowerCase()).join(" and ")}` : null,
          g.directors.length ? `shared love of ${g.directors.join(" and ")}` : null,
          g.decade ? `lots of ${g.decade}s` : null].filter(Boolean).join(" · ");
        const names = m.map(i => (i === meIdx ? "you" : firstName(people[i])));
        return h("li", {},
          h("i", { class: "k", style: `background:${GROUP_COLORS[gi]}` }),
          h("div", {}, h("b", {}, groupName[gi]), h("span", { class: "gm" }, names.join(", ")), traits ? h("span", { class: "gt" }, traits) : null));
      })));
  } else {
    side.append(h("p", { class: "msg" }, "No clear taste groups yet: everyone overlaps a bit. Groups appear when the class splits into clusters."));
  }
  if (meIdx >= 0) side.append(h("p", { class: "msg you-key" }, "Your dot is the big one with the dark ring."));
  side.append(h("p", { class: "msg map-note" },
    `Distance between two people = 100% minus their match score. The two axes are the directions that spread the class out the most (principal coordinates analysis); together they show ${e1 + e2}% of the variation. Groups come from average-linkage clustering on the same distances${labels ? `, with ${grp.k} groups chosen because that split separates people best (silhouette ${grp.silhouette.toFixed(2)})` : ""}.`));
  return card;
}

function awardsBlock(people) {
  const awards = classAwards(people, sim);
  if (!awards.length) return h("p", { class: "msg" }, "Class awards appear once at least three people have joined.");
  const nm = p => (p.id === state.myId ? `${firstName(p)} (you)` : firstName(p));
  return h("div", { class: "awards-wrap" },
    h("h3", {}, "Class awards"),
    h("ul", { class: "awards" }, awards.map(a => h("li", { class: "award" },
      h("span", { class: "award-title" }, a.title),
      h("b", { class: "award-who" }, a.winners.length > 3 ? `${a.winners.length}-way tie` : a.winners.map(nm).join(" & ")),
      h("span", { class: "award-detail" }, a.detail)))));
}

function renderCrowd() {
  const people = state.people;
  $("crowd-title").textContent = `The class so far (${plural(people.length, "person", "people")})`;
  const body = $("crowd-body");
  body.replaceChildren();
  if (!people.length) { body.append(h("p", { class: "msg" }, "Nobody's here yet.")); return; }

  const filmCount = new Map(), genreCount = new Map(), dirCount = new Map();
  for (const p of people) {
    for (const f of p.films) {
      const e = filmCount.get(f.id) || { f, n: 0 }; e.n++; filmCount.set(f.id, e);
      for (const g of f.genres || []) genreCount.set(g, (genreCount.get(g) || 0) + 1);
      for (const d of f.directors || []) dirCount.set(d, (dirCount.get(d) || 0) + 1);
    }
  }
  const top = (m, n) => [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, n);
  const films = [...filmCount.values()].sort((x, y) => y.n - x.n || x.f.title.localeCompare(y.f.title)).slice(0, 6);
  const repeated = top(dirCount, 8).filter(([, n]) => n > 1).slice(0, 6);

  body.append(awardsBlock(people));
  body.append(h("div", { class: "grid2" },
    h("div", { class: "card" }, h("h3", {}, "Most picked"),
      h("ul", { class: "rank" }, films.map(({ f, n }) =>
        h("li", {}, filmCard(f, { small: true }), h("span", { class: "n" }, plural(n, "pick", "picks")))))),
    h("div", { class: "card" }, h("h3", {}, "Genres and directors"),
      h("div", { class: "chips" }, top(genreCount, 6).map(([g, n]) => h("span", { class: "chip" }, `${g} · ${n}`))),
      h("p", { class: "msg" }, "Directors that came up more than once"),
      h("div", { class: "chips" }, repeated.length
        ? repeated.map(([d, n]) => h("span", { class: "chip" }, `${d} · ${n}`))
        : h("span", { class: "msg" }, "None so far.")))));

  body.append(tasteMap(people));

  const pairs = allPairs(people).slice(0, 3);
  if (pairs.length) {
    body.append(h("h3", {}, "Closest pairs"));
    pairs.forEach(p => body.append(pairCard(p)));
  }
}

function renderBanner() {
  const b = $("banner");
  b.replaceChildren();
  if (store.mode === "demo") {
    b.append(h("div", { class: "banner" },
      "Demo mode. Nothing is shared yet, and the people marked (demo) are made up. ",
      hasTMDB ? "" : "Search only knows 30 films for now. ",
      h("button", { class: "link", type: "button", onclick: () => { try { localStorage.clear(); } catch {} location.reload(); } }, "Reset demo")));
  }
}

// Entries come from a shared database, so treat them as untrusted: keep only well-formed
// people and films, with bounded sizes, before anything is rendered or compared.
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const strs = (v, n, max) => (Array.isArray(v) ? v.filter(x => typeof x === "string").slice(0, n).map(x => x.slice(0, max)) : []);
function cleanFilm(f) {
  if (!f || typeof f !== "object") return null;
  const id = str(f.id, 40), title = str(f.title, 200);
  if (!id || !title) return null;
  return {
    id, title,
    year: Number.isInteger(f.year) && f.year > 1870 && f.year < 2100 ? f.year : null,
    poster: typeof f.poster === "string" && /^\/[A-Za-z0-9_.-]{1,80}$/.test(f.poster) ? f.poster : null,
    directors: strs(f.directors, 3, 80), genres: strs(f.genres, 8, 40), keywords: strs(f.keywords, 12, 60),
    countries: strs(f.countries, 6, 3), lang: str(f.lang, 8) || null, cast: strs(f.cast, 3, 80),
    overview: str(f.overview, 300)
  };
}
function cleanPerson(p) {
  if (!p || typeof p !== "object" || typeof p.id !== "string") return null;
  const name = str(p.name, 40).trim();
  const films = Array.isArray(p.films) ? p.films.slice(0, 4).map(cleanFilm) : [];
  if (!name || films.length !== 4 || films.some(f => !f)) return null;
  return { id: p.id, name, films };
}

function onPeople(raw) {
  const list = (Array.isArray(raw) ? raw : []).slice(0, 500).map(cleanPerson).filter(Boolean);
  state.people = list;
  simCache = new Map();
  const me = list.find(p => p.id === state.myId);
  if (me && !state.hydrated) { // first time we see our saved entry: prefill the form
    state.hydrated = true;
    state.name = me.name;
    state.slots = me.films.slice(0, 4);
    renderForm();
  } else {
    updateSubmit();
  }
  renderMine();
  renderCrowd();
  const hc = $("hero-count");
  if (hc) hc.textContent = list.length ? plural(list.length, "classmate", "classmates") : "our class";
}

// ---------- start ----------
renderBanner();
renderForm();
store.ready().then(id => {
  state.myId = id;
  store.subscribe(onPeople);
}).catch(err => {
  console.error(err);
  $("banner").append(h("div", { class: "banner" }, "Can't reach the server. Try reloading the page."));
});
