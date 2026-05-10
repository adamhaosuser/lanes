/* =========================================================
   SDK Roadmap — app logic
   State, render, drag/resize, popover, KR rail, filters,
   import/export, edit modal, tweaks bridge.
   ========================================================= */

const STORAGE_KEY = "sdk-roadmap-v2";
const SPRINTS_PER_QUARTER = 6;
const TOTAL_SPRINTS = 24;

/* ---------- built-in fallbacks (used if data.js is absent) ---------- */
const FALLBACK_META = {
  title: "Roadmap",
  fy: "",
  eyebrow: "",
  owner: "",
  status: "",
  lastReviewed: "",
  show: { title: true, fy: true, owner: true, status: true, lastReviewed: true, stageNames: true }
};
const FALLBACK_DATA = {
  meta: FALLBACK_META,
  quarters: ["Q1", "Q2", "Q3", "Q4"],
  features: []
};
if (!window.DEFAULT_META) window.DEFAULT_META = FALLBACK_META;
if (!window.DEFAULT_DATA) window.DEFAULT_DATA = FALLBACK_DATA;

let state = loadState();
let filter = { quarters: new Set(), krs: new Set() };

/* ---------- persistence ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.quarters && parsed.features) {
        // forward-migrate older saves without meta
        parsed.meta = mergeMeta(parsed.meta);
        return parsed;
      }
    }
  } catch {}
  return structuredClone(window.DEFAULT_DATA);
}
function mergeMeta(m) {
  const base = structuredClone(window.DEFAULT_META || FALLBACK_META);
  if (!m || typeof m !== "object") return base;
  const out = { ...base, ...m };
  out.show = { ...base.show, ...(m.show || {}) };
  return out;
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function quarterOfStart(s) { return Math.min(3, Math.floor(s / SPRINTS_PER_QUARTER)); }

/* ---------- helpers ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function krCode(kr) {
  if (!kr) return "";
  const m = String(kr).match(/^(KR\d+(?:\s*\+\s*KR\d+)*)/i);
  return m ? m[1].replace(/\s+/g, "") : (kr.length > 24 ? kr.slice(0, 22) + "…" : kr);
}
function uniqueKRs() {
  const map = new Map();
  for (const f of state.features) {
    const code = krCode(f.kr);
    if (!code) continue;
    // split combined "KR1 + KR4" into separate KRs
    const codes = code.split(/\+/).map(s => s.trim()).filter(Boolean);
    for (const c of codes) {
      if (!map.has(c)) map.set(c, { code: c, label: c, count: 0, examples: [] });
      const entry = map.get(c);
      entry.count++;
      if (entry.examples.length < 4) entry.examples.push(f.title);
      // capture longest descriptive form (e.g., "KR1 — Activation: …")
      const long = String(f.kr || "").trim();
      if (long.length > entry.label.length && long.startsWith(c)) entry.label = long;
    }
  }
  return [...map.values()].sort((a, b) => {
    const an = parseInt(a.code.replace(/[^\d]/g, ""), 10) || 99;
    const bn = parseInt(b.code.replace(/[^\d]/g, ""), 10) || 99;
    return an - bn;
  });
}

function featureMatchesFilter(f) {
  if (filter.quarters.size > 0 && !filter.quarters.has(f.q)) return false;
  if (filter.krs.size > 0) {
    const codes = krCode(f.kr).split(/\+/).map(s => s.trim());
    const anyMatch = codes.some(c => filter.krs.has(c));
    if (!anyMatch) return false;
  }
  return true;
}

/* ---------- render: header pieces ---------- */
function renderMasthead() {
  const m = state.meta;
  const show = m.show || {};
  const wrap = document.getElementById("masthead-left");
  const eyebrowText = [m.eyebrow, show.fy ? m.fy : null].filter(Boolean).join(" · ");
  const metaBits = [];
  if (show.owner && m.owner) metaBits.push(`<span><b>Owner</b> ${escapeHtml(m.owner)}</span>`);
  if (show.status && m.status) metaBits.push(`<span><b>Status</b> ${escapeHtml(m.status)}</span>`);
  if (show.lastReviewed && m.lastReviewed) metaBits.push(`<span><b>Last reviewed</b> ${escapeHtml(m.lastReviewed)}</span>`);

  let html = "";
  if (eyebrowText) html += `<p class="eyebrow">${escapeHtml(eyebrowText)}</p>`;
  if (show.title && m.title) {
    // wrap last word in <em> for the editorial accent — match prior look
    const parts = m.title.split(" ");
    const last = parts.pop();
    const head = parts.join(" ");
    html += `<h1>${escapeHtml(head)}${head ? " " : ""}<em>${escapeHtml(last)}</em></h1>`;
  }
  if (metaBits.length) html += `<div class="meta">${metaBits.join("")}</div>`;
  wrap.innerHTML = html;
}

