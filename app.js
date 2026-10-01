/**
 * Timeline — daily year-guessing game
 * Deterministic puzzle from America/Chicago date key.
 */

const YEAR_MIN = 1900;
const YEAR_MAX = 2026;
const MAX_YEARS = YEAR_MAX - YEAR_MIN; // 126
const ROUNDS = 5;
const MAX_POINTS_PER_ROUND = 200;
const SITE_URL = "https://timeline-production-5838.up.railway.app/";
const STORAGE_KEY = "timeline_v1";

const main = document.getElementById("main");
const dateLabel = document.getElementById("date-label");
const streakLabel = document.getElementById("streak-label");
const toastEl = document.getElementById("toast");

/** @type {{ events: Array, dateKey: string, puzzle: Array, round: number, guesses: Array, total: number, finished: boolean }} */
let state = null;

// ——— Date / Chicago calendar day ————————————————————————————————

function chicagoDateKey(d = new Date()) {
  // en-CA gives YYYY-MM-DD; America/Chicago for the daily shared seed
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatDisplayDate(dateKey) {
  // dateKey = YYYY-MM-DD → MM/DD
  const [, m, day] = dateKey.split("-");
  return `${m}/${day}`;
}

function formatShareDate(dateKey) {
  return formatDisplayDate(dateKey);
}

// ——— Deterministic RNG from date string ——————————————————————————

function hashString(str) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickDailyEvents(events, dateKey, count = ROUNDS) {
  const rng = mulberry32(hashString(`timeline:${dateKey}`));
  const pool = events.slice();
  // Fisher–Yates partial shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Prefer unique years when possible
  const picked = [];
  const usedYears = new Set();
  for (const ev of pool) {
    if (picked.length >= count) break;
    if (usedYears.has(ev.year) && picked.length + (pool.length - pool.indexOf(ev) - 1) >= count) {
      // skip duplicate year if we still have room later — soft preference
      continue;
    }
    picked.push(ev);
    usedYears.add(ev.year);
  }
  // Fallback fill if preference left us short
  if (picked.length < count) {
    for (const ev of pool) {
      if (picked.length >= count) break;
      if (!picked.includes(ev)) picked.push(ev);
    }
  }
  return picked.slice(0, count);
}

// ——— Scoring ——————————————————————————————————————————————————————

function scoreGuess(guess, truth) {
  const delta = Math.abs(guess - truth);
  const points = Math.max(0, Math.round(MAX_POINTS_PER_ROUND * (1 - delta / MAX_YEARS)));
  let emoji;
  if (delta <= 2) emoji = "🟢";
  else if (delta <= 10) emoji = "🟡";
  else emoji = "🔴";
  return { points, delta, emoji, guess, truth };
}

// ——— Persistence ——————————————————————————————————————————————————

function loadStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveStorage(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getStreak(store, dateKey) {
  return store.streak || 0;
}

function updateStreakOnFinish(store, dateKey, total) {
  const yesterday = (() => {
    // Compute previous Chicago calendar day from dateKey
    const [y, m, d] = dateKey.split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d));
    utc.setUTCDate(utc.getUTCDate() - 1);
    return utc.toISOString().slice(0, 10);
  })();

  let streak = store.streak || 0;
  if (store.lastPlayed === dateKey) {
    // already counted
  } else if (store.lastPlayed === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }

  store.streak = streak;
  store.lastPlayed = dateKey;
  store.results = store.results || {};
  store.results[dateKey] = {
    total,
    emojis: state.guesses.map((g) => g.emoji).join(""),
    guesses: state.guesses.map((g) => ({
      guess: g.guess,
      truth: g.truth,
      delta: g.delta,
      points: g.points,
      emoji: g.emoji,
      clue: g.clue,
    })),
  };
  saveStorage(store);
  return streak;
}

// ——— Share text ————————————————————————————————————————————————————

function buildShareText(dateKey, guesses, total, streak) {
  const emojis = guesses.map((g) => g.emoji).join("");
  const dateStr = formatShareDate(dateKey);
  let text = `Timeline ${dateStr}  ${emojis}  ${total}/1000`;
  if (streak > 0) text += `\n🔥 Streak: ${streak}`;
  text += `\n${SITE_URL}`;
  return text;
}

async function copyShare(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
  } catch {
    // Fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast("Copied to clipboard!");
    } catch {
      showToast("Copy failed — select the text manually");
    }
    document.body.removeChild(ta);
  }
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.hidden = true;
  }, 2000);
}

// ——— UI ————————————————————————————————————————————————————————————

function renderRoundDots() {
  const dots = [];
  for (let i = 0; i < ROUNDS; i++) {
    let cls = "dot";
    if (i < state.guesses.length) {
      const e = state.guesses[i].emoji;
      if (e === "🟢") cls += " done-green";
      else if (e === "🟡") cls += " done-yellow";
      else cls += " done-red";
    } else if (i === state.round && !state.finished && !state.revealing) {
      cls += " current";
    }
    dots.push(`<span class="${cls}"></span>`);
  }
  return `<div class="round-dots">${dots.join("")}</div>`;
}

