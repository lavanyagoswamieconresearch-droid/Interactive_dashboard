/* ============================================================
   DATASET EXPLORER — configuration
   Edit CONFIG to point at your own CSV and describe its columns.
   Everything below CONFIG is generic and reads this object only.
   ============================================================ */
const CONFIG = {
  csvPath: "data/sample.csv",
  title: "Dataset Explorer",
  subtitle: "Filter the sample, watch the numbers move.",

  // Sliders. Min/max are auto-detected from the data at load time.
  rangeFilters: [
    { column: "age", label: "Age" }
  ],

  // Radio button filters (single choice + "All").
  radioFilters: [
    { column: "gender", label: "Gender" }
  ],

  // Checkbox filters (multi-select, all checked by default).
  checkboxFilters: [
    { column: "region", label: "Region" }
  ],

  // Numeric columns to summarise as count/mean/median/std/min/max cards.
  numericStats: [
    { column: "age", label: "Age" },
    { column: "income", label: "Income", prefix: "$" },
    { column: "satisfaction", label: "Satisfaction (1–5)" }
  ],

  // Categorical columns to show as % breakdown bars.
  categoricalBreakdowns: [
    { column: "gender", label: "Gender split" },
    { column: "region", label: "Region split" }
  ]
};
/* ============================================================
   Generic engine — no need to edit below this line
   ============================================================ */

let RAW_DATA = [];
let ACTIVE = { ranges: {}, radios: {}, checkboxes: {} };

document.getElementById("appTitle").textContent = CONFIG.title;
document.getElementById("appSubtitle").textContent = CONFIG.subtitle;

Papa.parse(CONFIG.csvPath, {
  download: true,
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  complete: (results) => {
    RAW_DATA = results.data;
    initFilters();
    render();
  },
  error: (err) => {
    document.getElementById("filterControls").innerHTML =
      `<p style="color:#B0413E;font-size:13px;">Could not load ${CONFIG.csvPath}. Check the path in js/app.js → CONFIG.csvPath.</p>`;
    console.error(err);
  }
});

function initFilters() {
  const container = document.getElementById("filterControls");
  container.innerHTML = "";

  CONFIG.rangeFilters.forEach(f => {
    const vals = RAW_DATA.map(r => r[f.column]).filter(v => typeof v === "number" && !isNaN(v));
    const dataMin = Math.min(...vals);
    const dataMax = Math.max(...vals);
    ACTIVE.ranges[f.column] = { min: dataMin, max: dataMax, dataMin, dataMax };
    container.appendChild(buildRangeBlock(f, dataMin, dataMax));
  });

  CONFIG.radioFilters.forEach(f => {
    const options = uniqueValues(f.column);
    ACTIVE.radios[f.column] = "All";
    container.appendChild(buildRadioBlock(f, options));
  });

  CONFIG.checkboxFilters.forEach(f => {
    const options = uniqueValues(f.column);
    ACTIVE.checkboxes[f.column] = new Set(options);
    container.appendChild(buildCheckboxBlock(f, options));
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    CONFIG.rangeFilters.forEach(f => {
      const d = ACTIVE.ranges[f.column];
      d.min = d.dataMin; d.max = d.dataMax;
    });
    CONFIG.radioFilters.forEach(f => { ACTIVE.radios[f.column] = "All"; });
    CONFIG.checkboxFilters.forEach(f => {
      ACTIVE.checkboxes[f.column] = new Set(uniqueValues(f.column));
    });
    initFilters();
    render();
  });
}

function uniqueValues(column) {
  return [...new Set(RAW_DATA.map(r => r[column]).filter(v => v !== undefined && v !== null && v !== ""))]
    .sort();
}

/* ---------- filter block builders ---------- */

function buildRangeBlock(f, dataMin, dataMax) {
  const wrap = document.createElement("div");
  wrap.className = "filter-block";
  const state = ACTIVE.ranges[f.column];

  wrap.innerHTML = `
    <div class="filter-label">
      <span>${f.label}</span>
      <span class="val" data-role="val">${state.min}–${state.max}</span>
    </div>
    <div class="range-wrap">
      <div class="range-track"></div>
      <div class="range-fill" data-role="fill"></div>
      <input type="range" min="${dataMin}" max="${dataMax}" value="${state.min}" data-role="lo">
      <input type="range" min="${dataMin}" max="${dataMax}" value="${state.max}" data-role="hi">
    </div>
    <div class="range-minmax"><span>${dataMin}</span><span>${dataMax}</span></div>
  `;

  const lo = wrap.querySelector('[data-role="lo"]');
  const hi = wrap.querySelector('[data-role="hi"]');
  const fill = wrap.querySelector('[data-role="fill"]');
  const valLabel = wrap.querySelector('[data-role="val"]');

  function updateFillVisual() {
    const span = dataMax - dataMin || 1;
    const loPct = ((state.min - dataMin) / span) * 100;
    const hiPct = ((state.max - dataMin) / span) * 100;
    fill.style.left = loPct + "%";
    fill.style.width = Math.max(0, hiPct - loPct) + "%";
    valLabel.textContent = `${state.min}–${state.max}`;
  }

  lo.addEventListener("input", () => {
    state.min = Math.min(Number(lo.value), state.max);
    lo.value = state.min;
    updateFillVisual();
    render();
  });
  hi.addEventListener("input", () => {
    state.max = Math.max(Number(hi.value), state.min);
    hi.value = state.max;
    updateFillVisual();
    render();
  });

  updateFillVisual();
  return wrap;
}