function renderKpis() {
  const total = state.features.length;
  const major = state.features.filter(f => f.type === "major").length;
  const minor = total - major;
  const fy = state.meta && state.meta.fy ? state.meta.fy : "";
  const html = `
    <div class="kpi"><span class="label">Initiatives</span><span class="value">${total}</span><span class="sub">${major} major · ${minor} minor</span></div>
    <div class="kpi"><span class="label">Quarters</span><span class="value">${state.quarters.length}</span><span class="sub">24 sprints${fy ? " / " + escapeHtml(fy) : ""}</span></div>
  `;
  document.getElementById("kpis").innerHTML = html;
}

function toggleSet(set, value) {
  if (set.has(value)) set.delete(value); else set.add(value);
}

function renderFilters() {
  const qWrap = document.getElementById("filter-quarters");
  qWrap.innerHTML = "";
  state.quarters.forEach((q, i) => {
    const b = document.createElement("button");
    b.className = "chip" + (filter.quarters.has(i) ? " active" : "");
    b.dataset.q = i;
    const short = q.split("—")[0].trim();
    b.innerHTML = `<span class="dot" style="background:var(--q${i})"></span>${escapeHtml(short)}`;
    b.addEventListener("click", () => {
      toggleSet(filter.quarters, i);
      renderFilters();
      applyFilterDimming();
    });
    qWrap.appendChild(b);
  });

  const krWrap = document.getElementById("filter-krs");
  krWrap.innerHTML = "";
  uniqueKRs().forEach(({ code }) => {
    const b = document.createElement("button");
    b.className = "chip kr" + (filter.krs.has(code) ? " active" : "");
    b.textContent = code;
    b.addEventListener("click", () => {
      toggleSet(filter.krs, code);
      renderFilters();
      renderKrRail();
      applyFilterDimming();
    });
    krWrap.appendChild(b);
  });

  const clear = document.getElementById("filter-clear");
  const has = filter.quarters.size > 0 || filter.krs.size > 0;
  clear.classList.toggle("hidden", !has);
}

function applyFilterDimming() {
  document.querySelectorAll(".card").forEach(el => {
    const id = el.dataset.id;
    const f = state.features.find(x => x.id === id);
    el.classList.toggle("dimmed", f && !featureMatchesFilter(f));
  });
  document.querySelectorAll(".kr-row").forEach(el => {
    el.classList.toggle("active", filter.krs.has(el.dataset.kr));
  });
}

/* ---------- render: timeline ---------- */
function renderQuarters() {
  const row = document.getElementById("quarters-row");
  row.innerHTML = "";
  const showStageNames = !state.meta || !state.meta.show || state.meta.show.stageNames !== false;
  state.quarters.forEach((label, i) => {
    const cell = document.createElement("div");
    cell.className = "q-cell";
    cell.dataset.q = i;
    const features = state.features.filter(f => f.q === i);
    const major = features.filter(f => f.type === "major").length;
    const parts = label.split("—");
    const num = (parts[0] || "Q" + (i + 1)).trim();
    const rawTitle = (parts.slice(1).join("—") || "").trim();
    const title = showStageNames ? rawTitle : "";
    cell.innerHTML = `
      <div class="num">${escapeHtml(num)}</div>
      ${title ? `<span class="title" contenteditable="true" data-q-idx="${i}">${escapeHtml(title)}</span>` : ""}
      <div class="stat"><b>${features.length}</b> initiatives · <b>${major}</b> major</div>
    `;
    row.appendChild(cell);
  });
  // editable quarter titles
  row.querySelectorAll(".title").forEach(el => {
    el.addEventListener("blur", () => {
      const i = parseInt(el.dataset.qIdx, 10);
      const num = state.quarters[i].split("—")[0].trim();
      const next = el.textContent.trim();
      state.quarters[i] = num + " — " + next;
      saveState();
    });
    el.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); el.blur(); }
    });
  });
}

