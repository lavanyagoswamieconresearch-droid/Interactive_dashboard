/* ============================================================
   TIME-USE DASHBOARD — configuration
   Edit CONFIG to point at your own two CSVs and describe your
   columns. Everything below CONFIG is generic and reads only
   this object.
   ============================================================ */
const CONFIG = {
  aggregatedCsvPath: "data/aggregated_cube.csv",
  timelineCsvPath: "data/timeline_cube.csv",
  title: "Time Use Explorer",
  subtitle: "Filter by who they are, watch what they're doing all day.",

  // One filter block per demographic column.
  // type: "radio" (single choice + All) or "checkbox" (multi-select).
  demoFilters: [
    { column: "gender",                     label: "Gender",                     type: "radio" },
    { column: "sector",                     label: "Sector",                     type: "radio" },
    { column: "religion",                   label: "Religion",                   type: "checkbox" },
    { column: "social_group",               label: "Social group",               type: "checkbox" },
    { column: "marital_status",             label: "Marital status",             type: "checkbox" },
    { column: "day_of_week",                label: "Day of week",                type: "checkbox" },
    { column: "principal_activity_status",  label: "Principal activity status",  type: "checkbox" }
  ],

  activityColumn: "activity_type",

  // Optional: map raw activity_type codes to readable labels.
  // Leave empty to just display the raw codes as-is.
  activityLabels: {
    // "1": "Sleeping",
    // "2": "Cooking",
  },

  // How many activities get their own colour in the stacked
  // chart before the rest are folded into "Other".
  topActivitiesInChart: 8
};

/* ============================================================
   Generic engine — no need to edit below this line
   ============================================================ */

const PALETTE = ["#2F6F5E","#7A4FB5","#B65C34","#2B6777","#C9A227","#8E4A6B","#4A7043","#5B5F97"];
const OTHER_COLOR = "#9AA39C";

const DEMO_COLS = CONFIG.demoFilters.map(f => f.column);

let RAW_AGG = [];
let RAW_TL = [];
let GROUP_COMBOS = [];      // deduped unique demo combos with their n_total_persons
let GRAND_TOTAL = 0;        // total persons across the whole dataset
let SLOTS = [];             // sorted [{index, label}] from timeline data
let TOP_ACTIVITIES = [];    // activity codes ranked by overall participation
let ACTIVE = {};            // column -> Set of selected values
let FOCUS_ACTIVITY = null;  // null = stacked view, else single activity code
let METRIC = "count";       // "count" | "pct"

document.getElementById("appTitle").textContent = CONFIG.title;
document.getElementById("appSubtitle").textContent = CONFIG.subtitle;

Promise.all([
  parseCsv(CONFIG.aggregatedCsvPath),
  parseCsv(CONFIG.timelineCsvPath)
]).then(([aggResults, tlResults]) => {
  RAW_AGG = aggResults.data.filter(r => r[CONFIG.activityColumn] !== undefined && r[CONFIG.activityColumn] !== "");
  RAW_TL = tlResults.data.filter(r => r[CONFIG.activityColumn] !== undefined && r[CONFIG.activityColumn] !== "");
  init();
}).catch(err => {
  document.getElementById("filterControls").innerHTML =
    `<p style="color:#B0413E;font-size:13px;">Could not load one of the CSVs. Check CONFIG.aggregatedCsvPath / CONFIG.timelineCsvPath in js/app.js.</p>`;
  console.error(err);
});

function parseCsv(path) {
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: resolve,
      error: reject
    });
  });
}

/* ---------- setup ---------- */

function demoKey(row) {
  return DEMO_COLS.map(c => row[c]).join("|||");
}

function init() {
  // dedupe unique demo combinations + their total persons
  const seen = new Map();
  RAW_AGG.forEach(row => {
    const key = demoKey(row);
    if (!seen.has(key)) {
      const values = {};
      DEMO_COLS.forEach(c => values[c] = row[c]);
      seen.set(key, { key, values, n_total_persons: row.n_total_persons });
    }
  });
  GROUP_COMBOS = [...seen.values()];
  GRAND_TOTAL = GROUP_COMBOS.reduce((a, c) => a + c.n_total_persons, 0);

  // unique sorted time slots
  const slotMap = new Map();
  RAW_TL.forEach(r => slotMap.set(r.slot_index, r.slot_label));
  SLOTS = [...slotMap.entries()].sort((a, b) => a[0] - b[0]).map(([index, label]) => ({ index, label }));

  // rank activities overall (unfiltered) by total participants, for the top-K + Other split
  const totals = new Map();
  RAW_AGG.forEach(r => {
    totals.set(r[CONFIG.activityColumn], (totals.get(r[CONFIG.activityColumn]) || 0) + r.n_participants);
  });
  TOP_ACTIVITIES = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, CONFIG.topActivitiesInChart)
    .map(([code]) => code);

  initFilters();
  render();
}

