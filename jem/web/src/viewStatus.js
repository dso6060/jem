// JEM — One-line map status (below canvas, not overlaid on the map)

import { State } from './state.js';

const IMPACT_FILTER_LABELS = {
  has_structural_gaps: 'structural gaps',
  high_independence_risk: 'high independence risk',
  appointer_funder_same: 'same appointer & funder',
  no_public_criteria: 'no public appointment criteria',
  not_constituted: 'not constituted',
  no_external_complaint: 'no external complaint path',
  blocked_or_absent: 'blocked or absent',
};

let viewStatusEl = null;

/** Cached gap annotation stats from loaded graph (recomputed on graphLoaded). */
let gapStats = {
  hasGapAnnotations: false,
  gapEntityCount: 0,
  exceptionCount: 0,
  circularityCount: 0,
  brokenAppellateCount: 0,
  metricsInBuild: false,
};

function recomputeGapStats(graph) {
  if (!graph?.entities) {
    gapStats = { hasGapAnnotations: false, gapEntityCount: 0, exceptionCount: 0, circularityCount: 0, brokenAppellateCount: 0, metricsInBuild: false };
    return;
  }
  let gapEntityCount = 0;
  let exceptionCount = 0;
  let circularityCount = 0;
  for (const e of graph.entities) {
    if (e.gap_flag || (Number(e.gap_count) || 0) > 0 || (e.gaps?.length > 0)) gapEntityCount++;
    if (e.structural_exception) exceptionCount++;
    const circ = e.circularity_score ?? e.derived?.circularity_score ?? 0;
    if (circ > 0) circularityCount++;
  }
  let brokenAppellateCount = 0;
  for (const r of graph.relationships || []) {
    if (r.relationship_category !== 'appellate_chain') continue;
    const src = graph.entities.find(x => x.id === r.source);
    if (src && (src.derived || {}).appellate_functional === false) brokenAppellateCount++;
  }
  const m = graph.impact_metrics || {};
  const metricsInBuild = m.structural_gaps_entity_count != null
    || m.appellate_vacuum_count != null
    || m.critical_high_clog_count != null;
  gapStats = {
    hasGapAnnotations: gapEntityCount > 0 || exceptionCount > 0 || circularityCount > 0 || brokenAppellateCount > 0,
    gapEntityCount,
    exceptionCount,
    circularityCount,
    brokenAppellateCount,
    metricsInBuild,
  };
}

export function getGapStats() {
  return gapStats;
}

export function primeGapStats(graph) {
  recomputeGapStats(graph);
}

function shortZoomLabel() {
  if (State.selectedEntityId) return 'entity selected';
  return '3 generations';
}

function modeLabel() {
  if (State.viewMode === 'gaps') return 'Gaps';
  if (State.viewMode === 'risk') return 'Risk';
  return 'Structure';
}

/** Short hint when the map would look empty or needs context (folded into status line). */
export function getCanvasEmptyState() {
  if (!State.graph) return null;

  const slice = State.getFocusTrinitySlice();
  const visibleCount = slice.entityIds?.size || 0;
  const total = State.graph.entities.length;

  if (State.activeImpactFilter) {
    if (visibleCount === 0) {
      const label = IMPACT_FILTER_LABELS[State.activeImpactFilter] || 'filter';
      return { title: `No matches for ${label}`, body: '' };
    }
    if (visibleCount <= 3) {
      return { title: `${visibleCount} match filter`, body: '' };
    }
  }

  if (State.viewMode === 'gaps' && !gapStats.hasGapAnnotations) {
    return { title: 'Gaps mode — gap markers pending in graph build', body: '' };
  }

  if (!slice.parent) {
    return { title: 'No entity — pick from tree or search', body: '' };
  }

  if (visibleCount === 0) {
    return { title: 'Nothing visible — clear filters or move timeline', body: '' };
  }

  return null;
}

function trinitySummary() {
  const { parent, children, grandchildren } = State.getFocusTrinitySlice();
  if (!parent) return 'no entity';
  const p = parent.abbreviation || parent.name;
  return `${p} · ${children.length} children · ${grandchildren.length} grandchildren`;
}

/** Single-line map status for the bar below the canvas. */
export function buildViewStatusText() {
  const parts = [`${modeLabel()} · ${shortZoomLabel()}`];

  if (State.activeImpactFilter) {
    parts.push(`filter: ${IMPACT_FILTER_LABELS[State.activeImpactFilter] || State.activeImpactFilter}`);
  } else if (State.viewMode === 'gaps' && !gapStats.hasGapAnnotations) {
    parts.push('gap data not in build yet');
  } else if (State.viewMode === 'risk') {
    const bits = [];
    if (State.showIndependenceRisk) bits.push('IR rings');
    if (State.showDiscretionaryPower) bits.push('DP sizing');
    if (bits.length) parts.push(bits.join('+'));
  }

  parts.push(trinitySummary());
  parts.push(`${State.navMode === 'browse' ? 'Browse' : 'Appellate'} navigator`);

  if (State.showCaseVolume) parts.push('clog overlay');

  if (State.selectedEntityId) {
    const e = State.getEntityById(State.selectedEntityId);
    parts.push(`selected: ${e?.abbreviation || e?.name || State.selectedEntityId}`);
  }

  const nb = document.getElementById('neighborhood-panel');
  if (nb && !nb.classList.contains('hidden')) parts.push('neighborhood open');

  const empty = getCanvasEmptyState();
  if (empty?.title) parts.push(empty.title);

  return parts.join(' · ');
}

function updateViewStatusLine() {
  if (!viewStatusEl) return;
  const text = buildViewStatusText();
  viewStatusEl.textContent = text;
  viewStatusEl.title = text;
}

export function refreshViewStatus() {
  updateViewStatusLine();
}

const REFRESH_EVENTS = [
  'graphLoaded',
  'viewModeChanged',
  'filterChanged',
  'zoomLevelChanged',
  'entitySelected',
  'yearChanged',
  'lensChanged',
  'derivedToggle',
  'collapseChanged',
  'aggregateChanged',
  'focusChanged',
  'navModeChanged',
  'browseFacetChanged',
  'treeSelectionChanged',
];

export function initViewStatus() {
  viewStatusEl = document.getElementById('view-status-text');

  for (const ev of REFRESH_EVENTS) {
    State.subscribe(ev, () => refreshViewStatus());
  }

  State.subscribe('graphLoaded', (graph) => {
    recomputeGapStats(graph);
    refreshViewStatus();
  });

  refreshViewStatus();
}