function buildRadioBlock(f, options) {
  const wrap = document.createElement("div");
  wrap.className = "filter-block";
  const groupName = `radio-${f.column}`;

  let rows = `
    <label class="opt-row">
      <input type="radio" name="${groupName}" value="All" checked>
      <span>All</span>
      <span class="opt-count">${RAW_DATA.length}</span>
    </label>`;
  options.forEach(opt => {
    const n = RAW_DATA.filter(r => r[f.column] === opt).length;
    rows += `
      <label class="opt-row">
        <input type="radio" name="${groupName}" value="${opt}">
        <span>${opt}</span>
        <span class="opt-count">${n}</span>
      </label>`;
  });

  wrap.innerHTML = `
    <div class="filter-label"><span>${f.label}</span></div>
    <div class="opt-group">${rows}</div>
  `;

  wrap.querySelectorAll(`input[name="${groupName}"]`).forEach(input => {
    input.addEventListener("change", () => {
      ACTIVE.radios[f.column] = input.value;
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
    const n = RAW_DATA.filter(r => r[f.column] === opt).length;
    rows += `
      <label class="opt-row">
        <input type="checkbox" value="${opt}" checked>
        <span>${opt}</span>
        <span class="opt-count">${n}</span>
      </label>`;
  });

  wrap.innerHTML = `
    <div class="filter-label"><span>${f.label}</span></div>
    <div class="opt-group">${rows}</div>
  `;

  wrap.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener("change", () => {
      const set = ACTIVE.checkboxes[f.column];
      if (input.checked) set.add(input.value); else set.delete(input.value);
      render();
    });
  });

  return wrap;
}

/* ---------- filtering + stats ---------- */

function getFilteredData() {
  return RAW_DATA.filter(row => {
    for (const f of CONFIG.rangeFilters) {
      const s = ACTIVE.ranges[f.column];
      const v = row[f.column];
      if (typeof v !== "number" || v < s.min || v > s.max) return false;
    }
    for (const f of CONFIG.radioFilters) {
      const sel = ACTIVE.radios[f.column];
      if (sel !== "All" && row[f.column] !== sel) return false;
    }
    for (const f of CONFIG.checkboxFilters) {
      const set = ACTIVE.checkboxes[f.column];
      if (!set.has(row[f.column])) return false;
    }
    return true;
  });
}

function computeNumericStats(rows, column) {
  const vals = rows.map(r => r[column]).filter(v => typeof v === "number" && !isNaN(v));
  if (vals.length === 0) return null;
  const n = vals.length;
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const sorted = [...vals].sort((a, b) => a - b);
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[(n - 1) / 2];
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  return {
    n,
    mean, median, std,
    min: sorted[0],
    max: sorted[n - 1]
  };
}

function fmt(num, prefix) {
  if (num === undefined || num === null || isNaN(num)) return "—";
  const rounded = Math.abs(num) >= 100 ? Math.round(num) : Math.round(num * 100) / 100;
  const withCommas = rounded.toLocaleString();
  return (prefix || "") + withCommas;
}

/* ---------- render ---------- */

function render() {
  const filtered = getFilteredData();

  // signature gauge
  const total = RAW_DATA.length;
  const count = filtered.length;
  const pct = total ? Math.round((count / total) * 100) : 0;
  document.getElementById("gaugeFill").style.width = pct + "%";
  document.getElementById("gaugeCount").textContent = count;
  document.getElementById("gaugeTotal").textContent = total;
  document.getElementById("gaugePct").textContent = `(${pct}%)`;

  // stat cards
  const statsGrid = document.getElementById("statsGrid");
  statsGrid.innerHTML = "";
  CONFIG.numericStats.forEach(f => {
    const s = computeNumericStats(filtered, f.column);
    const card = document.createElement("div");
    card.className = "stat-card" + (s ? "" : " empty");
    if (!s) {
      card.innerHTML = `<h3>${f.label}</h3><div class="stat-rows">No matching records</div>`;
    } else {
      card.innerHTML = `
        <h3>${f.label}</h3>
        <div class="stat-rows">
          <div class="stat-row"><span class="k">Count</span><span class="v">${s.n}</span></div>
          <div class="stat-row"><span class="k">Mean</span><span class="v">${fmt(s.mean, f.prefix)}</span></div>
          <div class="stat-row"><span class="k">Median</span><span class="v">${fmt(s.median, f.prefix)}</span></div>
          <div class="stat-row"><span class="k">Std dev</span><span class="v">${fmt(s.std, f.prefix)}</span></div>
          <div class="stat-row"><span class="k">Min – Max</span><span class="v">${fmt(s.min, f.prefix)} – ${fmt(s.max, f.prefix)}</span></div>
        </div>
      `;
    }
    statsGrid.appendChild(card);
  });

  // breakdown bars
  const breakdowns = document.getElementById("breakdowns");
  breakdowns.innerHTML = "";
  CONFIG.categoricalBreakdowns.forEach(f => {
    const card = document.createElement("div");
    card.className = "breakdown-card";
    const counts = {};
    filtered.forEach(r => {
      const v = r[f.column];
      if (v === undefined || v === null || v === "") return;
      counts[v] = (counts[v] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const maxN = entries.length ? entries[0][1] : 0;

    let rows = entries.map(([label, n]) => `
      <div class="bar-row">
        <span class="label">${label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${maxN ? (n / maxN) * 100 : 0}%"></div></div>
        <span class="n">${n}</span>
      </div>
    `).join("");

    if (!entries.length) rows = `<p style="font-size:12px;color:var(--ink-soft);font-style:italic;">No matching records</p>`;

    card.innerHTML = `<h3>${f.label}</h3>${rows}`;
    breakdowns.appendChild(card);
  });
}
