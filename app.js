// Organizer page logic.
const $ = (id) => document.getElementById(id);
const FIELDS = ["title", "body", "start", "end", "location", "map", "hostName", "hostPhone", "cc", "baseUrl"];
const STORE_KEY = "wa-invites-v1";

let guests = []; // { name, raw, phone, sent }

// ---------- Persistence (per-browser convenience only) ----------
function save() {
  try {
    const data = { guests };
    FIELDS.forEach((f) => (data[f] = $(f).value));
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch (_) {}
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (!data) return;
    FIELDS.forEach((f) => {
      if (typeof data[f] === "string") $(f).value = data[f];
    });
    guests = Array.isArray(data.guests) ? data.guests : [];
  } catch (_) {}
}

// ---------- Event ----------
function currentEvent() {
  const toIso = (v) => (v ? new Date(v).toISOString() : "");
  return {
    t: $("title").value.trim(),
    b: $("body").value.trim(),
    s: toIso($("start").value),
    e: toIso($("end").value),
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

function inviteUrl(ev, guestName) {
  const payload = { ...ev, b: personalize(ev.b, guestName) };
  const g = guestName ? `&g=${encodeURIComponent(guestName)}` : "";
  return `${baseUrl()}invite.html#e=${encodeEvent(payload)}${g}`;
}

function personalize(text, name) {
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  return (text || "").replace(/\{name\}/gi, first);
}

function buildMessage(guest) {
  const ev = currentEvent();
  const name = guest ? guest.name : "";
  const lines = [];
  if (ev.t) lines.push(`*${ev.t}*`, "");
  if (ev.b) lines.push(personalize(ev.b, name), "");
  if (ev.s) lines.push(`🗓️ *When:* ${formatWhen(ev.s, ev.e)}`);
  if (ev.l) lines.push(`📍 *Where:* ${ev.l}`);
  const map = mapUrl(ev);
  if (map) lines.push(`🗺️ *Map:* ${map}`);
  if (ev.s) lines.push(`📅 *Add to Google Calendar:* ${googleCalendarUrl({ ...ev, b: personalize(ev.b, name) })}`);
  lines.push("");
  lines.push(`✅ *RSVP & add to Apple/Outlook calendar:* ${inviteUrl(ev, name)}`);
  if (ev.h) lines.push(`Or just reply *YES*, *NO* or *MAYBE* to this message.`);
  if (ev.n) lines.push("", `— ${ev.n}`);
  return lines.join("\n");
}

function validate() {
  const ev = currentEvent();
  const problems = [];
  if (!ev.t) problems.push("a title");
  if (!ev.s) problems.push("a start time");
  if (!ev.h) problems.push("your WhatsApp number");
  return problems;
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
function sendTo(i) {
  const problems = validate();
  if (problems.length) {
    alert(`Please add ${problems.join(", ")} first.`);
    return;
  }
  const g = guests[i];
  if (!g || !g.phone) return;
  window.open(waLink(g.phone, buildMessage(g)), "_blank", "noopener");
  g.sent = true;
  render();
  save();
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
function render() {
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

  const first = guests.find((g) => !g.sent && g.phone) || guests[0];
  $("previewName").textContent = first && first.name ? first.name : "a guest";
  $("preview").textContent = buildMessage(first || { name: "" });

  const valid = guests.filter((g) => g.phone).length;
  const sent = guests.filter((g) => g.sent).length;
  $("progress").textContent = guests.length ? `${sent} of ${valid} invites sent.` : "";
  $("baseWarn").hidden = !isLocalBase();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Wire up ----------
load();
FIELDS.forEach((f) => $(f).addEventListener("input", () => { render(); save(); }));
$("cc").addEventListener("change", () => {
  guests.forEach((g) => (g.phone = normalizePhone(g.raw, $("cc").value)));
  render(); save();
});
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