function renderSprints() {
  const row = document.getElementById("sprints-row");
  row.innerHTML = "";
  for (let i = 0; i < TOTAL_SPRINTS; i++) {
    const cell = document.createElement("div");
    cell.className = "s-cell";
    if ((i + 1) % SPRINTS_PER_QUARTER === 0) cell.classList.add("q-end");
    cell.textContent = "S" + ((i % SPRINTS_PER_QUARTER) + 1);
    row.appendChild(cell);
  }
}

function renderCards() {
  const inner = document.getElementById("lanes-inner");
  inner.innerHTML = "";
  const maxLane = Math.max(0, ...state.features.map(f => f.lane)) + 1;
  const variant = document.body.dataset.variant || "editorial";
  const isIndex = variant === "index";
  const minLanes = isIndex ? 4 : 5;
  const totalLanes = Math.max(maxLane + 1, minLanes);
  // height handled via CSS row-h custom prop; compute fallback in JS for layout
  const rowH = parseInt(getComputedStyle(document.body).getPropertyValue("--row-h"), 10) || 44;
  const totalHeight = totalLanes * rowH + 36;
  inner.style.height = totalHeight + "px";

  for (const f of state.features) {
    const el = document.createElement("div");
    el.className = "card " + (f.type === "minor" ? "minor" : "major");
    el.dataset.id = f.id;
    el.dataset.q = f.q;
    el.style.setProperty("--start", f.start);
    el.style.setProperty("--length", f.length);
    el.style.setProperty("--lane", f.lane);

    if (variant === "index") {
      el.innerHTML = `
        <div class="row-1">
          <span class="pin"></span>
          <span class="title">${escapeHtml(f.title)}</span>
          <span class="kr-tag">${escapeHtml(krCode(f.kr) || "—")}</span>
        </div>
        <div class="desc-mini">${escapeHtml(f.description)}</div>
        <div class="handle l"></div>
        <div class="handle r"></div>
      `;
    } else {
      el.innerHTML = `
        <span class="pin"></span>
        <span class="title">${escapeHtml(f.title)}</span>
        <span class="desc-mini">${escapeHtml(f.description)}</span>
        <span class="kr-tag">${escapeHtml(krCode(f.kr) || "—")}</span>
        <div class="handle l"></div>
        <div class="handle r"></div>
      `;
    }
    inner.appendChild(el);
  }
  applyFilterDimming();
}

function renderKrRail() {
  const list = document.getElementById("kr-list");
  if (!list) return; // rail removed
  return;
  const krs = uniqueKRs();
  const total = state.features.length || 1;
  list.innerHTML = krs.map(({ code, label, count }) => {
    const pct = Math.round((count / total) * 100);
    return `
      <div class="kr-row${filter.krs.has(code) ? " active" : ""}" data-kr="${escapeHtml(code)}">
        <div class="kr-name">${escapeHtml(code)}</div>
        <div class="kr-desc">${escapeHtml(extractKrTheme(label))}</div>
        <div class="kr-meter">
          <div class="kr-bar"><span style="width:${pct}%"></span></div>
          <span class="kr-count">${count}</span>
        </div>
      </div>
    `;
  }).join("");
  list.querySelectorAll(".kr-row").forEach(el => {
    el.addEventListener("click", () => {
      const code = el.dataset.kr;
      toggleSet(filter.krs, code);
      renderFilters();
      renderKrRail();
      applyFilterDimming();
    });
  });
}
function extractKrTheme(label) {
  // Strip leading "KR1 — " and any trailing target spec, keep concise theme
  const m = label.match(/^KR\d+\s*[—\-:]\s*([^:]+?)(?:\s*:|$)/);
  if (m) return m[1].trim();
  return label;
}

