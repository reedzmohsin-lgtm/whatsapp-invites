// Shared helpers used by both the organizer page (index.html) and the guest page (invite.html).

// ---------- Event <-> URL encoding (base64url of UTF-8 JSON) ----------
function encodeEvent(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeEvent(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// ---------- Dates ----------
function toUtcStamp(date) {
  // 20261120T103000Z
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatWhen(startIso, endIso) {
  const s = new Date(startIso);
  const e = endIso ? new Date(endIso) : null;
  const day = s.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const t = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (!e) return `${day}, ${t(s)}`;
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${day}, ${t(s)} – ${t(e)}`
    : `${day}, ${t(s)} – ${e.toLocaleDateString(undefined, { day: "numeric", month: "long" })} ${t(e)}`;
}

// Short date line + time line, e.g. { date: "Sat, 5 Dec 2026", time: "12:00 PM – 4:00 PM" }.
function formatParts(startIso, endIso) {
  const s = new Date(startIso);
  const e = endIso ? new Date(endIso) : null;
  const d = (x, year = true) =>
    x.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
  const t = (x) => x.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (!e) return { date: d(s), time: t(s) };
  if (s.toDateString() === e.toDateString()) return { date: d(s), time: `${t(s)} – ${t(e)}` };
  return { date: `${d(s, false)} – ${d(e)}`, time: `${t(s)} – ${t(e)}` };
}

// ---------- Map ----------
function mapUrl(ev) {
  if (ev.m && /^https?:\/\//i.test(ev.m)) return ev.m;
  const q = ev.m || ev.l;
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : "";
}

// ---------- Calendar ----------
function icsEscape(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsFold(line) {
  // RFC 5545: lines should be at most 75 octets; continuation lines start with a space.
  const out = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (curBytes + n > 74) {
      out.push(cur);
      cur = " ";
      curBytes = 1;
    }
    cur += ch;
    curBytes += n;
  }
  out.push(cur);
  return out.join("\r\n");
}

function buildIcs(ev) {
  const start = new Date(ev.s);
  const end = ev.e ? new Date(ev.e) : new Date(start.getTime() + 2 * 3600 * 1000);
  const map = mapUrl(ev);
  const desc = [ev.b, map ? `Map: ${map}` : ""].filter(Boolean).join("\n\n");
  const uid = `${toUtcStamp(start)}-${encodeEvent({ t: ev.t }).slice(0, 16)}@whatsapp-invites`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WhatsApp Invites//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${icsEscape(ev.t)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
    ev.l ? `LOCATION:${icsEscape(ev.l)}` : "",
    map ? `URL:${map}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(ev.t)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

function downloadIcs(ev) {
  const blob = new Blob([buildIcs(ev)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (ev.t || "event").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") + ".ics";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

function googleCalendarUrl(ev) {
  const start = new Date(ev.s);
  const end = ev.e ? new Date(ev.e) : new Date(start.getTime() + 2 * 3600 * 1000);
  const map = mapUrl(ev);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.t || "",
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
    details: [ev.b, map ? `Map: ${map}` : ""].filter(Boolean).join("\n\n"),
    location: ev.l || "",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

// ---------- WhatsApp ----------
function waLink(phoneDigits, text) {
  // api.whatsapp.com/send keeps emojis intact; wa.me links can garble them (shown as �) in the desktop app.
  return `https://api.whatsapp.com/send?phone=${phoneDigits}&text=${encodeURIComponent(text)}`;
}

function rsvpLink(ev, answer, guestName) {
  const who = guestName ? ` – ${guestName}` : "";
  return waLink(ev.h, `RSVP: ${answer} for "${ev.t}"${who}`);
}

// Normalise a phone number to the digits-only international form that wa.me expects.
function normalizePhone(raw, defaultCountryCode) {
  if (!raw) return "";
  let s = String(raw).trim();
  const plus = s.startsWith("+");
  let d = s.replace(/\D/g, "");
  if (!d) return "";
  if (plus) return d;
  if (d.startsWith("00")) return d.slice(2);
  const cc = String(defaultCountryCode || "").replace(/\D/g, "");
  if (d.startsWith("0") && cc) return cc + d.replace(/^0+/, "");
  return d;
}
