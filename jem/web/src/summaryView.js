// JEM — Summary View
// Landing page: stat band, risk-distribution small multiples, high-risk registry, all-entities table.

import { State } from './state.js';

const RISK_COLORS = {
  low:      '#16a34a',
  moderate: '#d97706',
  high:     '#dc2626',
  severe:   '#7c3aed',
};

const RISK_ORDER = ['severe', 'high', 'moderate', 'low'];

const CLUSTER_LABELS = {
  constitutional_courts:   'Constitutional Courts',
  tribunals_adr:           'Tribunals & ADR',
  regulatory_bodies:       'Regulators',
  consumer_redressal:      'Consumer',
  arbitration:             'Arbitration',
  executive_interface:     'Executive Interface',
  digital_infrastructure:  'Digital Infrastructure',
  financing_audit:         'Finance & Audit',
  training_professional:   'Training & Professional',
  appointment_bodies:      'Appointment Bodies',
  legislative_executive:   'Legislative / Executive',
  subordinate_courts:      'Subordinate Courts',
  security:                'Security',
  people_roles:            'People / Roles',
};

// Clusters where IR scores are not computed
const SCORE_EXCLUDED_CLUSTERS = new Set(['legislative_executive', 'people_roles']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function riskLevelLabel(level) {
  if (!level) return '—';
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function statusPill(e) {
  if (e.operational_status === 'Not_Constituted') return '<span class="sum-pill sum-pill-nc">NC</span>';
  if (e.operational_status === 'Abolished') return '<span class="sum-pill sum-pill-abolished">Abolished</span>';
  if (e.operational_status === 'Partial_Operational') return '<span class="sum-pill sum-pill-partial">Partial</span>';
  return '';
}

function computeAvgDisposalRate(entities) {
  const withRate = entities.filter(e => e._detail?.case_volume?.disposal_rate != null);
  if (!withRate.length) return null;
  const avg = withRate.reduce((s, e) => s + e._detail.case_volume.disposal_rate, 0) / withRate.length;
  return avg.toFixed(2);
}

function typeLabel(type) {
  if (!type) return '—';
  return type.replace(/([A-Z])/g, ' $1').trim();
}

function govLevelLabel(level) {
  const MAP = {
    Central:             'Central',
    State:               'State',
    UT:                  'UT',
    Shared_MultiState:   'Multi-State',
    Shared_CentralState: 'Central–State',
  };
  return MAP[level] || level || '—';
}

function irScoreToLevel(score) {
  if (score >= 9) return 'severe';
  if (score >= 6) return 'high';
  if (score >= 3) return 'moderate';
  return 'low';
}

// ── Bubble strip plot ─────────────────────────────────────────────────────────
// One row per cluster. X = structural_health score (0.0–1.0, MASTER composite).
// Left = critical, right = healthy. Bubble area ∝ entity count at that health
// bucket. Color = health band. Click bubble → drill-down with IR + DP
// constituent breakdowns for the entities at that bucket.

const HEALTH_MAX  = 1.0;
const HEALTH_BUCKET = 0.05;    // group entities into 0.05-wide health buckets
const ROW_H       = 40;        // px per cluster row
const LABEL_W     = 148;       // px for left cluster label column
const AXIS_H      = 28;        // px for x-axis
const HEADER_H    = 18;        // px for column header
const PLOT_PAD_R  = 20;        // right padding
const MAX_BUBBLE_R = 15;       // max bubble radius in px

// Health bands (matching derive.py + ring legend)
const HEALTH_COLORS = {
  critical: '#e74c3c',
  at_risk:  '#f39c12',
  watch:    '#f1c40f',
  healthy:  '#27ae60',
};
// Zones listed left→right in display order (reversed: healthy on left, critical on right).
const HEALTH_ZONES = [
  { x0: 0.8, x1: 1.0, level: 'healthy',  fill: '#f0fdf4' },
  { x0: 0.6, x1: 0.8, level: 'watch',    fill: '#fefce8' },
  { x0: 0.3, x1: 0.6, level: 'at_risk',  fill: '#fff7ed' },
  { x0: 0.0, x1: 0.3, level: 'critical', fill: '#fef2f2' },
];

const HEALTH_LEVEL_LABELS = {
  critical: 'Critical',
  at_risk:  'At Risk',
  watch:    'Watch',
  healthy:  'Healthy',
};

function healthLevelLabel(level) {
  return HEALTH_LEVEL_LABELS[level] || (level || '—');
}

// Reversed axis: health=1.0 → left edge, health=0.0 → right edge.
function scoreToX(score, plotW) {
  return LABEL_W + ((HEALTH_MAX - score) / HEALTH_MAX) * plotW;
}

function healthBandFor(score) {
  if (score == null) return null;
  if (score < 0.3) return 'critical';
  if (score < 0.6) return 'at_risk';
  if (score < 0.8) return 'watch';
  return 'healthy';
}

function buildStripData(entities) {
  // For each cluster: Map of bucket → { count, level, entityIds, irAvg, dpAvg }
  const clusters = {};
  entities.forEach(e => {
    const cl = e.cluster;
    if (!cl || SCORE_EXCLUDED_CLUSTERS.has(cl)) return;
    const health = e.derived?.structural_health_score;
    if (health == null) return;
    const bucket = Math.round(health / HEALTH_BUCKET) * HEALTH_BUCKET;
    const key = bucket.toFixed(2);
    const level = healthBandFor(bucket);
    if (!clusters[cl]) clusters[cl] = {};
    if (!clusters[cl][key]) {
      clusters[cl][key] = { count: 0, level, ids: [], irSum: 0, dpSum: 0, bucket };
    }
    const slot = clusters[cl][key];
    slot.count++;
    slot.ids.push(e.id);
    slot.irSum += e.derived?.independence_risk_score || 0;
    slot.dpSum += e.derived?.discretionary_power_score || 0;
  });

  // Sort clusters by weighted avg health (worst — lowest health — first)
  return Object.entries(clusters)
    .filter(([, pts]) => Object.keys(pts).length > 0)
    .map(([cl, pts]) => {
      const entries = Object.entries(pts).map(([, d]) => ({
        score: d.bucket,
        count: d.count,
        level: d.level,
        ids: d.ids,
        irAvg: d.irSum / d.count,
        dpAvg: d.dpSum / d.count,
      }));
      const total = entries.reduce((s, d) => s + d.count, 0);
      const wavg = entries.reduce((s, d) => s + d.score * d.count, 0) / (total || 1);
      return { cl, entries, total, wavg };
    })
    .sort((a, b) => a.wavg - b.wavg);
}

function renderStripPlot(entities, svgWidth) {
  const plotW = svgWidth - LABEL_W - PLOT_PAD_R;
  const rows  = buildStripData(entities);
  const svgH  = HEADER_H + rows.length * ROW_H + AXIS_H;

  let svg = `<svg class="strip-svg" viewBox="0 0 ${svgWidth} ${svgH}"
    role="img" aria-label="Structural health distribution by cluster">`;

  // ── Background health zones ────────────────────────────────────────────────
  const zonesY = HEADER_H;
  const zonesH = rows.length * ROW_H;
  HEALTH_ZONES.forEach(z => {
    const xa = scoreToX(z.x0, plotW);
    const xb = scoreToX(z.x1, plotW);
    const zx = Math.min(xa, xb);
    const zw = Math.abs(xb - xa);
    svg += `<rect x="${zx}" y="${zonesY}" width="${zw}" height="${zonesH}"
      fill="${z.fill}" />`;
  });

  // ── Zone label row (header) ────────────────────────────────────────────────
  HEALTH_ZONES.forEach(z => {
    const zx = scoreToX((z.x0 + z.x1) / 2, plotW);
    svg += `<text x="${zx}" y="${HEADER_H - 5}" text-anchor="middle"
      font-size="9" fill="${HEALTH_COLORS[z.level]}" font-weight="600"
      opacity="0.85">${healthLevelLabel(z.level)}</text>`;
  });

  // ── Vertical grid lines at band boundaries ────────────────────────────────
  [0.0, 0.3, 0.6, 0.8, 1.0].forEach(tick => {
    const gx = scoreToX(tick, plotW);
    svg += `<line x1="${gx}" y1="${HEADER_H}" x2="${gx}" y2="${HEADER_H + zonesH}"
      stroke="#ddd" stroke-width="1" />`;
  });

  // ── Row dividers ───────────────────────────────────────────────────────────
  rows.forEach((_, i) => {
    const ry = HEADER_H + i * ROW_H;
    svg += `<line x1="0" y1="${ry}" x2="${svgWidth}" y2="${ry}"
      stroke="#ebebeb" stroke-width="1" />`;
  });

  // ── Row hover background rects (transparent; JS sets fill on hover) ────────
  rows.forEach(({ cl }, i) => {
    const ry = HEADER_H + i * ROW_H;
    svg += `<rect class="strip-row-bg" data-cluster-id="${cl}"
      x="0" y="${ry}" width="${svgWidth}" height="${ROW_H}"
      fill="transparent" pointer-events="none" />`;
  });

  // ── Center guide lines (baseline for each cluster row) ────────────────────
  rows.forEach((_, i) => {
    const cy = HEADER_H + i * ROW_H + ROW_H / 2;
    svg += `<line class="strip-guide"
      x1="${LABEL_W}" y1="${cy}" x2="${svgWidth - PLOT_PAD_R}" y2="${cy}"
      stroke="#d8d8d3" stroke-width="0.75" stroke-dasharray="3 4"
      pointer-events="none" />`;
  });

  // ── Cluster labels + bubbles ───────────────────────────────────────────────
  rows.forEach(({ cl, entries, total }, ri) => {
    const cy = HEADER_H + ri * ROW_H + ROW_H / 2;
    const label = CLUSTER_LABELS[cl] || cl;
    const shortLabel = label.length > 22 ? label.slice(0, 20) + '…' : label;

    // Cluster label (left column, clickable — opens drill-down for whole cluster)
    svg += `<text class="strip-cluster-label" data-cluster-id="${cl}"
      x="${LABEL_W - 8}" y="${cy + 4}" text-anchor="end"
      font-size="11" fill="#33332e" cursor="pointer">
      ${shortLabel}
      <title>Click to see all ${total} ${label} entities</title>
    </text>`;
    svg += `<text x="${LABEL_W - 8}" y="${cy + 15}" text-anchor="end"
      font-size="9" fill="#86857c">${total}</text>`;

    // Bubbles — one per health bucket in this cluster
    entries.forEach(({ score, count, level, ids, irAvg, dpAvg }) => {
      const bx = scoreToX(score, plotW);
      const r  = Math.min(MAX_BUBBLE_R, Math.max(3, Math.sqrt(count) * 2.8));
      const color = HEALTH_COLORS[level] || '#aaa';
      const encodedIds = encodeURIComponent(JSON.stringify(ids));
      const titleText = `${count} ${count === 1 ? 'entity' : 'entities'} · ${label}
Health ≈ ${score.toFixed(2)} (${healthLevelLabel(level)})
  ↳ IR avg ${irAvg.toFixed(1)} · DP avg ${dpAvg.toFixed(1)}`;

      svg += `<circle class="strip-bubble"
        cx="${bx}" cy="${cy}" r="${r}"
        fill="${color}" fill-opacity="0.75"
        stroke="${color}" stroke-width="1" stroke-opacity="0.9"
        data-cluster-id="${cl}" data-score="${score.toFixed(2)}" data-ids="${encodedIds}"
        cursor="pointer" style="transition:opacity .15s">
        <title>${titleText}</title>
      </circle>`;

      // Count label inside bubble if it fits
      if (r >= 10) {
        svg += `<text x="${bx}" y="${cy + 4}" text-anchor="middle"
          font-size="${Math.min(10, r * 0.85)}" fill="#fff" font-weight="600"
          pointer-events="none">${count}</text>`;
      }
    });
  });

  // ── X axis ────────────────────────────────────────────────────────────────
  const axisY = HEADER_H + zonesH + 4;
  svg += `<line x1="${LABEL_W}" y1="${axisY}" x2="${svgWidth - PLOT_PAD_R}" y2="${axisY}"
    stroke="#ccc" stroke-width="1" />`;
  [1.0, 0.8, 0.6, 0.4, 0.2, 0.0].forEach(tick => {
    const tx = scoreToX(tick, plotW);
    svg += `<text x="${tx}" y="${axisY + 13}" text-anchor="middle"
      font-size="9" fill="#86857c">${tick.toFixed(1)}</text>`;
  });
  svg += `<text x="${LABEL_W + plotW / 2}" y="${axisY + 24}" text-anchor="middle"
    font-size="9" fill="#86857c">← Healthy · Structural Health · Critical →</text>`;

  svg += `</svg>`;
  return svg;
}

// ── High-risk entity registry ─────────────────────────────────────────────────

// ── Spotlight carousel ────────────────────────────────────────────────────────
// Featured set: critical + at_risk entities, worst-first. One large card per slide.

function spotlightSet(entities) {
  return entities
    .filter(e => {
      const lvl = e.derived?.structural_health_level;
      return lvl === 'critical' || lvl === 'at_risk';
    })
    .sort((a, b) =>
      (a.derived?.structural_health_score ?? 999) - (b.derived?.structural_health_score ?? 999)
    );
}

function topFactors(breakdown, n = 3) {
  if (!breakdown) return [];
  return Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function renderSpotlightCard(e) {
  const d = e.derived || {};
  const health = d.structural_health_score;
  const healthLvl = d.structural_health_level || healthBandFor(health);
  const healthColor = HEALTH_COLORS[healthLvl] || '#aaa';
  const healthPct = health != null ? Math.max(0, Math.min(100, health * 100)) : 0;

  const irLvl = d.independence_risk_level;
  const irColor = RISK_COLORS[irLvl] || '#6b7280';
  const ir = d.independence_risk_score;
  const dp = d.discretionary_power_score;

  const irFactors = topFactors(d.independence_risk_breakdown, 3);
  const dpFactors = topFactors(d.discretionary_power_breakdown, 3);

  const factorList = (rows, color) => rows.length
    ? rows.map(([reason, pts]) => `
        <div class="dr-bd-row">
          <span class="dr-bd-pts" style="color:${color}">+${pts}</span>
          <span class="dr-bd-reason">${reason}</span>
        </div>`).join('')
    : '<div class="dr-empty">No leaf factors recorded.</div>';

  const meta = [
    e.created_year ? `Est. ${e.created_year}` : null,
    govLevelLabel(e.level_of_government),
    typeLabel(e.type),
  ].filter(Boolean).join(' · ');

  return `<article class="sp-card" data-entity-id="${e.id}">
    <header class="sp-card-head">
      <div class="sp-card-name">${e.name}${statusPill(e)}</div>
      <div class="sp-card-band" style="background:${healthColor}1a;color:${healthColor};border:1px solid ${healthColor}66">
        ${healthLevelLabel(healthLvl).toUpperCase()}
      </div>
    </header>

    <div class="sp-card-master">
      <div class="sp-card-master-row">
        <span class="sp-card-master-label">Structural Health</span>
        <span class="sp-card-master-number" style="color:${healthColor}">${health != null ? health.toFixed(2) : '—'}</span>
      </div>
      <div class="sp-card-master-bar">
        <div class="sp-card-master-fill" style="width:${healthPct}%;background:${healthColor}"></div>
      </div>
    </div>

    <div class="sp-card-constituents">
      <div class="sp-card-const-col">
        <div class="sp-card-const-head" style="color:${irColor}">
          ↳ Independence Risk · ${ir ?? '—'}${irLvl ? ' · ' + irLvl.toUpperCase() : ''}
        </div>
        ${factorList(irFactors, irColor)}
      </div>
      <div class="sp-card-const-col">
        <div class="sp-card-const-head" style="color:#6366f1">
          ↳ Discretionary Power · ${dp ?? '—'}
        </div>
        ${factorList(dpFactors, '#6366f1')}
      </div>
    </div>

    <div class="sp-card-meta">${meta}</div>

    <div class="sp-card-actions">
      <button class="sp-action sp-open" data-entity-id="${e.id}">Open profile →</button>
      <button class="sp-action sp-report" data-entity-id="${e.id}">↓ Report</button>
    </div>
  </article>`;
}

function renderSpotlightCarousel(featured, totalEntities) {
  if (!featured.length) {
    return `<div class="sp-empty">
      <p>No entities are currently in critical or at-risk health bands.</p>
      <button class="sp-browse-all" id="sp-browse-all">Browse all ${totalEntities} entities →</button>
    </div>`;
  }
  const cards = featured.map(renderSpotlightCard).join('');
  const useDots = featured.length <= 10;
  const dots = useDots
    ? featured.map((_, i) => `<button class="sp-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Go to card ${i + 1}"></button>`).join('')
    : '';
  return `<div class="sp-carousel" tabindex="0">
    <button class="sp-arrow sp-arrow-prev" aria-label="Previous">‹</button>
    <div class="sp-viewport">
      <div class="sp-track" id="sp-track" style="transform:translateX(0%)">${cards}</div>
    </div>
    <button class="sp-arrow sp-arrow-next" aria-label="Next">›</button>
    <div class="sp-footer">
      <div class="sp-progress">
        ${useDots
          ? `<div class="sp-dots">${dots}</div>`
          : `<span class="sp-counter"><span id="sp-counter-i">1</span> / ${featured.length}</span>`}
      </div>
      <div class="sp-footer-right">
        <span class="sp-footer-label"><span id="sp-counter-label">${featured.length}</span> critical &amp; at-risk</span>
        <button class="sp-browse-all" id="sp-browse-all">Browse all ${totalEntities} →</button>
      </div>
    </div>
  </div>`;
}

// ── Catalog drawer (full entity list, slide-in) ───────────────────────────────

const _drawerState = { rendered: false, search: '', band: 'all' };

function entityMatchesSearch(e, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (e.name || '').toLowerCase().includes(needle)
    || (e.abbreviation || '').toLowerCase().includes(needle);
}

function renderDrawerList(entities) {
  const filtered = entities
    .filter(e => {
      if (_drawerState.band !== 'all') {
        const lvl = e.derived?.structural_health_level;
        if (_drawerState.band === 'unscored') {
          if (lvl) return false;
        } else if (lvl !== _drawerState.band) return false;
      }
      return entityMatchesSearch(e, _drawerState.search);
    });

  if (!filtered.length) {
    return '<p class="cat-drawer-empty">No entities match the current filter.</p>';
  }

  // Group by cluster
  const grouped = {};
  filtered.forEach(e => {
    const cl = e.cluster || '_unknown';
    (grouped[cl] ||= []).push(e);
  });

  const clusterIds = Object.keys(grouped).sort((a, b) => {
    const aw = grouped[a].reduce((s, e) => s + (e.derived?.structural_health_score ?? 1), 0) / grouped[a].length;
    const bw = grouped[b].reduce((s, e) => s + (e.derived?.structural_health_score ?? 1), 0) / grouped[b].length;
    return aw - bw;
  });

  return clusterIds.map(cl => {
    const members = grouped[cl].slice().sort((a, b) =>
      (a.derived?.structural_health_score ?? 999) - (b.derived?.structural_health_score ?? 999)
    );
    const rows = members.map(e => {
      const d = e.derived || {};
      const lvl = d.structural_health_level || healthBandFor(d.structural_health_score);
      const color = lvl ? (HEALTH_COLORS[lvl] || '#aaa') : '#aaa';
      const health = d.structural_health_score;
      return `<button class="cat-row" data-entity-id="${e.id}" data-report="0">
        <span class="cat-row-health" style="color:${color}">${health != null ? health.toFixed(2) : '—'}</span>
        <span class="cat-row-name">${e.name}${statusPill(e)}</span>
        <span class="cat-row-ir">IR ${d.independence_risk_score ?? '—'}</span>
        <span class="cat-row-dp">DP ${d.discretionary_power_score ?? '—'}</span>
        <span class="cat-row-report" data-report="1" data-entity-id="${e.id}" title="Jump to entity report">↓</span>
      </button>`;
    }).join('');
    return `<section class="cat-drawer-cluster">
      <header class="cat-drawer-cluster-head">
        <span>${CLUSTER_LABELS[cl] || cl}</span>
        <span class="cat-drawer-cluster-count">${members.length}</span>
      </header>
      <div class="cat-drawer-rows">${rows}</div>
    </section>`;
  }).join('');
}

function renderCatalogDrawer(entities) {
  const bands = ['all', 'critical', 'at_risk', 'watch', 'healthy', 'unscored'];
  const bandLabel = {
    all: 'All',
    critical: 'Critical',
    at_risk: 'At Risk',
    watch: 'Watch',
    healthy: 'Healthy',
    unscored: 'Unscored',
  };
  const chips = bands.map(b => `
    <button class="cat-drawer-chip${b === _drawerState.band ? ' active' : ''}" data-band="${b}">${bandLabel[b]}</button>
  `).join('');

  return `<header class="cat-drawer-head">
      <div class="cat-drawer-title">Browse all ${entities.length} entities</div>
      <button class="cat-drawer-close" id="cat-drawer-close" aria-label="Close">✕</button>
    </header>
    <div class="cat-drawer-controls">
      <input type="search" class="cat-drawer-search" id="cat-drawer-search"
        placeholder="Search by name or abbreviation…" value="${_drawerState.search}">
      <div class="cat-drawer-chips" role="group" aria-label="Health band filter">${chips}</div>
    </div>
    <div class="cat-drawer-list" id="cat-drawer-list">${renderDrawerList(entities)}</div>`;
}

// ── Cluster drill-down overlay ────────────────────────────────────────────────

function buildFactorFrequency(members, breakdownKey) {
  const counts = new Map();
  members.forEach(e => {
    const bd = (e.derived || {})[breakdownKey];
    if (!bd) return;
    for (const [reason, pts] of Object.entries(bd)) {
      if (!counts.has(reason)) counts.set(reason, { count: 0, total: 0 });
      const slot = counts.get(reason);
      slot.count++;
      slot.total += pts;
    }
  });
  return [...counts.entries()]
    .map(([reason, v]) => ({ reason, count: v.count, total: v.total }))
    .sort((a, b) => b.count - a.count || b.total - a.total);
}

function renderPatternTab(members) {
  const healthValues = members.map(e => e.derived?.structural_health_score).filter(v => v != null);
  const irValues = members.map(e => e.derived?.independence_risk_score).filter(v => v != null);
  const dpValues = members.map(e => e.derived?.discretionary_power_score).filter(v => v != null);

  const avgHealth = healthValues.length ? healthValues.reduce((s, v) => s + v, 0) / healthValues.length : null;
  const avgIR = irValues.length ? irValues.reduce((s, v) => s + v, 0) / irValues.length : null;
  const avgDP = dpValues.length ? dpValues.reduce((s, v) => s + v, 0) / dpValues.length : null;

  const irFactors = buildFactorFrequency(members, 'independence_risk_breakdown').slice(0, 6);
  const dpFactors = buildFactorFrequency(members, 'discretionary_power_breakdown').slice(0, 6);

  const factorRow = (f, n) => `
    <div class="dr-factor-row">
      <span class="dr-factor-reason">${f.reason}</span>
      <span class="dr-factor-count">${f.count}/${n}</span>
      <span class="dr-factor-points">+${f.total} pts</span>
    </div>`;

  const avgHealthColor = avgHealth != null ? (HEALTH_COLORS[healthBandFor(avgHealth)] || '#aaa') : '#aaa';

  return `
    <div class="dr-pattern">
      <div class="dr-stat-band">
        <div class="dr-stat">
          <div class="dr-stat-lbl">Avg Health</div>
          <div class="dr-stat-num" style="color:${avgHealthColor}">${avgHealth != null ? avgHealth.toFixed(2) : '—'}</div>
        </div>
        <div class="dr-stat">
          <div class="dr-stat-lbl">Avg IR</div>
          <div class="dr-stat-num">${avgIR != null ? avgIR.toFixed(1) : '—'}</div>
        </div>
        <div class="dr-stat">
          <div class="dr-stat-lbl">Avg DP</div>
          <div class="dr-stat-num">${avgDP != null ? avgDP.toFixed(1) : '—'}</div>
        </div>
      </div>

      <div class="dr-section">
        <div class="dr-section-title">Recurring IR factors</div>
        <p class="dr-section-hint">Each row: how many entities in this bucket share the factor, and total points contributed.</p>
        ${irFactors.length
          ? irFactors.map(f => factorRow(f, members.length)).join('')
          : '<p class="dr-empty">No IR breakdown data.</p>'}
      </div>

      <div class="dr-section">
        <div class="dr-section-title">Recurring DP factors</div>
        ${dpFactors.length
          ? dpFactors.map(f => factorRow(f, members.length)).join('')
          : '<p class="dr-empty">No DP breakdown data.</p>'}
      </div>
    </div>`;
}

function renderEntityBreakdown(e) {
  const d = e.derived || {};
  const irBd = d.independence_risk_breakdown || {};
  const dpBd = d.discretionary_power_breakdown || {};
  const irRows = Object.entries(irBd).sort((a, b) => b[1] - a[1]);
  const dpRows = Object.entries(dpBd).sort((a, b) => b[1] - a[1]);
  const factorList = (rows, color) => rows.length
    ? rows.map(([reason, pts]) => `
        <div class="dr-bd-row">
          <span class="dr-bd-pts" style="color:${pts >= 0 ? color : '#16a34a'}">${pts >= 0 ? '+' : ''}${pts}</span>
          <span class="dr-bd-reason">${reason}</span>
        </div>`).join('')
    : '<div class="dr-empty">No breakdown.</div>';

  return `<div class="dr-expand-body">
    <div class="dr-expand-col">
      <div class="dr-expand-head">↳ Independence Risk · ${d.independence_risk_score ?? '—'} ${(d.independence_risk_level || '').toUpperCase()}</div>
      ${factorList(irRows, '#dc2626')}
    </div>
    <div class="dr-expand-col">
      <div class="dr-expand-head">↳ Discretionary Power · ${d.discretionary_power_score ?? '—'}</div>
      ${factorList(dpRows, '#6366f1')}
    </div>
    <div class="dr-expand-footer">
      <button class="dr-open-full" data-entity-id="${e.id}">Open full entity panel →</button>
    </div>
  </div>`;
}

function renderEntitiesTab(members) {
  if (!members.length) return `<p class="sum-empty">No entities in this bucket.</p>`;
  const rows = members.map((e) => {
    const d = e.derived || {};
    const health = d.structural_health_score;
    const healthLvl = d.structural_health_level || healthBandFor(health);
    const healthColor = HEALTH_COLORS[healthLvl] || '#aaa';
    const irLvl = d.independence_risk_level;
    const irColor = RISK_COLORS[irLvl] || '#aaa';
    return `<div class="dr-row" data-entity-row="${e.id}">
      <button class="dr-row-head" data-toggle-id="${e.id}" aria-expanded="false">
        <span class="dr-row-caret">▸</span>
        <span class="dr-row-health" style="color:${healthColor}">${health != null ? health.toFixed(2) : '—'}</span>
        <span class="dr-row-name">${e.name}${statusPill(e)}</span>
        <span class="dr-row-chips">
          <span class="reg-const-chip" style="color:${irColor};border-color:${irColor}66">IR ${d.independence_risk_score ?? '—'}${irLvl ? ' · ' + irLvl.charAt(0).toUpperCase() + irLvl.slice(1) : ''}</span>
          <span class="reg-const-chip reg-const-chip-dp">DP ${d.discretionary_power_score ?? '—'}</span>
        </span>
        <span class="dr-row-type">${e.type?.replace(/([A-Z])/g, ' $1').trim() || ''}</span>
      </button>
      <div class="dr-row-expand" data-expand-id="${e.id}" hidden>
        ${renderEntityBreakdown(e)}
      </div>
    </div>`;
  }).join('');
  return `<div class="dr-entities">${rows}</div>`;
}

function buildClusterDrillHTML(clusterId, entities, filterIds = null) {
  const label = CLUSTER_LABELS[clusterId] || clusterId;
  const idSet = filterIds ? new Set(filterIds) : null;
  const members = entities
    .filter(e => e.cluster === clusterId && (!idSet || idSet.has(e.id)))
    .sort((a, b) => (a.derived?.structural_health_score ?? 999) - (b.derived?.structural_health_score ?? 999));

  if (!members.length) return `<p class="sum-empty">No entities in this cluster.</p>`;

  return `<div class="cl-drill-header">
      <span class="cl-drill-title">${label}</span>
      <span class="cl-drill-count">${members.length} entities · sorted by worst health</span>
    </div>
    <div class="dr-tabs" role="tablist">
      <button class="dr-tab active" data-dr-tab="pattern" role="tab" aria-selected="true">Pattern</button>
      <button class="dr-tab" data-dr-tab="entities" role="tab" aria-selected="false">Entities (${members.length})</button>
    </div>
    <div class="dr-pane" data-dr-pane="pattern">${renderPatternTab(members)}</div>
    <div class="dr-pane dr-pane-hidden" data-dr-pane="entities">${renderEntitiesTab(members)}</div>`;
}

function showClusterDrill(clusterId, entities, container, filterIds = null) {
  let overlay = container.querySelector('#cluster-drill-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'cluster-drill-overlay';
    overlay.className = 'cl-drill-overlay';
    container.querySelector('.sum-inner').appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="cl-drill-card">
      <button class="cl-drill-close" id="cl-drill-close" aria-label="Close">✕</button>
      <div class="cl-drill-body" id="cl-drill-body">
        ${buildClusterDrillHTML(clusterId, entities, filterIds)}
      </div>
    </div>
    <div class="cl-drill-backdrop" id="cl-drill-backdrop"></div>
  `;

  overlay.classList.remove('cl-drill-hidden');

  overlay.querySelector('#cl-drill-close')?.addEventListener('click', () => {
    overlay.classList.add('cl-drill-hidden');
  });
  overlay.querySelector('#cl-drill-backdrop')?.addEventListener('click', () => {
    overlay.classList.add('cl-drill-hidden');
  });
  overlay.querySelector('.cl-drill-body')?.addEventListener('click', e => {
    // Tab switch
    const tabBtn = e.target.closest('.dr-tab');
    if (tabBtn) {
      const tab = tabBtn.dataset.drTab;
      overlay.querySelectorAll('.dr-tab').forEach(t => {
        const active = t.dataset.drTab === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      overlay.querySelectorAll('.dr-pane').forEach(p => {
        p.classList.toggle('dr-pane-hidden', p.dataset.drPane !== tab);
      });
      return;
    }

    // Inline row expand
    const rowHead = e.target.closest('.dr-row-head');
    if (rowHead) {
      const id = rowHead.dataset.toggleId;
      const expand = overlay.querySelector(`[data-expand-id="${CSS.escape(id)}"]`);
      const caret = rowHead.querySelector('.dr-row-caret');
      if (expand) {
        const willOpen = expand.hasAttribute('hidden');
        if (willOpen) expand.removeAttribute('hidden'); else expand.setAttribute('hidden', '');
        rowHead.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (caret) caret.textContent = willOpen ? '▾' : '▸';
      }
      return;
    }

    // "Open full entity panel" button
    const openFull = e.target.closest('.dr-open-full');
    if (openFull) {
      e.preventDefault();
      overlay.classList.add('cl-drill-hidden');
      State.emit('navigateToDetail', openFull.dataset.entityId);
      return;
    }

    // Existing entity link (legacy / future)
    const link = e.target.closest('[data-entity-id]:not(.dr-open-full):not(.dr-row-head)');
    if (link) {
      e.preventDefault();
      overlay.classList.add('cl-drill-hidden');
      State.emit('navigateToDetail', link.dataset.entityId);
    }
  });
}

// ── Main render ───────────────────────────────────────────────────────────────

export function initSummaryView() {
  const graph = State.graph;
  if (!graph) return;

  const container = document.getElementById('summary-view');
  if (!container) return;

  const entities = graph.entities || [];
  const metrics = graph.impact_metrics || {};
  const avgDisposal = computeAvgDisposalRate(entities);

  const notConstitutedCount = metrics.not_constituted_count
    ?? entities.filter(e => e.operational_status === 'Not_Constituted').length;
  const highRiskCount = metrics.high_independence_risk_count
    ?? entities.filter(e => ['high', 'severe'].includes(e.derived?.independence_risk_level)).length;

  container.innerHTML = `
    <div class="sum-inner">

      <div class="sum-masthead">
        <h1 class="sum-title">Judiciary Entity Map — India</h1>
        <p class="sum-subtitle">Structural map of appointment chains, funding flows, independence risk, and systemic gaps across India's judicial ecosystem.</p>
      </div>

      <div class="stat-band">
        <div class="stat-item">
          <span class="stat-num">${entities.length}<span class="stat-denom"> / ~1,500</span></span>
          <span class="stat-lbl">Entities mapped</span>
        </div>
        <div class="stat-item stat-item-risk">
          <span class="stat-num">${highRiskCount}</span>
          <span class="stat-lbl">High or severe independence risk</span>
        </div>
        <div class="stat-item stat-item-nc">
          <span class="stat-num">${notConstitutedCount}</span>
          <span class="stat-lbl">Legislated but not constituted</span>
        </div>
        ${avgDisposal ? `<div class="stat-item">
          <span class="stat-num">${avgDisposal}</span>
          <span class="stat-lbl">Avg disposal rate (of entities with NJDG data)</span>
        </div>` : ''}
      </div>

      <div class="sm-section sp-section">
        <div class="sm-section-head">
          <span class="sm-section-title">Spotlight · critical &amp; at-risk entities</span>
        </div>
        <p class="sm-note-global">Each card is a preview of the entity's structural report. Step through with arrows or swipe.</p>
        ${renderSpotlightCarousel(spotlightSet(entities), entities.length)}
      </div>

      <div class="sm-section">
        <div class="sm-section-head">
          <span class="sm-section-title">Structural health distribution</span>
        </div>
        <p class="sm-note-global">Master composite of independence risk + discretionary power.
        Each bubble = entities at that health band; bubble area ∝ count.
        Click a bubble to drill into the constituent IR + DP scores for those entities.
        Legislative/executive bodies excluded (governance anchors).</p>
        <div class="strip-wrap" id="strip-plot-wrap"></div>
      </div>


    </div>
  `;

  // ── Render strip plot (sized to container after DOM paint) ───────────────
  requestAnimationFrame(() => {
    const wrap = container.querySelector('#strip-plot-wrap');
    if (wrap) {
      const w = Math.max(480, wrap.clientWidth || 560);
      wrap.innerHTML = renderStripPlot(entities, w);

      // Wire bubble clicks → drill-down filtered to that score
      wrap.addEventListener('click', ev => {
        const bubble = ev.target.closest('.strip-bubble');
        if (bubble) {
          const clusterId = bubble.dataset.clusterId;
          const score = +bubble.dataset.score;
          const ids = JSON.parse(decodeURIComponent(bubble.dataset.ids || '[]'));
          showClusterDrill(clusterId, entities, container, ids);
          return;
        }
        // Cluster label text → drill all entities in that cluster
        const labelText = ev.target.closest('.strip-cluster-label');
        if (labelText) {
          showClusterDrill(labelText.dataset.clusterId, entities, container);
        }
      });

      // Wire row hover highlighting
      const svgEl = wrap.querySelector('svg');
      if (svgEl) {
        const highlightCluster = (clusterId) => {
          svgEl.querySelectorAll('.strip-bubble').forEach(b => {
            const active = b.dataset.clusterId === clusterId;
            b.style.fillOpacity = active ? '0.9' : '0.1';
            b.style.strokeOpacity = active ? '1' : '0.1';
          });
          svgEl.querySelectorAll('.strip-cluster-label').forEach(t => {
            t.style.opacity = t.dataset.clusterId === clusterId ? '1' : '0.25';
            t.style.fontWeight = t.dataset.clusterId === clusterId ? '700' : '';
          });
          svgEl.querySelectorAll('.strip-guide').forEach((line, i) => {
            const rowCl = svgEl.querySelectorAll('.strip-row-bg')[i]?.dataset.clusterId;
            line.style.strokeOpacity = rowCl === clusterId ? '1' : '0.2';
          });
          svgEl.querySelectorAll('.strip-row-bg').forEach(r => {
            r.style.fill = r.dataset.clusterId === clusterId ? 'rgba(51,51,46,0.04)' : 'transparent';
          });
        };
        const resetHighlight = () => {
          svgEl.querySelectorAll('.strip-bubble').forEach(b => {
            b.style.fillOpacity = '';
            b.style.strokeOpacity = '';
          });
          svgEl.querySelectorAll('.strip-cluster-label').forEach(t => {
            t.style.opacity = '';
            t.style.fontWeight = '';
          });
          svgEl.querySelectorAll('.strip-guide').forEach(l => { l.style.strokeOpacity = ''; });
          svgEl.querySelectorAll('.strip-row-bg').forEach(r => { r.style.fill = 'transparent'; });
        };

        svgEl.addEventListener('mouseover', ev => {
          const el = ev.target.closest('[data-cluster-id]');
          if (el) highlightCluster(el.dataset.clusterId);
        });
        svgEl.addEventListener('mouseleave', resetHighlight);
      }
    }
  });

  // ── Wire spotlight carousel ────────────────────────────────────────────────
  const featured = spotlightSet(entities);
  wireSpotlightCarousel(container, featured);

  // ── Wire card actions, browse-all, generic entity links ───────────────────
  container.addEventListener('click', e => {
    const reportBtn = e.target.closest('.sp-report');
    if (reportBtn) {
      e.preventDefault();
      const id = reportBtn.dataset.entityId;
      try { sessionStorage.setItem('jem.autoExport', id); } catch (_) {}
      State.emit('navigateToDetail', id);
      return;
    }

    const openBtn = e.target.closest('.sp-open');
    if (openBtn) {
      e.preventDefault();
      State.emit('navigateToDetail', openBtn.dataset.entityId);
      return;
    }

    const browseBtn = e.target.closest('#sp-browse-all');
    if (browseBtn) {
      e.preventDefault();
      openCatalogDrawer(entities);
      return;
    }

    const entityLink = e.target.closest('[data-entity-id]');
    if (entityLink && !entityLink.closest('.sp-card-head')) {
      e.preventDefault();
      State.emit('navigateToDetail', entityLink.dataset.entityId);
    }
  });

}

// ── Spotlight carousel state + interaction ───────────────────────────────────

let _spotlightIndex = 0;
let _spotlightTimer = null;
const SPOTLIGHT_INTERVAL_MS = 6000;

function wireSpotlightCarousel(container, featured) {
  const carousel = container.querySelector('.sp-carousel');
  if (!carousel || !featured.length) return;

  const track = carousel.querySelector('#sp-track');
  const dots = [...carousel.querySelectorAll('.sp-dot')];
  const counterI = carousel.querySelector('#sp-counter-i');
  const total = featured.length;
  _spotlightIndex = 0;

  function goTo(i, opts = {}) {
    // Loop: wrap around at edges so auto-advance never gets stuck
    _spotlightIndex = ((i % total) + total) % total;
    track.style.transform = `translateX(-${_spotlightIndex * 100}%)`;
    dots.forEach((d, di) => d.classList.toggle('active', di === _spotlightIndex));
    if (counterI) counterI.textContent = String(_spotlightIndex + 1);
    if (opts.userInitiated !== false) restartTimer();
  }

  function startTimer() {
    if (total <= 1) return;
    stopTimer();
    _spotlightTimer = setInterval(() => {
      goTo(_spotlightIndex + 1, { userInitiated: false });
    }, SPOTLIGHT_INTERVAL_MS);
  }
  function stopTimer() {
    if (_spotlightTimer) { clearInterval(_spotlightTimer); _spotlightTimer = null; }
  }
  function restartTimer() { stopTimer(); startTimer(); }

  carousel.querySelector('.sp-arrow-prev')?.addEventListener('click', e => {
    e.preventDefault();
    goTo(_spotlightIndex - 1);
  });
  carousel.querySelector('.sp-arrow-next')?.addEventListener('click', e => {
    e.preventDefault();
    goTo(_spotlightIndex + 1);
  });
  dots.forEach(dot => {
    dot.addEventListener('click', e => {
      e.preventDefault();
      goTo(+dot.dataset.i);
    });
  });

  carousel.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(_spotlightIndex - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); goTo(_spotlightIndex + 1); }
  });

  // Pointer/touch swipe
  let startX = null;
  const viewport = carousel.querySelector('.sp-viewport');
  viewport?.addEventListener('pointerdown', e => { startX = e.clientX; stopTimer(); });
  viewport?.addEventListener('pointerup', e => {
    if (startX == null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) < 40) { startTimer(); return; }
    goTo(_spotlightIndex + (dx < 0 ? 1 : -1));
  });
  viewport?.addEventListener('pointercancel', () => { startX = null; startTimer(); });

  // Pause on hover/focus, resume on leave/blur
  carousel.addEventListener('mouseenter', stopTimer);
  carousel.addEventListener('mouseleave', startTimer);
  carousel.addEventListener('focusin', stopTimer);
  carousel.addEventListener('focusout', startTimer);
  // Pause when the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopTimer();
    else startTimer();
  });

  startTimer();
}

// ── Catalog drawer (open/close, search, filter) ──────────────────────────────

function openCatalogDrawer(entities) {
  let drawer = document.getElementById('catalog-drawer');
  if (!drawer) {
    drawer = document.createElement('aside');
    drawer.id = 'catalog-drawer';
    drawer.className = 'catalog-drawer hidden';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = `
      <div class="cat-drawer-backdrop"></div>
      <div class="cat-drawer-panel" role="dialog" aria-label="Browse all entities"></div>
    `;
    document.body.appendChild(drawer);
  }

  const panel = drawer.querySelector('.cat-drawer-panel');
  panel.innerHTML = renderCatalogDrawer(entities);
  _drawerState.rendered = true;

  // Show drawer
  drawer.classList.remove('hidden');
  drawer.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => drawer.classList.add('open'));

  // Focus search
  setTimeout(() => drawer.querySelector('#cat-drawer-search')?.focus(), 50);

  // Wire interactions once
  if (!drawer.dataset.wired) {
    drawer.dataset.wired = '1';

    drawer.addEventListener('click', e => {
      if (e.target.classList.contains('cat-drawer-backdrop')
          || e.target.closest('#cat-drawer-close')) {
        closeCatalogDrawer(drawer);
        return;
      }
      const chip = e.target.closest('.cat-drawer-chip');
      if (chip) {
        _drawerState.band = chip.dataset.band;
        drawer.querySelectorAll('.cat-drawer-chip').forEach(c =>
          c.classList.toggle('active', c === chip));
        rerenderDrawerList(drawer, entities);
        return;
      }
      const reportIcon = e.target.closest('[data-report="1"]');
      if (reportIcon) {
        e.preventDefault();
        e.stopPropagation();
        const id = reportIcon.dataset.entityId;
        try { sessionStorage.setItem('jem.autoExport', id); } catch (_) {}
        closeCatalogDrawer(drawer);
        State.emit('navigateToDetail', id);
        return;
      }
      const row = e.target.closest('.cat-row');
      if (row) {
        e.preventDefault();
        closeCatalogDrawer(drawer);
        State.emit('navigateToDetail', row.dataset.entityId);
      }
    });

    drawer.addEventListener('input', e => {
      if (e.target.id === 'cat-drawer-search') {
        _drawerState.search = e.target.value || '';
        rerenderDrawerList(drawer, entities);
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !drawer.classList.contains('hidden')) {
        closeCatalogDrawer(drawer);
      }
    });
  }
}

function rerenderDrawerList(drawer, entities) {
  const list = drawer.querySelector('#cat-drawer-list');
  if (list) list.innerHTML = renderDrawerList(entities);
}

function closeCatalogDrawer(drawer) {
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  setTimeout(() => drawer.classList.add('hidden'), 220);
}

// Called externally to reset the view (e.g. when returning from detail)
export function resetSummaryView() {
  _spotlightIndex = 0;
  _drawerState.search = '';
  _drawerState.band = 'all';
}