function renderEmptyState() {
  const el = document.getElementById("empty-state");
  if (!el) return;
  el.classList.toggle("hidden", state.features.length > 0);
}

function renderAll() {
  renderMasthead();
  renderKpis();
  renderQuarters();
  renderSprints();
  renderCards();
  renderFilters();
  renderEmptyState();
}

/* ---------- drag / resize ---------- */
let drag = null;
document.getElementById("lanes-inner").addEventListener("pointerdown", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  if (e.target.classList.contains("title") && card.contentEditable === "true") return;
  const id = card.dataset.id;
  const f = state.features.find(x => x.id === id);
  if (!f) return;
  const lanes = document.getElementById("lanes-inner");
  const sprintWidth = lanes.clientWidth / TOTAL_SPRINTS;
  const rowH = parseInt(getComputedStyle(document.body).getPropertyValue("--row-h"), 10) || 44;
  let mode = "move";
  if (e.target.classList.contains("handle")) {
    mode = e.target.classList.contains("l") ? "resize-l" : "resize-r";
  }
  drag = {
    id, mode,
    startX: e.clientX, startY: e.clientY, moved: false,
    origStart: f.start, origLength: f.length, origLane: f.lane,
    sprintWidth, rowH
  };
  card.classList.add("dragging");
  card.setPointerCapture?.(e.pointerId);
  hidePopover();
  e.preventDefault();
});
window.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const f = state.features.find(x => x.id === drag.id);
  if (!f) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
  const dSprints = Math.round(dx / drag.sprintWidth);
  const dLane = Math.round(dy / drag.rowH);
  if (drag.mode === "move") {
    let s = drag.origStart + dSprints;
    s = clamp(s, 0, TOTAL_SPRINTS - f.length);
    f.start = s;
    f.lane = Math.max(0, drag.origLane + dLane);
  } else if (drag.mode === "resize-l") {
    let newStart = drag.origStart + dSprints;
    newStart = clamp(newStart, 0, drag.origStart + drag.origLength - 1);
    const newLength = drag.origLength - (newStart - drag.origStart);
    f.start = newStart;
    f.length = Math.max(1, newLength);
  } else if (drag.mode === "resize-r") {
    let newLength = drag.origLength + dSprints;
    newLength = clamp(newLength, 1, TOTAL_SPRINTS - f.start);
    f.length = newLength;
  }
  f.q = quarterOfStart(f.start);
  const card = document.querySelector(`.card[data-id="${f.id}"]`);
  if (card) {
    card.style.setProperty("--start", f.start);
    card.style.setProperty("--length", f.length);
    card.style.setProperty("--lane", f.lane);
    card.dataset.q = f.q;
    const inner = document.getElementById("lanes-inner");
    const need = (f.lane + 2) * drag.rowH + 36;
    if (parseFloat(inner.style.height) < need) inner.style.height = need + "px";
  }
});
window.addEventListener("pointerup", (e) => {
  if (!drag) return;
  const wasMoved = drag.moved;
  const id = drag.id;
  document.querySelectorAll(".card.dragging").forEach(el => el.classList.remove("dragging"));
  drag = null;
  compactLanes();
  saveState();
  renderQuarters();
  renderKpis();
  renderCards();
  renderKrRail();
  if (!wasMoved) {
    // treat as click → open edit modal
    openModal(id);
  }
});
function compactLanes() {
  const used = new Set(state.features.map(f => f.lane));
  const sorted = [...used].sort((a, b) => a - b);
  const map = new Map();
  sorted.forEach((l, i) => map.set(l, i));
  state.features.forEach(f => f.lane = map.get(f.lane));
}

