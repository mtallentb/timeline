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

const GREEN_EMOJI = "🟢";
const PERFECT_DAY_SCORE = MAX_POINTS_PER_ROUND * ROUNDS;

/**
 * Short canvas particle burst. Visual-only — does not touch scoring, share, or seed.
 * @param {{ big?: boolean }} [opts]
 */
function burstConfetti(opts = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const big = !!opts.big;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-layer";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const fit = () => {
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit();

  const count = big ? 90 : 42;
  const colors = ["#3dd68c", "#f5c542", "#5b9dff", "#ffffff", "#7bb0ff", "#ff8ec8"];
  const originX = window.innerWidth / 2;
  const originY = window.innerHeight * (big ? 0.32 : 0.36);
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI + Math.random() * Math.PI;
    const speed = (big ? 7 : 5) + Math.random() * (big ? 10 : 7);
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (big ? 5 : 3.5),
      w: 4 + Math.random() * 5,
      h: 3 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.45,
      color: colors[i % colors.length],
    });
  }

  const started = performance.now();
  const duration = big ? 1700 : 1150;

  function frame(now) {
    const elapsed = now - started;
    const life = Math.max(0, 1 - elapsed / duration);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of particles) {
      p.vy += 0.2;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = life;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
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

function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function tierFromEmoji(emoji) {
  if (emoji === "🟢") return "green";
  if (emoji === "🟡") return "yellow";
  return "red";
}

/** Local year window around guess/answer so pins sit inward, not on the rail edge. */
function rulerBounds(guess, truth) {
  const lo = Math.min(guess, truth);
  const hi = Math.max(guess, truth);
  const gap = hi - lo;
  const pad = Math.max(8, Math.round(gap * 0.28) + 4);
  const nice = gap + pad * 2 > 40 ? 10 : 5;
  let start = Math.floor((lo - pad) / nice) * nice;
  let end = Math.ceil((hi + pad) / nice) * nice;
  if (end <= start) end = start + nice;
  return { start, end };
}

function yearToPercent(year, start, end) {
  if (end === start) return 50;
  return ((year - start) / (end - start)) * 100;
}

function rulerTickStep(start, end) {
  const span = end - start;
  if (span <= 12) return 2;
  if (span <= 24) return 5;
  if (span <= 50) return 10;
  if (span <= 90) return 20;
  return 25;
}

function buildRulerTicks(start, end) {
  const step = rulerTickStep(start, end);
  let t = Math.ceil(start / step) * step;
  const ticks = [];
  for (; t <= end; t += step) {
    const pct = yearToPercent(t, start, end);
    ticks.push(
      `<span class="gap-tick" style="left:${pct}%"><i></i><em>${t}</em></span>`
    );
  }
  return ticks.join("");
}

function pinEdgeClass(pct) {
  if (pct < 16) return "edge-left";
  if (pct > 84) return "edge-right";
  return "";
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

let revealAnimId = 0;

function settleRevealTheater(result, els) {
  const { slider, yearEl, gapBar, deltaEl } = els;
  slider.value = String(result.truth);
  slider.classList.add("snapped");
  yearEl.textContent = result.truth;
  gapBar.style.transform = "scaleX(1)";
  if (result.delta === 0) {
    deltaEl.textContent = "Perfect!";
  } else if (result.delta === 1) {
    deltaEl.textContent = "Δ 1 year";
  } else {
    deltaEl.textContent = `Δ ${result.delta} years`;
  }
}

function playRevealTheater(result, els) {
  const token = ++revealAnimId;
  const { slider, yearEl, gapBar, deltaEl } = els;
  if (!slider || !yearEl || !gapBar || !deltaEl) return;
  const reduced = prefersReducedMotion();
  const snapMs = 900;
  const gapMs = 1050;
  const gapDelay = 70;

  if (reduced) {
    settleRevealTheater(result, els);
    return;
  }

  const snapFrom =
    result.guess === result.truth
      ? Math.max(YEAR_MIN, result.truth - 4)
      : result.guess;
  const snapStart = performance.now();

  function snapFrame(now) {
    if (token !== revealAnimId) return;
    const t = Math.min(1, (now - snapStart) / snapMs);
    const raw = snapFrom + (result.truth - snapFrom) * easeOutBack(t);
    const year = Math.round(Math.min(YEAR_MAX, Math.max(YEAR_MIN, raw)));
    slider.value = String(year);
    yearEl.textContent = year;
    if (t < 1) requestAnimationFrame(snapFrame);
    else {
      slider.value = String(result.truth);
      yearEl.textContent = result.truth;
      slider.classList.add("snapped");
    }
  }

  const gapStartAt = snapStart + gapDelay;
  function gapFrame(now) {
    if (token !== revealAnimId) return;
    if (now < gapStartAt) {
      requestAnimationFrame(gapFrame);
      return;
    }
    const t = Math.min(1, (now - gapStartAt) / gapMs);
    const e = easeOutCubic(t);
    gapBar.style.transform = `scaleX(${e})`;
    if (result.delta === 0) {
      deltaEl.textContent = "Perfect!";
    } else {
      const n = Math.round(result.delta * e);
      deltaEl.textContent = n === 1 ? "Δ 1 year" : `Δ ${n} years`;
    }
    if (t < 1) requestAnimationFrame(gapFrame);
  }

  requestAnimationFrame(snapFrame);
  requestAnimationFrame(gapFrame);
}

function renderReveal(result) {
  state.revealing = true;
  const ev = state.puzzle[state.round];
  const tier = tierFromEmoji(result.emoji);
  const bounds = rulerBounds(result.guess, result.truth);
  const guessPct = yearToPercent(result.guess, bounds.start, bounds.end);
  const truthPct = yearToPercent(result.truth, bounds.start, bounds.end);
  const leftPct = Math.min(guessPct, truthPct);
  const widthPct = Math.abs(guessPct - truthPct);
  const growFromGuess = result.guess <= result.truth;
  const sameYear = result.delta === 0;
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
        <p class="reveal-year" id="reveal-year">${result.guess}</p>
        <p class="reveal-clue">${escapeHtml(ev.clue)}</p>
        <p class="sr-only">${escapeHtml(`You guessed ${result.guess}. Answer ${result.truth}. ${deltaLabel}.`)}</p>
        <div class="slider-wrap reveal-slider-wrap">
          <input type="range" id="reveal-slider" min="${YEAR_MIN}" max="${YEAR_MAX}" value="${result.guess}" step="1" disabled aria-label="Answer year" />
          <div class="slider-labels"><span>${YEAR_MIN}</span><span>${YEAR_MAX}</span></div>
        </div>
        <div class="gap-fly tier-${tier}" id="gap-fly">
          <div class="gap-fly-ruler">
            <div class="gap-fly-strip"></div>
            <div class="gap-fly-ticks">${buildRulerTicks(bounds.start, bounds.end)}</div>
            <div class="gap-fly-bar" id="gap-bar" style="left:${leftPct}%;width:${Math.max(widthPct, 0)}%;transform-origin:${growFromGuess ? "left" : "right"} center;transform:scaleX(0)"></div>
            <div class="gap-fly-pin guess ${pinEdgeClass(guessPct)}" style="left:${guessPct}%" id="pin-guess">
              <div class="pin-meta">
                <span class="pin-label">Your guess</span>
                <span class="pin-year">${result.guess}</span>
              </div>
              <span class="pin-head"></span>
            </div>
            <div class="gap-fly-pin answer ${pinEdgeClass(truthPct)}${sameYear ? " same-year" : ""}" style="left:${truthPct}%" id="pin-answer">
              <span class="pin-head"></span>
              <div class="pin-meta">
                <span class="pin-label">Answer</span>
                <span class="pin-year">${result.truth}</span>
              </div>
            </div>
          </div>
          <p class="gap-fly-delta" id="gap-delta">Δ 0 years</p>
        </div>
        <p class="reveal-points">+${result.points} points</p>
        <button class="btn btn-primary" id="btn-next">
          ${state.round + 1 >= ROUNDS ? "See results" : "Next round"}
        </button>
      </div>
    </div>
  `;

  document.getElementById("btn-next").addEventListener("click", () => {
    revealAnimId += 1;
    state.revealing = false;
    state.round += 1;
    state.currentGuess = 1980;
    if (state.round >= ROUNDS) {
      finishGame();
    } else {
      renderPlay();
    }
  });

  playRevealTheater(result, {
    slider: document.getElementById("reveal-slider"),
    yearEl: document.getElementById("reveal-year"),
    gapBar: document.getElementById("gap-bar"),
    deltaEl: document.getElementById("gap-delta"),
  });

  if (result.emoji === GREEN_EMOJI) {
    requestAnimationFrame(() => burstConfetti());
  }
}

function finishGame() {
  state.finished = true;
  const store = loadStorage();
  const streak = updateStreakOnFinish(store, state.dateKey, state.total);
  streakLabel.textContent = `🔥 ${streak}`;
  renderEnd(streak);
  if (state.total === PERFECT_DAY_SCORE) {
    requestAnimationFrame(() => burstConfetti({ big: true }));
  }
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