function activityLabel(code) {
  return CONFIG.activityLabels[code] || String(code);
}

/* ---------- filters ---------- */

function initFilters() {
  const container = document.getElementById("filterControls");
  container.innerHTML = "";

  CONFIG.demoFilters.forEach(f => {
    const options = [...new Set(RAW_AGG.map(r => r[f.column]).filter(v => v !== undefined && v !== null && v !== ""))].sort();
    if (f.type === "radio") {
      ACTIVE[f.column] = new Set(["__ALL__"]);
      container.appendChild(buildRadioBlock(f, options));
    } else {
      ACTIVE[f.column] = new Set(options);
      container.appendChild(buildCheckboxBlock(f, options));
    }
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    FOCUS_ACTIVITY = null;
    initFilters();
    render();
  });
}

function buildRadioBlock(f, options) {
  const wrap = document.createElement("div");
  wrap.className = "filter-block";
  const groupName = `radio-${f.column}`;

  let rows = `
    <label class="opt-row">
      <input type="radio" name="${groupName}" value="__ALL__" checked>
      <span>All</span>
    </label>`;
  options.forEach(opt => {
    rows += `
      <label class="opt-row">
        <input type="radio" name="${groupName}" value="${opt}">
        <span>${opt}</span>
      </label>`;
  });

  wrap.innerHTML = `<div class="filter-label"><span>${f.label}</span></div><div class="opt-group">${rows}</div>`;

  wrap.querySelectorAll(`input[name="${groupName}"]`).forEach(input => {
    input.addEventListener("change", () => {
      ACTIVE[f.column] = new Set([input.value]);
      render();
    });
  });
  return wrap;
}

function buildCheckboxBlock(f, options) {
  const wrap = document.createElement("div");
  wrap.className = "filter-block";

  let rows = "";
  options.forEach(opt => {
    rows += `
      <label class="opt-row">
        <input type="checkbox" value="${opt}" checked>
        <span>${opt}</span>
      </label>`;
  });

  wrap.innerHTML = `<div class="filter-label"><span>${f.label}</span></div><div class="opt-group">${rows}</div>`;

  wrap.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener("change", () => {
      const set = ACTIVE[f.column];
      if (input.checked) set.add(input.value); else set.delete(input.value);
      render();
    });
  });
  return wrap;
}

function comboMatches(values) {
  for (const f of CONFIG.demoFilters) {
    const sel = ACTIVE[f.column];
    if (f.type === "radio") {
      if (!sel.has("__ALL__") && !sel.has(values[f.column])) return false;
    } else {
      if (!sel.has(values[f.column])) return false;
    }
  }
  return true;
}

/* ---------- computation ---------- */

function filteredTotalPersons() {
  return GROUP_COMBOS.filter(c => comboMatches(c.values)).reduce((a, c) => a + c.n_total_persons, 0);
}

function computeAggByActivity() {
  const map = new Map(); // activity -> { n_participants, total_minutes }
  RAW_AGG.forEach(row => {
    if (!comboMatches(row)) return;
    const key = row[CONFIG.activityColumn];
    const cur = map.get(key) || { n_participants: 0, total_minutes: 0 };
    cur.n_participants += row.n_participants;
    cur.total_minutes += row.total_minutes;
    map.set(key, cur);
  });
  return map;
}

function computeTimelineByActivity() {
  // slot_index -> activity -> n_people
  const map = new Map();
  RAW_TL.forEach(row => {
    if (!comboMatches(row)) return;
    const s = row.slot_index;
    if (!map.has(s)) map.set(s, new Map());
    const inner = map.get(s);
    const key = row[CONFIG.activityColumn];
    inner.set(key, (inner.get(key) || 0) + row.n_people);
  });
  return map;
}

