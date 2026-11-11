// Organizer page logic.
const $ = (id) => document.getElementById(id);
const FIELDS = ["title", "greeting", "body", "closing", "startDate", "startTime", "endDate", "endTime", "location", "map", "hostName", "hostPhone", "cc", "baseUrl"];
const STORE_KEY = "wa-invites-v1";
const PHOTO_KEY = "wa-invites-photo";

let guests = []; // { name, raw, phone, sent }
let opts = { style: "classic", layout: "clean", sendMode: "text", theme: "emerald", personalize: true };
let photo = null; // HTMLImageElement or null

// ---------- Persistence (per-browser convenience only) ----------
function save() {
  try {
    const data = { guests, opts };
    FIELDS.forEach((f) => (data[f] = $(f).value));
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch (_) {}
}

function load() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (_) {}
  if (!data) { applyStyle("classic", true); return; }
  // Older versions stored "start"/"end" as one date-time value (2026-12-05T12:00).
  for (const k of ["start", "end"]) {
    if (typeof data[k] === "string" && data[k].includes("T") && !data[k + "Date"]) {
      [data[k + "Date"], data[k + "Time"]] = data[k].split("T");
    }
  }
  FIELDS.forEach((f) => { if (typeof data[f] === "string") $(f).value = data[f]; });
  guests = Array.isArray(data.guests) ? data.guests : [];
  if (data.opts) opts = { ...opts, ...data.opts };
  // Older versions had no greeting/closing: keep a custom message as-is, otherwise use the Classic wording.
  if (data.greeting === undefined) {
    if (isStockText("body", data.body)) applyStyle("classic", true);
    else { $("greeting").value = ""; $("closing").value = ""; }
  }
}

function loadPhoto() {
  try {
    const url = localStorage.getItem(PHOTO_KEY);
    if (url) setPhotoFromUrl(url, false);
  } catch (_) {}
}

// ---------- Styles ----------
function applyStyle(key, force) {
  const s = STYLES[key];
  if (!s) return;
  const edited = ["greeting", "body", "closing"].some((f) => !isStockText(f, $(f).value));
  if (!force && edited && !confirm(`Replace your greeting, message and closing with the ${s.label} wording?`)) {
    opts.style = key; // keep their text, but use the style's emojis and theme
  } else {
    $("greeting").value = s.greeting;
    $("body").value = s.body;
    $("closing").value = s.closing;
  }
  opts.style = key;
  opts.theme = s.theme;
}

// ---------- Event ----------
function currentEvent() {
  const sd = $("startDate").value, st = $("startTime").value;
  const ed = $("endDate").value || sd, et = $("endTime").value;
  const s = sd ? new Date(`${sd}T${st || "00:00"}`) : null;
  let e = ed && et ? new Date(`${ed}T${et}`) : null;
  if (s && e && e <= s) e = null; // ignore an end that is not after the start
  return {
    t: $("title").value.trim(),
    b: $("body").value.trim(),
    s: s ? s.toISOString() : "",
    e: e ? e.toISOString() : "",
    l: $("location").value.trim(),
    m: $("map").value.trim(),
    h: normalizePhone($("hostPhone").value, $("cc").value),
    n: $("hostName").value.trim(),
  };
}

