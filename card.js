// Draws an invitation card on a <canvas>. Used for the card preview, card sharing and the link-preview image.

const SERIF = '"Playfair Display", Georgia, "Times New Roman", serif';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

async function ensureCardFonts() {
  try {
    await Promise.all([
      document.fonts.load(`700 80px "Playfair Display"`),
      document.fonts.load(`italic 400 40px "Playfair Display"`),
    ]);
  } catch (_) {}
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width <= maxWidth || !cur) cur = test;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = last.trimEnd() + "…";
    return kept;
  }
  return lines;
}

// Pick the largest font size (down to min) that fits the text in maxLines.
function fitText(ctx, text, font, start, min, maxWidth, maxLines) {
  let size = start;
  for (; size > min; size -= 4) {
    ctx.font = font(size);
    if (wrapLines(ctx, text, maxWidth, 99).length <= maxLines) break;
  }
  ctx.font = font(size);
  return { size, lines: wrapLines(ctx, text, maxWidth, maxLines) };
}

function drawBackground(ctx, W, H, theme, photo) {
  if (photo) {
    const r = Math.max(W / photo.width, H / photo.height);
    const w = photo.width * r, h = photo.height * r;
    ctx.drawImage(photo, (W - w) / 2, (H - h) / 2, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(0,0,0,.35)");
    g.addColorStop(0.5, "rgba(0,0,0,.55)");
    g.addColorStop(1, "rgba(0,0,0,.7)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, theme.bg[0]);
    g.addColorStop(1, theme.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Soft decorative circles.
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = theme.accent;
    ctx.beginPath(); ctx.arc(W * 0.92, H * 0.08, W * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.05, H * 0.95, W * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawFrame(ctx, W, H, color) {
  const m = Math.round(W * 0.04);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = Math.max(2, W * 0.003);
  ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
  ctx.globalAlpha = 0.35;
  ctx.strokeRect(m + 12, m + 12, W - 2 * m - 24, H - 2 * m - 24);
  ctx.globalAlpha = 1;
}

function drawDivider(ctx, cx, y, w, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx - 14, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 14, y); ctx.lineTo(cx + w / 2, y); ctx.stroke();
  ctx.save();
  ctx.translate(cx, y); ctx.rotate(Math.PI / 4);
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
}

function spaced(ctx, text, cx, y, spacing) {
  // Letter-spaced, centred text.
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = "left";
  chars.forEach((c, i) => { ctx.fillText(c, x, y); x += widths[i] + spacing; });
  ctx.textAlign = "center";
}

// opts: { ev, guestName, themeKey, photo, personalize, deco }
function renderCard(canvas, opts) {
  const W = 1080, H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const theme = THEMES[opts.themeKey] || THEMES.emerald;
  const photo = opts.photo || null;
  const ink = photo ? "#ffffff" : theme.ink;
  const sub = photo ? "rgba(255,255,255,.85)" : theme.sub;
  const accent = photo ? "#f3d98c" : theme.accent;
  const ev = opts.ev;
  const cx = W / 2, maxW = W - 220;

  drawBackground(ctx, W, H, theme, photo);
  drawFrame(ctx, W, H, accent);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  let y = 230;
  const [d1, d2] = opts.deco || ["", ""];
  if (d1 || d2) {
    ctx.font = `64px ${SANS}`;
    ctx.fillText([d1, d2].filter(Boolean).join("   "), cx, y - 60);
    y += 30;
  }

  ctx.fillStyle = accent;
  ctx.font = `600 30px ${SANS}`;
  spaced(ctx, "YOU'RE INVITED", cx, y, 9);
  y += 80;

  if (opts.personalize && opts.guestName) {
    ctx.fillStyle = sub;
    ctx.font = `italic 400 44px ${SERIF}`;
    ctx.fillText(`Dear ${opts.guestName.split(/\s+/)[0]},`, cx, y);
    y += 60;
  }

  ctx.fillStyle = ink;
  const title = fitText(ctx, ev.t || "Your Event", (s) => `700 ${s}px ${SERIF}`, 104, 56, maxW, 3);
  y += title.size * 0.5;
  title.lines.forEach((line) => { ctx.fillText(line, cx, y + title.size * 0.35); y += title.size * 1.12; });
  y += 30;

  drawDivider(ctx, cx, y, 360, accent);
  y += 100;

  const parts = ev.s ? formatParts(ev.s, ev.e, ev.f) : { date: "Date to be confirmed", time: "" };
  ctx.fillStyle = ink;
  ctx.font = `600 50px ${SANS}`;
  wrapLines(ctx, parts.date, maxW, 2).forEach((l) => { ctx.fillText(l, cx, y); y += 64; });
  if (parts.time) {
    ctx.fillStyle = sub;
    ctx.font = `400 44px ${SANS}`;
    ctx.fillText(parts.time, cx, y);
    y += 64;
  }
  if (ev.l) {
    y += 26;
    ctx.fillStyle = accent;
    ctx.font = `600 26px ${SANS}`;
    spaced(ctx, "VENUE", cx, y, 6);
    y += 56;
    ctx.fillStyle = ink;
    ctx.font = `400 40px ${SANS}`;
    wrapLines(ctx, ev.l, maxW, 3).forEach((l) => { ctx.fillText(l, cx, y); y += 52; });
  }

  // Footer
  ctx.fillStyle = sub;
  ctx.font = `italic 400 36px ${SERIF}`;
  if (ev.n) ctx.fillText(`Hosted by ${ev.n}`, cx, H - 180);
  ctx.fillStyle = accent;
  ctx.font = `500 26px ${SANS}`;
  ctx.fillText("Tap the link in the message to RSVP", cx, H - 120);
}

// Generic landscape image used as the WhatsApp link preview (og:image).
function renderPreviewImage(canvas, themeKey) {
  const W = 1200, H = 630;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const theme = THEMES[themeKey] || THEMES.emerald;
  drawBackground(ctx, W, H, theme, null);
  drawFrame(ctx, W, H, theme.accent);
  ctx.textAlign = "center";
  ctx.fillStyle = theme.accent;
  ctx.font = `600 30px ${SANS}`;
  spaced(ctx, "AN INVITATION FOR YOU", W / 2, 200, 9);
  ctx.fillStyle = theme.ink;
  ctx.font = `700 110px ${SERIF}`;
  ctx.fillText("You're Invited", W / 2, 340);
  drawDivider(ctx, W / 2, 400, 320, theme.accent);
  ctx.fillStyle = theme.sub;
  ctx.font = `400 36px ${SANS}`;
  ctx.fillText("Event details · Add to calendar · RSVP", W / 2, 480);
}

function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((res) => canvas.toBlob(res, type, quality));
}