/* ---------- render: gauge + activity table ---------- */

function render() {
  const total = filteredTotalPersons();
  const pct = GRAND_TOTAL ? Math.round((total / GRAND_TOTAL) * 100) : 0;
  document.getElementById("gaugeFill").style.width = pct + "%";
  document.getElementById("gaugeCount").textContent = total.toLocaleString();
  document.getElementById("gaugeTotal").textContent = GRAND_TOTAL.toLocaleString();
  document.getElementById("gaugePct").textContent = `(${pct}%)`;

  const aggByActivity = computeAggByActivity();
  renderActivityTable(aggByActivity, total);

  const timelineByActivity = computeTimelineByActivity();
  renderChart(timelineByActivity, aggByActivity, total);
}

function renderActivityTable(aggByActivity, total) {
  const el = document.getElementById("activityTable");
  const rows = [...aggByActivity.entries()]
    .map(([code, v]) => ({
      code,
      label: activityLabel(code),
      n_participants: v.n_participants,
      participation_rate: total ? v.n_participants / total : 0,
      mean_minutes_per_participant: v.n_participants ? v.total_minutes / v.n_participants : 0,
      mean_minutes_per_person: total ? v.total_minutes / total : 0
    }))
    .sort((a, b) => b.n_participants - a.n_participants);

  if (!rows.length) {
    el.innerHTML = `<p style="font-size:12px;color:var(--ink-soft);font-style:italic;">No matching records</p>`;
    return;
  }

  let html = `
    <table class="activity-table">
      <thead>
        <tr>
          <th>Activity</th>
          <th>People</th>
          <th>Participation</th>
          <th>Avg min / participant</th>
          <th>Avg min / person</th>
        </tr>
      </thead>
      <tbody>`;
  rows.forEach(r => {
    const isFocused = FOCUS_ACTIVITY === r.code;
    html += `
        <tr class="act-row${isFocused ? " focused" : ""}" data-code="${r.code}">
          <td>${r.label}</td>
          <td class="mono">${r.n_participants.toLocaleString()}</td>
          <td class="mono">${(r.participation_rate * 100).toFixed(1)}%</td>
          <td class="mono">${r.mean_minutes_per_participant.toFixed(0)}</td>
          <td class="mono">${r.mean_minutes_per_person.toFixed(0)}</td>
        </tr>`;
  });
  html += `</tbody></table>`;
  el.innerHTML = html;

  el.querySelectorAll(".act-row").forEach(tr => {
    tr.addEventListener("click", () => {
      const code = tr.dataset.code;
      FOCUS_ACTIVITY = FOCUS_ACTIVITY === code ? null : code;
      render();
    });
  });
}

/* ---------- render: stacked-area day chart ---------- */

function renderChart(timelineByActivity, aggByActivity, total) {
  const container = document.getElementById("dayChart");
  const legend = document.getElementById("chartLegend");
  if (!SLOTS.length) {
    container.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);">No timeline data.</p>`;
    legend.innerHTML = "";
    return;
  }

  const seriesCodes = FOCUS_ACTIVITY ? [FOCUS_ACTIVITY] : buildStackOrder();
  const showOther = !FOCUS_ACTIVITY && seriesCodes.includes("__OTHER__");

  // build per-slot values for each series
  const values = seriesCodes.map(code => SLOTS.map(s => {
    const inner = timelineByActivity.get(s.index);
    if (!inner) return 0;
    if (code === "__OTHER__") {
      let sum = 0;
      inner.forEach((v, k) => { if (!TOP_ACTIVITIES.includes(k)) sum += v; });
      return sum;
    }
    return inner.get(code) || 0;
  }));

  const valuesScaled = METRIC === "pct"
    ? values.map(arr => arr.map(v => total ? (v / total) * 100 : 0))
    : values;

  const axisMax = METRIC === "pct" ? 100 : Math.max(total, 1);

  const svg = buildStackedAreaSvg(SLOTS, seriesCodes, valuesScaled, axisMax);
  container.innerHTML = svg;

  // legend
  let legendHtml = "";
  if (FOCUS_ACTIVITY) {
    legendHtml += `<button class="clear-focus-btn" id="clearFocusBtn" type="button">&larr; Show all activities</button>`;
  }
  seriesCodes.forEach((code, i) => {
    const label = code === "__OTHER__" ? "Other" : activityLabel(code);
    const color = code === "__OTHER__" ? OTHER_COLOR : PALETTE[TOP_ACTIVITIES.indexOf(code) % PALETTE.length];
    const agg = aggByActivity.get(code);
    const n = agg ? agg.n_participants : (code === "__OTHER__" ? "" : 0);
    legendHtml += `
      <button class="legend-item" data-code="${code}" type="button">
        <span class="swatch" style="background:${color}"></span>
        <span class="legend-label">${label}</span>
        ${n !== "" ? `<span class="legend-n">${Number(n).toLocaleString()}</span>` : ""}
      </button>`;
  });
  legend.innerHTML = legendHtml;

  legend.querySelectorAll(".legend-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.code;
      if (code === "__OTHER__") return;
      FOCUS_ACTIVITY = FOCUS_ACTIVITY === code ? null : code;
      render();
    });
  });
  const clearBtn = document.getElementById("clearFocusBtn");
  if (clearBtn) clearBtn.addEventListener("click", () => { FOCUS_ACTIVITY = null; render(); });
}