function baseUrl() {
  let b = $("baseUrl").value.trim();
  if (!b) b = location.href.replace(/[#?].*$/, "").replace(/index\.html$/, "");
  if (!b.endsWith("/") && !/\.html$/.test(b)) b += "/";
  return b.replace(/index\.html$/, "");
}

function isLocalBase() {
  return /^(file:|https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|[^/]+\.local)\b)/i.test(baseUrl());
}

function firstName(name) {
  return (name || "").trim().split(/\s+/)[0] || "";
}

function personalize(text, name) {
  return (text || "").replace(/\{name\}/gi, firstName(name) || "there");
}

function inviteUrl(ev, guestName) {
  const greet = personalize($("greeting").value.trim(), guestName);
  const body = [greet, personalize(ev.b, guestName)].filter(Boolean).join("\n");
  const payload = { ...ev, b: body };
  const g = guestName ? `&g=${encodeURIComponent(guestName)}` : "";
  return `${baseUrl()}invite.html#e=${encodeEvent(payload)}${g}`;
}

function buildMessage(guest) {
  const ev = currentEvent();
  const name = guest ? guest.name : "";
  const style = STYLES[opts.style] || STYLES.classic;
  const [d1, d2] = style.deco;
  const greeting = personalize($("greeting").value.trim(), name);
  const body = personalize(ev.b, name);
  const closing = personalize($("closing").value.trim(), name);
  const parts = ev.s ? formatParts(ev.s, ev.e) : null;
  const invite = inviteUrl(ev, name);
  const L = [];

  if (ev.t) L.push([d1, `*${ev.t}*`, d2].filter(Boolean).join(" "), "");
  if (greeting) L.push(greeting);
  if (body) L.push(body);
  if (greeting || body) L.push("");

  if (opts.layout === "clean") {
    if (parts) L.push(`> 🗓️ *${parts.date}*`, `> 🕛 ${parts.time}`);
    if (ev.l) L.push(`> 📍 ${ev.l}`);
    if (parts || ev.l) L.push("");
    L.push("👉 *RSVP, map & add to calendar:*", invite);
  } else {
    if (parts) L.push(`🗓️ *Date:* ${parts.date}`, `🕛 *Time:* ${parts.time}`);
    if (ev.l) L.push(`📍 *Venue:* ${ev.l}`);
    if (parts || ev.l) L.push("");
    L.push(`✅ *RSVP & add to calendar:*`, invite, "");
    const map = mapUrl(ev);
    if (map) L.push(`🗺️ *Map:*`, map, "");
    if (ev.s) L.push(`📅 *Google Calendar:*`, googleCalendarUrl({ ...ev, b: body }));
  }
  if (ev.h) L.push("_Or simply reply YES, NO or MAYBE._");
  if (closing || ev.n) L.push("");
  if (closing) L.push(closing);
  if (ev.n) L.push(`— ${ev.n}`);
  // Tidy up doubled blank lines.
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function validate() {
  const ev = currentEvent();
  const problems = [];
  if (!ev.t) problems.push("a title");
  if (!$("startDate").value) problems.push("a start date");
  if (!$("startTime").value) problems.push("a start time");
  if (!ev.h) problems.push("your WhatsApp number");
  return problems;
}

// ---------- Card ----------
const cardCache = new Map(); // key -> Blob

function cardOptions(guest) {
  return {
    ev: currentEvent(),
    guestName: guest ? guest.name : "",
    themeKey: opts.theme,
    photo,
    personalize: opts.personalize,
    deco: (STYLES[opts.style] || STYLES.classic).deco,
  };
}

function cardKey(guest) {
  return opts.personalize && guest ? firstName(guest.name) : "*";
}

async function getCardBlob(guest) {
  const key = cardKey(guest);
  if (cardCache.has(key)) return cardCache.get(key);
  const c = document.createElement("canvas");
  renderCard(c, cardOptions(guest));
  const blob = await canvasToBlob(c, "image/png");
  cardCache.set(key, blob);
  return blob;
}

function cardFileName(guest) {
  const base = (currentEvent().t || "invitation").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-");
  const who = opts.personalize && guest && guest.name ? "-" + firstName(guest.name) : "";
  return `${base}${who}.png`;
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// Picking a photo or theme only matters if the card is sent, so switch to "Card + text".
function useCardMode() {
  if (opts.sendMode === "card") return;
  opts.sendMode = "card";
  toast("Switched to <strong>Card + text</strong> so your card is included in the invite.");
}

function setPhotoFromUrl(url, persist) {
  const img = new Image();
  img.onload = () => {
    photo = img;
    if (persist) {
      try { localStorage.setItem(PHOTO_KEY, url); } catch (_) {}
      useCardMode();
      save();
    }
    render();
  };
  img.src = url;
}

function handlePhoto(file) {
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    // Shrink large photos so they're quick to draw and fit in browser storage.
    const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    setPhotoFromUrl(c.toDataURL("image/jpeg", 0.85), true);
  };
  img.src = URL.createObjectURL(file);
}

// ---------- Contacts import ----------
function addGuests(list) {
  const cc = $("cc").value;
  const seen = new Set(guests.map((g) => g.phone).filter(Boolean));
  let added = 0;
  for (const { name, phone } of list) {
    const norm = normalizePhone(phone, cc);
    if (norm && seen.has(norm)) continue;
    if (!norm && !name) continue;
    if (norm) seen.add(norm);
    guests.push({ name: (name || "").trim(), raw: phone || "", phone: norm, sent: false });
    added++;
  }
  render();
  save();
  return added;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === ";" || c === "\t") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

function parseCsv(text) {
  const rows = parseCsvRows(text.replace(/^﻿/, ""));
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = header.some((h) => /name|phone|mobile|tel|number|whatsapp/.test(h));
  if (!hasHeader) {
    // No header: guess "name, phone" or "phone, name".
    return rows.map((r) => {
      const [a = "", b = ""] = r;
      return /\d{6,}/.test(a.replace(/\D/g, "")) && !/\d{6,}/.test(b.replace(/\D/g, ""))
        ? { name: b, phone: a }
        : { name: a, phone: b };
    });
  }
  const idx = (re) => header.findIndex((h) => re.test(h));
  const phoneCols = header
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => /phone|mobile|tel|whatsapp|number|cell/.test(h) && !/type|label/.test(h))
    .sort((a, b) => (/mobile|cell|whatsapp/.test(b.h) ? 1 : 0) - (/mobile|cell|whatsapp/.test(a.h) ? 1 : 0))
    .map(({ i }) => i);
  const full = idx(/^(full ?name|name|display ?name|contact)$/);
  const first = idx(/first|given/);
  const last = idx(/last|family|surname/);
  return rows.slice(1).map((r) => {
    let name = full >= 0 ? r[full] : [first >= 0 ? r[first] : "", last >= 0 ? r[last] : ""].join(" ");
    let phone = "";
    for (const i of phoneCols) {
      const v = (r[i] || "").split(":::")[0]; // Google Contacts joins multiple numbers with " ::: "
      if (v.replace(/\D/g, "").length >= 6) { phone = v; break; }
    }
    return { name: (name || "").trim(), phone };
  });
}

function parseVcf(text) {
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const cards = unfolded.split(/BEGIN:VCARD/i).slice(1);
  return cards.map((card) => {
    const lines = card.split("\n");
    let name = "", n = "", tels = [];
    for (const line of lines) {
      const [rawKey, ...rest] = line.split(":");
      const val = rest.join(":").trim();
      const key = rawKey.toUpperCase();
      const base = key.split(";")[0].replace(/^ITEM\d+\./, "");
      if (base === "FN") name = val;
      else if (base === "N") n = val.split(";").slice(0, 2).reverse().join(" ").trim();
      else if (base === "TEL") tels.push({ val: val.replace(/^tel:/i, ""), cell: /CELL|MOBILE|IPHONE|WHATSAPP/.test(key) });
    }
    const tel = tels.find((t) => t.cell) || tels[0];
    return { name: (name || n).replace(/\\,/g, ",").trim(), phone: tel ? tel.val : "" };
  });
}

async function handleFiles(files) {
  let total = 0;
  for (const f of files) {
    const text = await f.text();
    const list = /BEGIN:VCARD/i.test(text) ? parseVcf(text) : parseCsv(text);
    total += addGuests(list);
  }
  $("progress").textContent = `Imported ${total} guest${total === 1 ? "" : "s"}.`;
}

async function pickContacts() {
  const supported = "contacts" in navigator && "ContactsManager" in window;
  if (!supported) {
    $("pickerNote").hidden = false;
    return;
  }
  try {
    const picked = await navigator.contacts.select(["name", "tel"], { multiple: true });
    addGuests(picked.map((c) => ({ name: (c.name || [])[0] || "", phone: (c.tel || [])[0] || "" })));
  } catch (err) {
    console.warn(err);
  }
}

// ---------- Sending ----------
const isPhone = () => matchMedia("(pointer: coarse)").matches;
const pasteKey = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘V" : "Ctrl+V");

let toastTimer = null;
function toast(html, ms = 6000) {
  const el = $("toast");
  el.innerHTML = html;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

function markSent(g) {
  g.sent = true;
  render();
  save();
}

async function sendTo(i) {
  const problems = validate();
  if (problems.length) {
    alert(`Please add ${problems.join(", ")} first.`);
    return;
  }
  const g = guests[i];
  if (!g || !g.phone) return;
  const text = buildMessage(g);

  if (opts.sendMode !== "card") {
    window.open(waLink(g.phone, text), "_blank", "noopener");
    markSent(g);
    return;
  }

  const key = cardKey(g);

  if (isPhone() && navigator.canShare) {
    // The Share menu must open straight from the tap, so use the card prepared in advance when we can.
    const blob = cardCache.get(key) || (await getCardBlob(g));
    const file = new File([blob], cardFileName(g), { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
      try {
        await navigator.share({ files: [file], text });
        markSent(g);
      } catch (err) {
        if (err.name === "NotAllowedError") toast("Tap <strong>Send</strong> again to open the Share menu.");
        // AbortError: they closed the Share menu, so leave it unsent.
      }
      return;
    }
  }

  // Computer: step 1 copies the card image; step 2 (a button in the pop-up) opens the guest's chat
  // with the text filled in. Two clicks, because browsers block a new window opened after the copy.
  let copied = false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": getCardBlob(g) })]);
    copied = true;
  } catch (_) {
    downloadBlob(await getCardBlob(g), cardFileName(g));
  }
  const how = copied
    ? `🖼️ <strong>Card copied.</strong> Open the chat, press <strong>${pasteKey()}</strong> to attach the card, then send.`
    : `🖼️ <strong>Card downloaded.</strong> Open the chat, attach it with the 📎 button, then send.`;
  toast(
    `${how}<br><small>The invite text is already typed in the chat. If it isn't added as the card's caption, send it as well.</small>` +
      `<div class="btns"><button type="button" class="primary small" id="openChat">Open WhatsApp chat with ${escapeHtml(firstName(g.name) || "guest")}</button></div>`,
    60000
  );
  $("openChat").onclick = () => {
    window.open(waLink(g.phone, text), "_blank", "noopener");
    $("toast").hidden = true;
    markSent(g);
  };
}

function sendNext() {
  const i = guests.findIndex((g) => !g.sent && g.phone);
  if (i === -1) {
    alert(guests.length ? "Everyone has been sent an invite." : "Add some guests first.");
    return;
  }
  sendTo(i);
}

// ---------- Rendering ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Render WhatsApp formatting (*bold*, _italic_, ~strike~, > quote, links) for the preview bubble.
function waToHtml(text) {
  const inline = (s) =>
    escapeHtml(s)
      .replace(/(https?:\/\/[^\s]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.length > 60 ? u.slice(0, 57) + "…" : u}</a>`)
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s.,!?)])/g, "$1<strong>$2</strong>")
      .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,!?)])/g, "$1<em>$2</em>")
      .replace(/(^|[\s(])~([^~\n]+)~(?=$|[\s.,!?)])/g, "$1<s>$2</s>");
  const out = [];
  let quote = [];
  const flush = () => { if (quote.length) { out.push(`<span class="waq">${quote.join("<br>")}</span>`); quote = []; } };
  for (const line of text.split("\n")) {
    if (line.startsWith("> ")) quote.push(inline(line.slice(2)));
    else { flush(); out.push(inline(line) + "<br>"); }
  }
  flush();
  return out.join("");
}

let bubbleTimer = null;

function renderStyleControls() {
  $("styleChips").innerHTML = "";
  Object.entries(STYLES).forEach(([key, s]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(opts.style === key));
    b.textContent = [s.deco[0], s.label].filter(Boolean).join(" ");
    b.onclick = () => { applyStyle(key, false); cardCache.clear(); render(); save(); };
    $("styleChips").appendChild(b);
  });
  $("themeSwatches").innerHTML = "";
  Object.entries(THEMES).forEach(([key, t]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(opts.theme === key && !photo));
    b.setAttribute("aria-label", t.label);
    b.title = photo ? "Remove the photo to use a theme" : t.label;
    b.disabled = !!photo;
    b.style.background = `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[1]})`;
    b.onclick = () => { opts.theme = key; useCardMode(); cardCache.clear(); render(); save(); };
    $("themeSwatches").appendChild(b);
  });
  document.querySelectorAll('input[name="layout"]').forEach((r) => (r.checked = r.value === opts.layout));
  document.querySelectorAll('input[name="sendMode"]').forEach((r) => (r.checked = r.value === opts.sendMode));
  $("personalize").checked = opts.personalize;
  $("photoClear").hidden = !photo;
}

function render() {
  cardCache.clear();
  renderStyleControls();

  const tbody = $("guestRows");
  tbody.innerHTML = "";
  if (!guests.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty">No guests yet.</td></tr>`;
  }
  guests.forEach((g, i) => {
    const tr = document.createElement("tr");
    if (g.sent) tr.className = "sent";
    const nameTd = document.createElement("td");
    nameTd.textContent = g.name || "—";
    const phoneTd = document.createElement("td");
    if (g.phone) phoneTd.textContent = "+" + g.phone;
    else phoneTd.innerHTML = `<span class="bad">No valid number (${escapeHtml(g.raw || "empty")})</span>`;
    const act = document.createElement("td");
    act.className = "actions";
    if (g.sent) act.innerHTML = `<span class="badge">Sent</span> `;
    const send = document.createElement("button");
    send.className = "small" + (g.sent ? "" : " primary");
    send.textContent = g.sent ? "Resend" : "Send";
    send.disabled = !g.phone;
    send.onclick = () => sendTo(i);
    const del = document.createElement("button");
    del.className = "small";
    del.textContent = "Remove";
    del.setAttribute("aria-label", `Remove ${g.name || "guest"}`);
    del.onclick = () => { guests.splice(i, 1); render(); save(); };
    act.append(send, " ", del);
    tr.append(nameTd, phoneTd, act);
    tbody.appendChild(tr);
  });

  const first = guests.find((g) => !g.sent && g.phone) || guests[0] || { name: "Aisha" };
  $("previewName").textContent = first.name || "a guest";
  $("preview").innerHTML = waToHtml(buildMessage(first));

  // Card preview + WhatsApp bubble
  renderCard($("cardCanvas"), cardOptions(first));
  const cardMode = opts.sendMode === "card";
  $("linkCard").hidden = cardMode;
  $("bubbleCard").hidden = !cardMode;
  if (cardMode) {
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => {
      $("bubbleCard").src = $("cardCanvas").toDataURL("image/jpeg", 0.7);
      if (first.phone) getCardBlob(first); // prepare the next card so sharing opens on the first tap
    }, 200);
  }

  const valid = guests.filter((g) => g.phone).length;
  const sent = guests.filter((g) => g.sent).length;
  $("progress").textContent = guests.length ? `${sent} of ${valid} invites sent.` : "";
  $("baseWarn").hidden = !isLocalBase();
}

