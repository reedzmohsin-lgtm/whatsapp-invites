// Message styles (wording + emojis) and card themes.

const STYLES = {
  classic: {
    label: "Classic",
    deco: ["", ""],
    greeting: "Hi {name},",
    body: "You're invited! It would be lovely to see you there.",
    closing: "Hope to see you!",
    theme: "emerald",
  },
  formal: {
    label: "Formal",
    deco: ["", ""],
    greeting: "Dear {name},",
    body: "You are cordially invited to join us. We would be honoured by your presence.",
    closing: "We look forward to welcoming you.",
    theme: "midnight",
  },
  casual: {
    label: "Casual",
    deco: ["👋", ""],
    greeting: "Hey {name}! 🙌",
    body: "We're getting together and it just won't be the same without you!",
    closing: "Hope you can make it! 😄",
    theme: "emerald",
  },
  festive: {
    label: "Festive",
    deco: ["✨", "✨"],
    greeting: "Hi {name}! 🎊",
    body: "Join us for a celebration filled with good food, laughter and great company!",
    closing: "Let's celebrate together! 🥳",
    theme: "sunshine",
  },
  wedding: {
    label: "Wedding",
    deco: ["💍", "💍"],
    greeting: "Dear {name},",
    body: "With joy in our hearts, we invite you to celebrate our special day with us.",
    closing: "Your presence would mean the world to us. 🤍",
    theme: "blush",
  },
  birthday: {
    label: "Birthday",
    deco: ["🎂", "🎈"],
    greeting: "Hi {name}! 🎈",
    body: "Come celebrate a birthday with cake, laughs and good company!",
    closing: "Can't wait to party with you! 🎉",
    theme: "sunshine",
  },
};

// Card themes: background gradient, text colours and ornament colour.
const THEMES = {
  emerald: { label: "Emerald", bg: ["#0f3d2e", "#1f6b4f"], ink: "#fdf8ec", sub: "#cfe6d9", accent: "#e2c275" },
  midnight: { label: "Midnight", bg: ["#0d1530", "#26335e"], ink: "#f6f1e3", sub: "#c2c9e0", accent: "#d8b768" },
  blush: { label: "Blush", bg: ["#fbefe9", "#f2d4cf"], ink: "#5a2a35", sub: "#8a5560", accent: "#c08a5b" },
  sunshine: { label: "Sunshine", bg: ["#ffb347", "#ff6f61"], ink: "#ffffff", sub: "#fff1e0", accent: "#fff6c9" },
  minimal: { label: "Minimal", bg: ["#ffffff", "#f1f1ee"], ink: "#1a1a1a", sub: "#555555", accent: "#1a1a1a" },
};

// Wordings that count as "untouched", so switching style can replace them without asking.
function isStockText(field, value) {
  const v = (value || "").trim();
  if (!v) return true;
  if (field === "body" && v === "Hi {name}, you're invited! It would be lovely to see you there.") return true;
  return Object.values(STYLES).some((s) => s[field] === v);
}