/* ---------- popover ---------- */
const popover = document.getElementById("popover");
document.getElementById("lanes-inner").addEventListener("mouseover", (e) => {
  const card = e.target.closest(".card");
  if (!card || drag) return;
  const f = state.features.find(x => x.id === card.dataset.id);
  if (!f) return;
  showPopover(f, card);
});
document.getElementById("lanes-inner").addEventListener("mouseout", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  if (e.relatedTarget && card.contains(e.relatedTarget)) return;
  hidePopover();
});
function showPopover(f, card) {
  const isMinor = f.type === "minor";
  popover.innerHTML = `
    <div class="pop-eyebrow">
      <span class="pop-type${isMinor ? " minor" : ""}">${isMinor ? "Minor" : "Major"}</span>
      ${escapeHtml(state.quarters[f.q] || "")} · S${f.start + 1}–S${f.start + f.length}
    </div>
    <h3>${escapeHtml(f.title)}</h3>
    <div class="pop-desc">${escapeHtml(f.description)}</div>
    <div class="pop-section">Jobs to be done</div>
    <ul>${(f.jtbds || []).map(j => `<li>${escapeHtml(j)}</li>`).join("")}</ul>
    <div class="pop-section">Why it matters</div>
    <div class="pop-desc">${escapeHtml(f.value)}</div>
    ${f.kr ? `<div class="kr-pill">${escapeHtml(f.kr)}</div>` : ""}
  `;
  const rect = card.getBoundingClientRect();
  popover.classList.add("show");
  requestAnimationFrame(() => {
    const pw = popover.offsetWidth;
    const ph = popover.offsetHeight;
    let left = rect.left + rect.width / 2 - pw / 2;
    let top = rect.bottom + 10;
    if (top + ph > window.innerHeight - 8) top = rect.top - ph - 10;
    left = Math.max(12, Math.min(window.innerWidth - pw - 12, left));
    popover.style.left = left + "px";
    popover.style.top = top + "px";
  });
}
function hidePopover() { popover.classList.remove("show"); }

/* ---------- settings panel ---------- */
const panel = document.getElementById("panel");
const scrim = document.getElementById("scrim");
document.getElementById("cog-btn").addEventListener("click", openPanel);
document.getElementById("close-panel").addEventListener("click", closePanel);
scrim.addEventListener("click", () => { closePanel(); closeModal(); });
function openPanel() { renderPanel(); panel.classList.add("show"); scrim.classList.add("show"); }
function closePanel() {
  panel.classList.remove("show");
  if (!document.getElementById("modal").classList.contains("show")) scrim.classList.remove("show");
}
function renderPanel() {
  renderLookForm();
  renderMetaForm();
  renderStagesForm();
  const list = document.getElementById("feature-list");
  list.innerHTML = "";
  if (state.features.length === 0) {
    list.innerHTML = `<div class="empty-hint" style="color:var(--muted);font-size:12px;text-align:center;padding:18px;">No features yet. Click + to add one.</div>`;
    return;
  }
  const sorted = [...state.features].sort((a, b) => a.start - b.start || a.lane - b.lane);
  sorted.forEach(f => {
    const item = document.createElement("div");
    item.className = "feature-item " + (f.type === "minor" ? "minor" : "");
    item.innerHTML = `
      <span class="swatch"></span>
      <span class="ft-title">${escapeHtml(f.title)}</span>
      <span class="ft-meta">S${f.start + 1}–S${f.start + f.length}</span>
    `;
    item.addEventListener("click", () => openModal(f.id));
    list.appendChild(item);
  });
}

function renderLookForm() {
  const wrap = document.getElementById("look-form");
  if (!wrap) return;
  const variant = document.body.dataset.variant || "editorial";
  const palette = document.body.dataset.palette || "cream";
  const variants = [
    ["editorial", "Editorial — airy, magazine-like"],
    ["strata",    "Strata — banded quarters"],
    ["index",     "Index — detail-rich cards"]
  ];
  const palettes = [
    ["cream", "Cream + Lime"],
    ["bone",  "Bone + Forest"],
    ["sage",  "Sage + Olive"]
  ];
  const opts = (list, sel) => list.map(([v, l]) =>
    `<option value="${v}" ${v === sel ? "selected" : ""}>${escapeHtml(l)}</option>`
  ).join("");
  wrap.innerHTML = `
    <div class="meta-field">
      <label class="meta-label">Style</label>
      <select class="meta-input" id="look-variant">${opts(variants, variant)}</select>
    </div>
    <div class="meta-field">
      <label class="meta-label">Palette</label>
      <select class="meta-input" id="look-palette">${opts(palettes, palette)}</select>
    </div>
  `;
  wrap.querySelector("#look-variant").addEventListener("change", e => {
    document.body.dataset.variant = e.target.value;
    renderCards();
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { variant: e.target.value } }, "*");
  });
  wrap.querySelector("#look-palette").addEventListener("change", e => {
    document.body.dataset.palette = e.target.value;
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { palette: e.target.value } }, "*");
  });
}