// ---------- Wire up ----------
load();
loadPhoto();
FIELDS.forEach((f) => $(f).addEventListener("input", () => { render(); save(); }));
$("cc").addEventListener("change", () => {
  guests.forEach((g) => (g.phone = normalizePhone(g.raw, $("cc").value)));
  render(); save();
});
document.querySelectorAll('input[name="layout"]').forEach((r) =>
  r.addEventListener("change", () => { opts.layout = r.value; render(); save(); })
);
document.querySelectorAll('input[name="sendMode"]').forEach((r) =>
  r.addEventListener("change", () => { opts.sendMode = r.value; render(); save(); })
);
$("personalize").addEventListener("change", (e) => { opts.personalize = e.target.checked; render(); save(); });
$("photoBtn").onclick = () => $("photoFile").click();
$("photoFile").onchange = (e) => { handlePhoto(e.target.files[0]); e.target.value = ""; };
$("photoClear").onclick = () => {
  photo = null;
  try { localStorage.removeItem(PHOTO_KEY); } catch (_) {}
  render();
};
$("dlCard").onclick = async () => {
  const g = guests.find((x) => !x.sent && x.phone) || guests[0];
  downloadBlob(await getCardBlob(g), cardFileName(g));
};
$("copyMsg").onclick = async () => {
  const g = guests.find((x) => !x.sent && x.phone) || guests[0];
  try {
    await navigator.clipboard.writeText(buildMessage(g));
    $("copyMsg").textContent = "Copied ✓";
    setTimeout(() => ($("copyMsg").textContent = "Copy message"), 1500);
  } catch (_) {
    alert("Couldn't copy. Select the preview text and copy it instead.");
  }
};