function renderPlay() {
  const ev = state.puzzle[state.round];
  const guess = state.currentGuess ?? 1980;

  main.innerHTML = `
    <div class="card">
      <div class="round-bar">
        <span>Round ${state.round + 1} of ${ROUNDS}</span>
        ${renderRoundDots()}
        <span>${state.total} pts</span>
      </div>
      <p class="clue">${escapeHtml(ev.clue)}</p>
      <div class="year-display" id="year-display">${guess}</div>
      <div class="slider-wrap">
        <input type="range" id="year-slider" min="${YEAR_MIN}" max="${YEAR_MAX}" value="${guess}" step="1" aria-label="Guess year" />
        <div class="slider-labels"><span>${YEAR_MIN}</span><span>${YEAR_MAX}</span></div>
      </div>
      <button class="btn btn-primary" id="btn-guess">Lock in year</button>
    </div>
  `;

  const slider = document.getElementById("year-slider");
  const display = document.getElementById("year-display");
  slider.addEventListener("input", () => {
    state.currentGuess = Number(slider.value);
    display.textContent = state.currentGuess;
  });
  document.getElementById("btn-guess").addEventListener("click", () => {
    submitGuess(Number(slider.value));
  });
}

function renderReveal(result) {
  state.revealing = true;
  const deltaLabel =
    result.delta === 0
      ? "Perfect!"
      : result.delta === 1
        ? "Off by 1 year"
        : `Off by ${result.delta} years`;

  main.innerHTML = `
    <div class="card">
      <div class="round-bar">
        <span>Round ${state.round + 1} of ${ROUNDS}</span>
        ${renderRoundDots()}
        <span>${state.total} pts</span>
      </div>
      <div class="reveal">
        <div class="reveal-emoji">${result.emoji}</div>
        <p class="reveal-year">${result.truth}</p>
        <p class="reveal-delta">You guessed ${result.guess} · ${deltaLabel}</p>
        <p class="reveal-points">+${result.points} points</p>
        <button class="btn btn-primary" id="btn-next">
          ${state.round + 1 >= ROUNDS ? "See results" : "Next round"}
        </button>
      </div>
    </div>
  `;

  document.getElementById("btn-next").addEventListener("click", () => {
    state.revealing = false;
    state.round += 1;
    state.currentGuess = 1980;
    if (state.round >= ROUNDS) {
      finishGame();
    } else {
      renderPlay();
    }
  });
}

function finishGame() {
  state.finished = true;
  const store = loadStorage();
  const streak = updateStreakOnFinish(store, state.dateKey, state.total);
  streakLabel.textContent = `🔥 ${streak}`;
  renderEnd(streak);
}

function renderEnd(streak) {
  const share = buildShareText(state.dateKey, state.guesses, state.total, streak);
  const summary = state.guesses
    .map(
      (g, i) => `
      <li>
        <span class="emoji">${g.emoji}</span>
        <span class="detail">
          <strong>${g.truth}</strong> · guessed ${g.guess} (${g.delta === 0 ? "exact" : `±${g.delta}`}) · +${g.points}
          <br/><span style="opacity:0.7">${escapeHtml(truncate(g.clue, 72))}</span>
        </span>
      </li>`
    )
    .join("");

  main.innerHTML = `
    <div class="card end-screen">
      <h2>Today's Timeline</h2>
      <p class="already-played">${formatDisplayDate(state.dateKey)} · America/Chicago</p>
      <div class="emojis">${state.guesses.map((g) => g.emoji).join("")}</div>
      <div class="score-big">${state.total}<span>/1000</span></div>
      <p style="color:var(--muted);margin:0 0 1rem">🔥 Streak: ${streak}</p>
      <pre class="share-preview" id="share-preview">${escapeHtml(share)}</pre>
      <button class="btn btn-primary" id="btn-share">Copy share card</button>
      <ul class="round-summary">${summary}</ul>
    </div>
  `;

  document.getElementById("btn-share").addEventListener("click", () => copyShare(share));
}

function submitGuess(guess) {
  const ev = state.puzzle[state.round];
  const result = scoreGuess(guess, ev.year);
  result.clue = ev.clue;
  state.guesses.push(result);
  state.total += result.points;
  renderReveal(result);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

// ——— Boot ——————————————————————————————————————————————————————————

async function boot() {
  const dateKey = chicagoDateKey();
  dateLabel.textContent = formatDisplayDate(dateKey);

  const store = loadStorage();
  streakLabel.textContent = store.streak ? `🔥 ${store.streak}` : "🔥 0";

  let events;
  try {
    const res = await fetch("events.json");
    if (!res.ok) throw new Error("Failed to load events");
    events = await res.json();
  } catch (err) {
    main.innerHTML = `<div class="card error-box"><p>Could not load events.json.</p><p style="font-size:0.85rem">${escapeHtml(err.message)}</p><p style="font-size:0.85rem;margin-top:1rem">Serve this folder over HTTP (e.g. <code>python -m http.server</code>) — file:// may block fetch.</p></div>`;
    return;
  }

  const puzzle = pickDailyEvents(events, dateKey, ROUNDS);

  // Resume finished day from storage
  if (store.results && store.results[dateKey]) {
    const saved = store.results[dateKey];
    state = {
      events,
      dateKey,
      puzzle,
      round: ROUNDS,
      guesses: saved.guesses,
      total: saved.total,
      finished: true,
      revealing: false,
      currentGuess: 1980,
    };
    renderEnd(getStreak(store, dateKey));
    return;
  }

  state = {
    events,
    dateKey,
    puzzle,
    round: 0,
    guesses: [],
    total: 0,
    finished: false,
    revealing: false,
    currentGuess: 1980,
  };

  renderPlay();
}

boot();