function renderMetaForm() {
  const wrap = document.getElementById("meta-form");
  if (!wrap) return;
  const m = state.meta;
  const fields = [
    { key: "title",        label: "Title",         showKey: "title" },
    { key: "fy",           label: "Fiscal year",   showKey: "fy" },
    { key: "owner",        label: "Owner",         showKey: "owner" },
    { key: "status",       label: "Status",        showKey: "status" },
    { key: "lastReviewed", label: "Last reviewed", showKey: "lastReviewed" }
  ];
  wrap.innerHTML = fields.map(f => `
    <div class="meta-field">
      <label class="meta-label">${f.label}</label>
      <div class="meta-row">
        <input class="meta-input" data-meta-key="${f.key}" value="${escapeHtml(m[f.key] || "")}" />
        <label class="meta-toggle" title="Show on roadmap">
          <input type="checkbox" data-meta-show="${f.showKey}" ${m.show[f.showKey] !== false ? "checked" : ""} />
          <span>Show</span>
        </label>
      </div>
    </div>
  `).join("");
  wrap.querySelectorAll("input.meta-input").forEach(el => {
    el.addEventListener("input", () => {
      state.meta[el.dataset.metaKey] = el.value;
      saveState(); renderMasthead(); renderKpis();
    });
  });
  wrap.querySelectorAll("input[data-meta-show]").forEach(el => {
    el.addEventListener("change", () => {
      state.meta.show[el.dataset.metaShow] = el.checked;
      saveState(); renderMasthead(); renderKpis();
    });
  });
}

function renderStagesForm() {
  const wrap = document.getElementById("stages-form");
  if (!wrap) return;
  const showAll = state.meta.show.stageNames !== false;
  wrap.innerHTML = `
    <div class="meta-field">
      <label class="meta-toggle" style="justify-content:flex-start;">
        <input type="checkbox" id="stage-show-all" ${showAll ? "checked" : ""} />
        <span>Show stage descriptions on the timeline</span>
      </label>
    </div>
    ${state.quarters.map((label, i) => {
      const parts = label.split("—");
      const num = (parts[0] || "").trim();
      const title = (parts.slice(1).join("—") || "").trim();
      return `
        <div class="meta-field stage-field">
          <label class="meta-label">Stage ${i + 1}</label>
          <div class="stage-row">
            <input class="stage-input num" data-q="${i}" data-part="num"   placeholder="Q${i + 1}" value="${escapeHtml(num)}" />
            <input class="stage-input ttl" data-q="${i}" data-part="title" placeholder="Description" value="${escapeHtml(title)}" />
          </div>
        </div>
      `;
    }).join("")}
  `;
  wrap.querySelector("#stage-show-all").addEventListener("change", e => {
    state.meta.show.stageNames = e.target.checked;
    saveState(); renderQuarters();
  });
  wrap.querySelectorAll("input.stage-input").forEach(el => {
    el.addEventListener("input", () => {
      const i = parseInt(el.dataset.q, 10);
      const part = el.dataset.part;
      const sib = wrap.querySelector(`input.stage-input[data-q="${i}"][data-part="${part === "num" ? "title" : "num"}"]`);
      const num   = part === "num"   ? el.value.trim() : sib.value.trim();
      const title = part === "title" ? el.value.trim() : sib.value.trim();
      state.quarters[i] = title ? `${num} — ${title}` : num;
      saveState(); renderQuarters(); renderFilters();
    });
  });
}