// Open the calendar / clock as soon as a date or time box is clicked.
document.querySelectorAll("input.picker").forEach((el) =>
  el.addEventListener("click", () => { try { el.showPicker(); } catch (_) {} })
);
// End date can't be before the start date, and defaults to the same day.
$("startDate").addEventListener("change", () => {
  $("endDate").min = $("startDate").value;
  if (!$("endDate").value || $("endDate").value < $("startDate").value) $("endDate").value = $("startDate").value;
  render(); save();
});
$("startDate").min = new Date().toISOString().slice(0, 10);
$("endDate").min = $("startDate").value || $("startDate").min;

$("pickContacts").onclick = pickContacts;
$("uploadBtn").onclick = () => $("file").click();
$("file").onchange = (e) => { handleFiles([...e.target.files]); e.target.value = ""; };
$("addBtn").onclick = () => {
  const name = $("addName").value, phone = $("addPhone").value;
  if (!phone.trim()) return;
  addGuests([{ name, phone }]);
  $("addName").value = $("addPhone").value = "";
  $("addName").focus();
};
$("addPhone").addEventListener("keydown", (e) => e.key === "Enter" && $("addBtn").click());
$("clearGuests").onclick = () => { if (confirm("Remove all guests from the list?")) { guests = []; render(); save(); } };
$("sendNext").onclick = sendNext;
$("resetSent").onclick = () => { guests.forEach((g) => (g.sent = false)); render(); save(); };
$("dlIcs").onclick = () => {
  const ev = currentEvent();
  if (!ev.t || !ev.s) return alert("Please add a title and start time first.");
  downloadIcs({ ...ev, b: personalize(ev.b, "") });
};
render();
ensureCardFonts().then(render);