function buildStackOrder() {
  const hasOther = TOP_ACTIVITIES.length < countDistinctActivities();
  return hasOther ? [...TOP_ACTIVITIES, "__OTHER__"] : [...TOP_ACTIVITIES];
}

function countDistinctActivities() {
  return new Set(RAW_AGG.map(r => r[CONFIG.activityColumn])).size;
}

function buildStackedAreaSvg(slots, seriesCodes, valuesScaled, axisMax) {
  const W = 900, H = 380;
  const padL = 56, padR = 16, padT = 16, padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = slots.length;

  const x = i => padL + (n > 1 ? (i * plotW) / (n - 1) : plotW / 2);
  const y = v => padT + plotH - (Math.min(v, axisMax) / axisMax) * plotH;

  // cumulative stack
  const cumTop = [];
  let running = new Array(n).fill(0);
  seriesCodes.forEach((code, si) => {
    const top = running.map((r, i) => r + valuesScaled[si][i]);
    cumTop.push(top);
    running = top;
  });

  let paths = "";
  seriesCodes.forEach((code, si) => {
    const bottom = si === 0 ? new Array(n).fill(0) : cumTop[si - 1];
    const top = cumTop[si];
    const color = code === "__OTHER__" ? OTHER_COLOR : PALETTE[TOP_ACTIVITIES.indexOf(code) % PALETTE.length];
    let d = `M ${x(0)} ${y(bottom[0])}`;
    for (let i = 1; i < n; i++) d += ` L ${x(i)} ${y(bottom[i])}`;
    for (let i = n - 1; i >= 0; i--) d += ` L ${x(i)} ${y(top[i])}`;
    d += " Z";
    const opacity = seriesCodes.length === 1 ? 0.85 : 0.9;
    paths += `<path d="${d}" fill="${color}" fill-opacity="${opacity}" stroke="${color}" stroke-width="1"></path>`;
  });

  // gridlines + y labels
  let grid = "";
  const gridSteps = 4;
  for (let g = 0; g <= gridSteps; g++) {
    const v = (axisMax / gridSteps) * g;
    const yy = y(v);
    grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="var(--line)" stroke-width="1"></line>`;
    const label = METRIC === "pct" ? `${Math.round(v)}%` : Math.round(v).toLocaleString();
    grid += `<text x="${padL - 8}" y="${yy + 4}" text-anchor="end" font-family="var(--font-mono)" font-size="10" fill="var(--ink-soft)">${label}</text>`;
  }

  // x labels (every 4th slot to avoid crowding, adaptive to slot count)
  let xLabels = "";
  const labelEvery = Math.max(1, Math.ceil(n / 12));
  slots.forEach((s, i) => {
    if (i % labelEvery !== 0) return;
    xLabels += `<text x="${x(i)}" y="${H - padB + 16}" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="var(--ink-soft)">${s.label}</text>`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
    ${grid}
    ${paths}
    <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="var(--ink)" stroke-width="1"></line>
    ${xLabels}
  </svg>`;
}

/* ---------- metric toggle ---------- */

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("metricToggle");
  if (!toggle) return;
  toggle.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      METRIC = btn.dataset.metric;
      toggle.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === btn));
      render();
    });
  });
});
