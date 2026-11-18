// Share dialog: a QR code for the address this page is open at, plus copy / send link.
// The QR is drawn in the browser, so it always matches the site it is shown on.
// Library: qrcode-generator (MIT), loaded from cdnjs only when the dialog is first opened,
// pinned to an exact version and checked with a Subresource Integrity hash.

const LIB = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
const LIB_SRI = "sha384-mZT2gIty7ZDdOGkxfP6joZcYdMW1Jvj9dRlfpTmaJAKKXTqzygtB22k7FLe+KZC1";

const pageUrl = location.origin + location.pathname.replace(/index\.html$/, "");
const $ = id => document.getElementById(id);
const dialog = $("share");

let libPromise;
function loadLib() {
  libPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = LIB; s.integrity = LIB_SRI; s.crossOrigin = "anonymous";
    s.onload = () => (window.qrcode ? resolve(window.qrcode) : reject(new Error("qr_lib_missing")));
    s.onerror = () => reject(new Error("qr_lib_failed"));
    document.head.append(s);
  }).catch(err => { libPromise = null; throw err; });
  return libPromise;
}

function drawQr(target, text, qrcode) {
  const qr = qrcode(0, "M"); // 0 = smallest version that fits, medium error correction
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount(), quiet = 4, size = n + quiet * 2;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("shape-rendering", "crispEdges");
  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("width", size); bg.setAttribute("height", size); bg.setAttribute("fill", "#ffffff");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", d); path.setAttribute("fill", "#141414");
  svg.append(bg, path);
  target.replaceChildren(svg);
}

async function open() {
  $("share-url").textContent = pageUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  $("share-msg").textContent = "";
  $("share-send").hidden = typeof navigator.share !== "function";
  if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  if (!$("share-qr").firstChild) {
    try { drawQr($("share-qr"), pageUrl, await loadLib()); }
    catch { $("share-qr").hidden = true; $("share-msg").textContent = "The QR code didn't load. The link above still works."; }
  }
}

if (dialog) {
  document.querySelectorAll(".share-open").forEach(b => b.addEventListener("click", open));
  dialog.querySelector(".share-x").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); }); // click on the backdrop
  $("share-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(pageUrl); $("share-msg").textContent = "Link copied."; }
    catch { $("share-msg").textContent = "Couldn't copy. Select the link above instead."; }
  });
  $("share-send").addEventListener("click", () => {
    navigator.share({ title: "CineMatch", text: "Add your four favorite films", url: pageUrl }).catch(() => {});
  });
}