/* ---------- edit modal ---------- */
const modal = document.getElementById("modal");
function openModal(id) {
  const f = id ? state.features.find(x => x.id === id) : null;
  const isNew = !f;
  const data = f || {
    id: "f" + Date.now(),
    title: "New feature",
    type: "major",
    description: "",
    jtbds: [],
    value: "",
    kr: "",
    q: 0, start: 0, length: 3, lane: nextFreeLane()
  };
  document.getElementById("modal-title").textContent = isNew ? "Add initiative" : "Edit initiative";
  document.getElementById("modal-body").innerHTML = `
    <div class="field"><label>Title</label><input id="ed-title" value="${escapeHtml(data.title)}" /></div>
    <div class="row">
      <div class="field"><label>Type</label>
        <select id="ed-type">
          <option value="major" ${data.type === "major" ? "selected" : ""}>Major</option>
          <option value="minor" ${data.type === "minor" ? "selected" : ""}>Minor</option>
        </select>
      </div>
      <div class="field"><label>Quarter</label>
        <select id="ed-q">
          ${state.quarters.map((q, i) => `<option value="${i}" ${data.q === i ? "selected" : ""}>${escapeHtml(q)}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="row">
      <div class="field"><label>Start sprint</label><input id="ed-start" type="number" min="1" max="${TOTAL_SPRINTS}" value="${data.start + 1}" /></div>
      <div class="field"><label>Length</label><input id="ed-length" type="number" min="1" max="${TOTAL_SPRINTS}" value="${data.length}" /></div>
      <div class="field"><label>Lane</label><input id="ed-lane" type="number" min="0" value="${data.lane}" /></div>
    </div>
    <div class="field"><label>Description</label><textarea id="ed-desc">${escapeHtml(data.description)}</textarea></div>
    <div class="field"><label>JTBDs (one per line)</label><textarea id="ed-jtbds">${escapeHtml((data.jtbds || []).join("\n"))}</textarea></div>
    <div class="field"><label>Value</label><textarea id="ed-value">${escapeHtml(data.value)}</textarea></div>
    <div class="field"><label>KR</label><input id="ed-kr" value="${escapeHtml(data.kr || "")}" /></div>
  `;
  document.getElementById("delete-feature").style.display = isNew ? "none" : "";
  document.getElementById("delete-feature").onclick = () => {
    if (confirm("Delete this initiative?")) {
      state.features = state.features.filter(x => x.id !== data.id);
      compactLanes();
      saveState();
      renderAll();
      renderPanel();
      closeModal();
    }
  };
  document.getElementById("cancel-edit").onclick = closeModal;
  document.getElementById("save-edit").onclick = () => {
    const start = clamp(parseInt(document.getElementById("ed-start").value, 10) || 1, 1, TOTAL_SPRINTS);
    const length = clamp(parseInt(document.getElementById("ed-length").value, 10) || 1, 1, TOTAL_SPRINTS);
    const lane = Math.max(0, parseInt(document.getElementById("ed-lane").value, 10) || 0);
    const updated = {
      ...data,
      title: document.getElementById("ed-title").value.trim() || "Untitled",
      type: document.getElementById("ed-type").value,
      q: parseInt(document.getElementById("ed-q").value, 10),
      start: start - 1,
      length: Math.min(length, TOTAL_SPRINTS - (start - 1)),
      lane,
      description: document.getElementById("ed-desc").value,
      jtbds: document.getElementById("ed-jtbds").value.split("\n").map(s => s.trim()).filter(Boolean),
      value: document.getElementById("ed-value").value,
      kr: document.getElementById("ed-kr").value
    };
    if (isNew) state.features.push(updated);
    else state.features = state.features.map(x => x.id === updated.id ? updated : x);
    saveState();
    renderAll();
    renderPanel();
    closeModal();
  };
  modal.classList.add("show");
  scrim.classList.add("show");
}
function closeModal() {
  modal.classList.remove("show");
  if (!panel.classList.contains("show")) scrim.classList.remove("show");
}
function nextFreeLane() {
  const used = new Set(state.features.map(f => f.lane));
  let l = 0; while (used.has(l)) l++; return l;
}

/* ---------- import / export ---------- */
const fileInput = document.getElementById("file-input");
function pickFile() { fileInput.value = ""; fileInput.click(); }
document.getElementById("import-btn").addEventListener("click", pickFile);
document.getElementById("panel-import-btn").addEventListener("click", pickFile);
document.getElementById("empty-import-btn")?.addEventListener("click", pickFile);
document.getElementById("empty-add-btn")?.addEventListener("click", () => openModal(null));
document.getElementById("add-btn").addEventListener("click", () => openModal(null));

document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "sdk-roadmap.json"; a.click();
  URL.revokeObjectURL(url);
});
document.getElementById("reset-btn").addEventListener("click", () => {
  if (confirm("Reset to default roadmap? This will discard your edits.")) {
    state = structuredClone(window.DEFAULT_DATA);
    saveState();
    renderAll();
    renderPanel();
  }
});
fileInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) handleFile(file);
});
function handleFile(file) {
  if (!/\.json$/i.test(file.name) && file.type && !file.type.includes("json")) {
    toast("That doesn't look like a JSON file.", "error"); return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const next = validateAndNormalize(parsed);
      if (state.features.length > 0 &&
          !confirm(`Replace current roadmap with "${file.name}"?`)) return;
      state = next; saveState(); renderAll();
      if (panel.classList.contains("show")) renderPanel();
      toast(`Imported ${state.features.length} feature${state.features.length === 1 ? "" : "s"} from ${file.name}`, "success");
    } catch (err) {
      console.error(err);
      toast("Import failed: " + err.message, "error");
    }
  };
  reader.onerror = () => toast("Couldn't read that file.", "error");
  reader.readAsText(file);
}
function normalizeFeature(f, idx) {
  if (!f || typeof f !== "object") throw new Error(`features[${idx}] is not an object`);
  const start = clamp(Number.isFinite(f.start) ? f.start : 0, 0, TOTAL_SPRINTS - 1);
  const length = clamp(Number.isFinite(f.length) ? f.length : 1, 1, TOTAL_SPRINTS - start);
  return {
    id: typeof f.id === "string" && f.id ? f.id : `f${Date.now()}_${idx}`,
    title: typeof f.title === "string" && f.title ? f.title : "Untitled",
    type: f.type === "minor" ? "minor" : "major",
    q: Number.isFinite(f.q) ? clamp(f.q, 0, 3) : quarterOfStart(start),
    start, length,
    lane: Number.isFinite(f.lane) ? Math.max(0, f.lane) : 0,
    description: typeof f.description === "string" ? f.description : "",
    jtbds: Array.isArray(f.jtbds) ? f.jtbds.map(String) : [],
    value: typeof f.value === "string" ? f.value : "",
    kr: typeof f.kr === "string" ? f.kr : ""
  };
}
function validateAndNormalize(data) {
  if (!data || typeof data !== "object") throw new Error("Top-level must be a JSON object");
  if (!Array.isArray(data.features)) throw new Error("Missing 'features' array");
  const quarters = Array.isArray(data.quarters) && data.quarters.length === 4
    ? data.quarters.map(q => String(q ?? ""))
    : ["Q1", "Q2", "Q3", "Q4"];
  const seen = new Set();
  const features = data.features.map((f, i) => {
    const nf = normalizeFeature(f, i);
    let id = nf.id;
    while (seen.has(id)) id = id + "_" + i;
    nf.id = id; seen.add(id); return nf;
  });
  return { meta: mergeMeta(data.meta), quarters, features };
}

/* ---------- drag-drop file onto window ---------- */
let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  if (!e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return;
  dragDepth++;
  document.getElementById("drop-overlay").classList.add("show");
});
window.addEventListener("dragover", (e) => {
  if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault();
});
window.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.getElementById("drop-overlay").classList.remove("show");
});
window.addEventListener("drop", (e) => {
  e.preventDefault(); dragDepth = 0;
  document.getElementById("drop-overlay").classList.remove("show");
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) handleFile(file);
});

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

/* ---------- filter-clear button ---------- */
document.getElementById("filter-clear").addEventListener("click", () => {
  filter.quarters.clear();
  filter.krs.clear();
  renderFilters();
  renderKrRail();
  applyFilterDimming();
});

/* ---------- init ---------- */
renderAll();
