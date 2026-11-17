import { createStore } from "./store.js";
import { searchFilms, getFilm, posterUrl, hasTMDB, resolvePreset, presetAvailableOffline, importLetterboxd, letterboxdProxy } from "./films.js";
import { compare, allPairs } from "./match.js";
import { PRESETS } from "./presets.js";

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
    const box = h("div", { class: "slot" }, h("div", { class: "num" }, "Film " + (i + 1)));
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
  btn.textContent = mine() ? "Save changes" : "Join";
}

async function submitEntry() {
  state.saving = true; updateSubmit();
  try {
    await store.save({ name: state.name.trim().slice(0, 40), films: state.slots });
    setMsg("You're in. Your matches are below.");
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
  return h("details", { class: "pair", open },
    h("summary", {},
      h("span", { class: "names" }, pair.mine ? b.name : `${a.name} and ${b.name}`),
      h("span", { class: "pct" }, pct + "%"),
      h("span", { class: "sum" }, summary),
      h("span", { class: "bar" }, h("i", { style: `width:${pct}%` }))),
    h("div", { class: "body" },
      reasons.length ? h("ul", {}, reasons.map(r => h("li", {}, r.text))) : h("p", { class: "msg" }, "Nothing in common that we could find."),
      h("div", { class: "cols" }, col(a), col(b))));
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
  const ranked = others.map(o => ({ a: me, b: o, mine: true, ...compare(me, o, true) })).sort((x, y) => y.raw - x.raw);
  const shown = state.showAll ? ranked : ranked.slice(0, 5);
  shown.forEach((p, i) => root.append(pairCard(p, { open: i === 0 })));
  if (ranked.length > 5) {
    root.append(h("button", { class: "link", type: "button", onclick: () => { state.showAll = !state.showAll; renderMine(); } },
      state.showAll ? "Show top 5" : `Show all ${ranked.length}`));
  }
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

function onPeople(list) {
  state.people = list;
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
