// D3LEM — Renderer
// Handles all SVG rendering across 4 semantic zoom levels.
// State-driven: re-renders when State emits relevant events.

import { State } from './state.js';
import { openDetailPanel } from './panel.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_BASE_RADIUS = 22;
const NODE_MIN_RADIUS = 8;
const IR_RING_OFFSET = 6;    // Independence risk ring offset from node edge
const IR_RING_WIDTH = 4;

// ── Selections ────────────────────────────────────────────────────────────────

let svg, root, layerClusters, layerEdges, layerNodes, layerLabels;
let width, height;
let hoveredNodeId = null;
let simulation = null;
let simNodesById = new Map();

const FORCE_LAYOUT_MIN_NODES = 40;
const CLUSTER_PADDING = 120;
const HIERARCHY_Y_GAP = 90;
const BAND_GAP = 200;
const ORG_NODE_Y_GAP = 42;
/** Minimum center-to-center distance = NODE_SPACING_RADIUS_MULT × largest drawable node radius. */
const NODE_SPACING_RADIUS_MULT = 5;

function drawableNodeRadiusForEntity(d) {
  if (State.showDiscretionaryPower) {
    const dp = (d.derived || {}).discretionary_power_score || 1;
    return Math.max(NODE_MIN_RADIUS, Math.min(NODE_BASE_RADIUS * 1.8, NODE_BASE_RADIUS + dp * 1.5));
  }
  return NODE_BASE_RADIUS;
}

function maxDrawableNodeRadius(entities) {
  let m = NODE_BASE_RADIUS;
  for (const d of entities) {
    m = Math.max(m, drawableNodeRadiusForEntity(d));
  }
  return m;
}

export function initRenderer() {
  svg = d3.select('#main-svg');
  root = d3.select('#graph-root');
  layerClusters = d3.select('#layer-clusters');
  layerEdges = d3.select('#layer-edges');
  layerNodes = d3.select('#layer-nodes');
  layerLabels = d3.select('#layer-labels');

  updateDimensions();
  window.addEventListener('resize', () => {
    updateDimensions();
    render();
  });

  // Subscribe to state changes
  State.subscribe('graphLoaded', () => {
    setupLayout();
    render();
  });
  State.subscribe('yearChanged', () => { setupLayout(); render(); });
  State.subscribe('lensChanged', () => { setupLayout(); render(); });
  State.subscribe('viewModeChanged', () => { setupLayout(); render(); });
  State.subscribe('filterChanged', () => { setupLayout(); render(); });
  State.subscribe('collapseChanged', () => { setupLayout(); render(); });
  State.subscribe('derivedToggle', () => { setupLayout(); render(); });
  State.subscribe('zoomLevelChanged', () => render());
}

function updateDimensions() {
  const container = document.getElementById('canvas-container');
  width = container.clientWidth;
  height = container.clientHeight;
  svg.attr('width', width).attr('height', height);
}

// ── Main Render ───────────────────────────────────────────────────────────────

export function render() {
  if (!State.graph) return;

  const level = State.zoomLevel;

  if (level === 0) {
    layerClusters.style('display', null);
    layerClusters.selectAll('.hier-box').remove();
    layerEdges.style('display', 'none');
    layerNodes.style('display', 'none');
    layerLabels.style('display', 'none');
    _renderL0();
    return;
  }

  layerClusters.selectAll('.l0-cluster-card').remove();
  layerClusters.selectAll('.hier-box').remove();
  layerClusters.style('display', 'none');

  layerEdges.style('display', null);
  layerNodes.style('display', null);
  layerLabels.style('display', null);

  renderEdges();
  renderNodes();
  renderLabels();
}

function setupLayout() {
  if (!State.graph) return;
  const entities = State.getVisibleEntities();
  const rels = State.getVisibleRelationships();

  // For larger datasets, default to an org-chart (hierarchical) layout:
  // fixed bands + columns, minimal cognitive load.
  const useOrgChart = entities.length >= FORCE_LAYOUT_MIN_NODES;
  if (!useOrgChart) {
    teardownSimulation();
    return;
  }

  // --- Top-down hierarchy ranks (by appellate chain) ---
  // Data direction: lower --> higher (e.g. hc_delhi --> supreme_court_india).
  // We compute rank from the top node downwards by traversing incoming edges.
  const ranks = computeAppellateRanks(entities, rels);
  const maxRank = Math.max(0, ...Array.from(ranks.values()));
  const fallbackRank = maxRank + 2; // for nodes not in the appellate chain

  // --- Org-chart bands + state/HC grouping (for legibility) ---
  const bandIndexById = computeOrgBands(entities, ranks);
  const groups = computeHorizontalGroups(entities);
  // Deterministic org-chart positions (no simulation).
  teardownSimulation();
  const positions = computeOrgChartPositions({
    entities,
    relationships: rels,
    ranks,
    fallbackRank,
    bandIndexById,
    groups,
    width,
    height,
  });
  simNodesById = new Map(Object.entries(positions).map(([id, pos]) => [id, { id, x: pos.x, y: pos.y }]));
}

function teardownSimulation() {
  if (simulation) simulation.stop();
  simulation = null;
  simNodesById = new Map();
}

function updateGeometryFromPositions() {
  // Update node transforms
  layerNodes.selectAll('.node')
    .attr('transform', d => {
      const n = simNodesById.get(d.id);
      const x = n?.x ?? d.position?.x ?? 0;
      const y = n?.y ?? d.position?.y ?? 0;
      return `translate(${x},${y})`;
    });

  // Update labels
  layerLabels.selectAll('.node-label')
    .attr('x', d => (simNodesById.get(d.id)?.x ?? d.position?.x ?? 0))
    .attr('y', d => (simNodesById.get(d.id)?.y ?? d.position?.y ?? 0) + 36);

  // Update edge paths
  layerEdges.selectAll('.edge-path')
    .attr('d', d => {
      const s = simNodesById.get(d.source);
      const t = simNodesById.get(d.target);
      if (!s || !t) return '';
      return curvePath(s.x, s.y, t.x, t.y);
    });
}

// ── Level 0: Institutional cluster cards only (no entity nodes / band boxes) ─

const STRUCTURAL_HEALTH_RANK = {
  healthy: 0,
  moderate: 1,
  concerning: 2,
  critical: 3,
};

const STRUCTURAL_HEALTH_COLOR = {
  critical: '#e74c3c',
  concerning: '#e67e22',
  moderate: '#f1c40f',
  healthy: '#27ae60',
};

function clusterFill12(hex) {
  const h = (hex || '#2d3436').replace('#', '');
  if (h.length !== 6) return 'rgba(45, 52, 54, 0.12)';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},0.12)`;
}

function worstStructuralHealthLevel(members) {
  let worst = 'healthy';
  let worstRank = -1;
  for (const e of members) {
    const lvl = (e.derived || {}).structural_health_level || 'healthy';
    const r = STRUCTURAL_HEALTH_RANK[lvl];
    if (r === undefined) continue;
    if (r > worstRank) {
      worstRank = r;
      worst = lvl;
    }
  }
  return worst;
}

function _renderL0() {
  const clusters = State.graph.clusters;
  const visibleEntities = State.getVisibleEntities();
  const visibleIds = new Set(visibleEntities.map(e => e.id));
  const meta = State.graph.meta;
  const scaleX = width / meta.canvas_width;
  const scaleY = height / meta.canvas_height;

  layerClusters.selectAll('.cluster-group').remove();
  layerClusters.selectAll('path.l0-subcluster-arc').remove();

  const clusterData = clusters.map(c => {
    const members = State.graph.entities.filter(
      e => e.cluster === c.id && visibleIds.has(e.id)
    );
    const gapSum = members.reduce((s, e) => s + (Number(e.gap_count) || 0), 0);
    const ncCount = members.filter(e => e.operational_status === 'Not_Constituted').length;
    const healthLevel = worstStructuralHealthLevel(members);
    return {
      ...c,
      _w: c.position.width * scaleX,
      _h: c.position.height * scaleY,
      _tx: c.position.x * scaleX,
      _ty: c.position.y * scaleY,
      _active: members.length,
      _gapSum: gapSum,
      _ncCount: ncCount,
      _healthLevel: healthLevel,
      _healthFill: STRUCTURAL_HEALTH_COLOR[healthLevel] || STRUCTURAL_HEALTH_COLOR.healthy,
    };
  });

  const cards = layerClusters.selectAll('g.l0-cluster-card')
    .data(clusterData, d => d.id);

  const enter = cards.enter().append('g')
    .attr('class', 'l0-cluster-card')
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation();
      zoomToCluster(d);
    });

  enter.append('ellipse').attr('class', 'l0-card-shape');
  enter.append('circle').attr('class', 'l0-health');
  enter.append('text').attr('class', 'l0-name');
  enter.append('text').attr('class', 'l0-count');
  enter.append('text').attr('class', 'l0-gaps');
  enter.append('text').attr('class', 'l0-nc');

  const merged = enter.merge(cards);

  merged.attr('transform', d => `translate(${d._tx},${d._ty})`);

  merged.select('.l0-card-shape')
    .attr('cx', d => d._w / 2)
    .attr('cy', d => d._h / 2)
    .attr('rx', d => Math.max(10, d._w / 2))
    .attr('ry', d => Math.max(10, d._h / 2))
    .attr('fill', d => clusterFill12(d.color))
    .attr('stroke', d => d.color)
    .attr('stroke-width', 2);

  merged.select('.l0-health')
    .attr('cx', d => d._w / 2)
    .attr('cy', d => d._h / 2)
    .attr('r', 30)
    .attr('fill', d => d._healthFill)
    .attr('stroke', 'rgba(0,0,0,0.18)')
    .attr('stroke-width', 1)
    .attr('pointer-events', 'none');

  merged.select('.l0-name')
    .attr('x', 10)
    .attr('y', 18)
    .attr('text-anchor', 'start')
    .attr('fill', '#fff')
    .attr('font-size', '14px')
    .attr('font-weight', '700')
    .attr('pointer-events', 'none')
    .text(d => d.name);

  merged.select('.l0-count')
    .attr('x', d => d._w - 10)
    .attr('y', 18)
    .attr('text-anchor', 'end')
    .attr('fill', '#9ca3af')
    .attr('font-size', '12px')
    .attr('font-weight', '400')
    .attr('pointer-events', 'none')
    .text(d => `${d._active} entities`);

  merged.select('.l0-gaps')
    .attr('x', 10)
    .attr('y', d => d._h - 8)
    .attr('text-anchor', 'start')
    .attr('fill', '#e67e22')
    .attr('font-size', '12px')
    .attr('font-weight', '600')
    .attr('pointer-events', 'none')
    .text(d => (d._gapSum > 0 ? `⚠ ${d._gapSum} gaps` : ''));

  merged.select('.l0-nc')
    .attr('x', d => d._w - 10)
    .attr('y', d => d._h - 8)
    .attr('text-anchor', 'end')
    .attr('fill', '#ca6f1e')
    .attr('font-size', '12px')
    .attr('font-weight', '600')
    .attr('pointer-events', 'none')
    .text(d => (d._ncCount > 0 ? `NC: ${d._ncCount}` : ''));

  cards.exit().remove();
}

// ── Level 1/2: Edges ──────────────────────────────────────────────────────────

function isBrokenAppellate(rel) {
  if (rel.relationship_category !== 'appellate_chain') return false;
  const src = State.getEntityById(rel.source);
  if (!src) return false;
  return (src.derived || {}).appellate_functional === false;
}

export function renderEdges() {
  if (State.zoomLevel === 0) return;
  const rels = State.getVisibleRelationships();
  const posMap = buildPositionMap();
  const colors = State.getRelationshipColors();
  const neighbors = hoveredNodeId ? buildNeighborSet(rels, hoveredNodeId) : null;
  const NAVY = '#2c3e50';

  const edgeKey = d => d.id ?? `${d.source}|${d.target}|${d.relationship_type || ''}`;

  const edges = layerEdges.selectAll('.edge')
    .data(rels, edgeKey);

  const enter = edges.enter().append('g').attr('class', 'edge');
  enter.append('path').attr('class', 'edge-path');

  const merged = enter.merge(edges);

  merged.select('.edge-path')
    .attr('d', d => {
      const s = posMap[d.source];
      const t = posMap[d.target];
      if (!s || !t) return '';
      return curvePath(s.x, s.y, t.x, t.y);
    })
    .attr('stroke', d => {
      if (d.relationship_category === 'appellate_chain') {
        if (State.viewMode === 'gaps' && isBrokenAppellate(d)) return '#e74c3c';
        return NAVY;
      }
      return colors[d.relationship_category] || '#999';
    })
    .attr('stroke-width', d => {
      if (State.viewMode === 'gaps' && d.relationship_category === 'appellate_chain' && isBrokenAppellate(d)) {
        return 3;
      }
      return d.is_binding ? 2 : 1;
    })
    .attr('stroke-dasharray', d => {
      if (State.viewMode === 'gaps' && d.relationship_category === 'appellate_chain' && isBrokenAppellate(d)) {
        return '10,6';
      }
      if (State.isRelationshipHistorical(d)) return '4,4';
      if (d.data_quality === 'unverified') return '2,3';
      if (d.data_quality === 'contested') return '6,2';
      return null;
    })
    .attr('fill', 'none')
    .attr('opacity', d => {
      // Readable at default zoom (~0.55); still dim non-hover paths when hovering a node.
      const base = State.isRelationshipHistorical(d) ? 0.22
        : d.data_quality === 'unverified' ? 0.28
        : 0.38;
      if (!neighbors) return base;
      const onPath = d.source === hoveredNodeId || d.target === hoveredNodeId;
      return onPath ? 0.95 : 0.12;
    })
    .attr('marker-end', d => {
      const cat = d.relationship_category;
      return `url(#arrow-${cat})`;
    })
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('stroke-width', 3).attr('opacity', 1);
      showEdgeTooltip(event, d);
    })
    .on('mouseleave', function(event, d) {
      d3.select(this).attr('stroke-width', d.is_binding ? 2 : 1).attr('opacity', 0.75);
      hideTooltip();
    });

  // Edge-type labels: only at L2+. Always strip when leaving L2 or when endpoints vanish,
  // otherwise D3 leaves orphan <text> with stale transforms (mode / zoom / layout switches).
  if (State.zoomLevel < 2) {
    merged.selectAll('.edge-label').remove();
  } else {
    merged.each(function(d) {
      const g = d3.select(this);
      const s = posMap[d.source];
      const t = posMap[d.target];
      if (!s || !t) {
        g.selectAll('.edge-label').remove();
        return;
      }
      let lab = g.select('text.edge-label');
      if (lab.empty()) {
        lab = g.append('text').attr('class', 'edge-label');
      }
      const mx = (s.x + t.x) / 2;
      const my = (s.y + t.y) / 2;
      lab
        .attr('fill', colors[d.relationship_category] || '#999')
        .attr('font-size', '9px')
        .attr('dy', -4)
        .attr('text-anchor', 'middle')
        .text(formatRelType(d.relationship_type))
        .attr('transform', `translate(${mx},${my})`);
    });
  }

  edges.exit().remove();
}

// ── Level 1/2: Nodes ──────────────────────────────────────────────────────────

export function renderNodes() {
  if (State.zoomLevel === 0) return;
  const entities = State.getVisibleEntities();
  const posMap = buildPositionMap();
  const irColors = State.getIndependenceRiskColors();
  const dqLegend = State.getDataQualityLegend();
  const osLegend = State.getOperationalStatusLegend();
  const isLightTheme = document.documentElement.style.colorScheme === 'light'
    || getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().startsWith('#fafafa')
    || getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() === '#111827';
  const rels = State.getVisibleRelationships();
  const neighborSet = hoveredNodeId ? buildNeighborSet(rels, hoveredNodeId) : null;

  const nodes = layerNodes.selectAll('.node')
    .data(entities, d => d.id);

  const enter = nodes.enter().append('g')
    .attr('class', 'node')
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation();
      State.selectEntity(d.id);
      openDetailPanel(d);
    })
    .on('mouseenter', function(event, d) {
      d3.select(this).select('.node-circle').attr('filter', 'url(#glow)');
      hoveredNodeId = d.id;
      cancelTooltipHide();
      render(); // re-render with neighbor dimming + tooltips
      showNodeRelationshipsTooltip(event, d, rels);
    })
    .on('mouseleave', function(event, d) {
      d3.select(this).select('.node-circle').attr('filter', null);
      hoveredNodeId = null;
      scheduleHideTooltip(300);
      render();
    });

  // Independence risk ring (outer)
  enter.append('circle').attr('class', 'node-ir-ring');
  // Main node circle
  enter.append('circle').attr('class', 'node-circle');
  // Structural-exception diagonal stripe (Gaps mode)
  enter.append('circle').attr('class', 'node-exception-overlay');
  // Badge overlay (?, ⚑, "NC")
  enter.append('text').attr('class', 'node-badge');
  enter.append('text').attr('class', 'node-gap-marker');
  enter.append('text').attr('class', 'node-circ-marker');
  // Expand/collapse control (+ / −)
  enter.append('g').attr('class', 'node-toggle');

  const merged = enter.merge(nodes);

  merged.attr('transform', d => {
    const pos = posMap[d.id] || d.position || { x: 0, y: 0 };
    return `translate(${pos.x},${pos.y})`;
  });

  const nodeRadius = drawableNodeRadiusForEntity;

  // Historical / abolished opacity
  const nodeOpacity = d => {
    if (State.isEntityHistorical(d)) return 0.25;
    const osStyle = osLegend[d.operational_status] || {};
    return osStyle.node_opacity || 1.0;
  };

  // Node circle
  merged.select('.node-circle')
    .attr('r', nodeRadius)
    .attr('fill', d => govLevelFill(d.level_of_government))
    .attr('stroke', d => {
      if (State.viewMode === 'gaps' && d.operational_status === 'De_Facto_Blocked') return '#e67e22';
      if (State.showIndependenceRisk) {
        const level = (d.derived || {}).independence_risk_level || 'low';
        return irColors[level] || '#27ae60';
      }
      return '#444';
    })
    .attr('stroke-width', d => (
      State.viewMode === 'gaps' && d.operational_status === 'De_Facto_Blocked' ? 3 : 2
    ))
    .attr('stroke-dasharray', d => {
      const os = osLegend[d.operational_status] || {};
      if (d.operational_status === 'Not_Constituted') return '5,3';
      if (d.operational_status === 'Proposed') return '2,3';
      if (d.data_quality === 'unverified') return '3,3';
      return null;
    })
    .attr('opacity', d => {
      const base = nodeOpacity(d);
      if (!neighborSet) return base;
      const isNeighbor = d.id === hoveredNodeId || neighborSet.has(d.id);
      return isNeighbor ? base : Math.min(base, 0.12);
    });

  // Independence risk ring — only when toggle is on
  merged.select('.node-ir-ring')
    .attr('r', d => {
      if (!State.showIndependenceRisk) return 0;
      return nodeRadius(d) + IR_RING_OFFSET;
    })
    .attr('fill', 'none')
    .attr('stroke', d => {
      const level = (d.derived || {}).independence_risk_level || 'low';
      return irColors[level] || '#27ae60';
    })
    .attr('stroke-width', IR_RING_WIDTH)
    .attr('opacity', d => State.showIndependenceRisk ? 0.7 : 0);

  merged.select('.node-exception-overlay')
    .attr('r', d => {
      if (!State.showExceptions || !d.structural_exception) return 0;
      return nodeRadius(d);
    })
    .attr('fill', 'url(#pat-exception-stripes)')
    .attr('opacity', d => (State.showExceptions && d.structural_exception) ? 0.52 : 0)
    .attr('pointer-events', 'none');

  // Badge
  merged.select('.node-badge')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('dy', d => -nodeRadius(d) + 2)
    .attr('dx', d => nodeRadius(d) - 2)
    .attr('font-size', '10px')
    .attr('fill', '#e74c3c')
    .text(d => {
      if (d.operational_status === 'Not_Constituted') return 'NC';
      if (d.data_quality === 'partial') return '?';
      if (d.data_quality === 'contested') return '⚑';
      return '';
    });

  merged.select('.node-gap-marker')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('dy', d => -nodeRadius(d) - 10)
    .attr('dx', d => -nodeRadius(d) + 4)
    .attr('font-size', '18px')
    .attr('font-weight', '800')
    .attr('fill', '#e74c3c')
    .attr('pointer-events', 'none')
    .text(d => ((State.showGaps && (d.gap_flag || (d.gap_count || 0) > 0)) ? '*' : ''));

  merged.select('.node-circ-marker')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('dy', d => nodeRadius(d) + 4)
    .attr('dx', d => nodeRadius(d) - 2)
    .attr('font-size', '14px')
    .attr('fill', '#8e44ad')
    .attr('pointer-events', 'none')
    .text(d => {
      const c = d.circularity_score ?? d.derived?.circularity_score ?? 0;
      return (State.showCircularity && c > 0) ? '⟳' : '';
    });

  // Expand/Collapse control
  const toggle = merged.select('.node-toggle');
  toggle.each(function(d) {
    const g = d3.select(this);
    g.selectAll('*').remove();

    const kids = State.useProgressiveExplorer
      && (State._childrenByParent?.[d.id] || []).length > 0;
    if (!kids) return;

    const r = nodeRadius(d);
    const isExpanded = State.expandedEntityIds?.has(d.id);
    // Place to the right of the node so overflow:hidden on the canvas does not clip
    // the control when the node sits in the top band (was above: −r−10).
    const x = r + 20;
    const y = 0;
    const hw = 11;

    g.attr('transform', `translate(${x},${y})`)
      .style('cursor', 'pointer')
      .on('pointerdown', (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        State.toggleExpand(d.id);
      });

    g.append('title')
      .text(isExpanded ? 'Collapse appellate children' : 'Expand appellate children');

    g.append('rect')
      .attr('x', -hw).attr('y', -hw)
      .attr('width', hw * 2).attr('height', hw * 2)
      .attr('rx', 5)
      .attr('fill', '#ffffff')
      .attr('stroke', '#2563eb')
      .attr('stroke-width', 2);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '15px')
      .attr('font-weight', '800')
      .attr('fill', '#111827')
      .text(isExpanded ? '−' : '+');
  });

  nodes.exit().remove();
}

// ── Level 1/2: Labels (semantic zoom L1/L2; scale-driven via State.get('zoomScale')) ─

function renderLabels() {
  if (State.zoomLevel === 0) return;
  const entities = State.getVisibleEntities();
  const posMap = buildPositionMap();
  const dqLegend = State.getDataQualityLegend();
  const textPrimary = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#111827';
  const textDim = getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim() || '#6b7280';
  const isLightTheme = (getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '').toLowerCase() !== '#0d0d1a';
  const rels = State.getVisibleRelationships();
  const neighborSet = hoveredNodeId ? buildNeighborSet(rels, hoveredNodeId) : null;
  const zoomScale = State.get('zoomScale') ?? State.zoomTransform?.k ?? 1;
  // Labels are inside the zoomed #graph-root. Font in user units: F×k ≈ constant screen px.
  // Never use a minimum F≥12 here — at large k that explodes on-screen (was the huge-label bug).
  const k = Math.max(0.18, Math.min(8, zoomScale || 1));
  const labelFontPx = Math.max(3.5, Math.min(19, 10.5 / k));

  const labels = layerLabels.selectAll('.node-label')
    .data(entities, d => d.id);

  const enter = labels.enter().append('text').attr('class', 'node-label');
  const merged = enter.merge(labels);

  const nodeR = drawableNodeRadiusForEntity;

  merged
    .attr('x', d => (posMap[d.id] || d.position || {x:0}).x)
    .attr('y', d => (posMap[d.id] || d.position || {y:0}).y + nodeR(d) + 14 + (labelFontPx > 18 ? 4 : 0))
    .attr('text-anchor', 'middle')
    .attr('font-size', `${labelFontPx}px`)
    .attr('font-weight', d => {
      const dq = d.data_quality;
      if (dq === 'verified') return '700';
      return '400';
    })
    .attr('fill', d => {
      if (State.isEntityHistorical(d)) return textDim;
      if (isLightTheme) return textPrimary; // override dark-theme legend colors
      const dq = d.data_quality;
      const style = dqLegend[dq] || {};
      return style.color || textPrimary;
    })
    .attr('font-style', d => {
      const dq = d.data_quality;
      const dqStyle = dqLegend[dq] || {};
      if (dqStyle.italic) return 'italic';
      if (d.operational_status === 'Not_Constituted') return 'italic';
      if (State.isEntityHistorical(d)) return 'italic';
      return 'normal';
    })
    .attr('text-decoration', d => {
      if (State.isEntityHistorical(d)) return 'line-through';
      const dq = d.data_quality;
      const dqStyle = dqLegend[dq] || {};
      if (dqStyle.underline) return `underline ${dqStyle.underline}`;
      return null;
    })
    .attr('opacity', d => {
      if (State.isEntityHistorical(d)) return 0.45;
      if (!neighborSet) return 0.94;
      const isNeighbor = d.id === hoveredNodeId || neighborSet.has(d.id);
      return isNeighbor ? 1.0 : 0.22;
    })
    .text(d => {
      const abbr = d.abbreviation || d.name;
      if (zoomScale > 1.05) return d.name || abbr;
      if (zoomScale > 0.72) return abbr;
      // Very zoomed out: still show abbreviation (never hide text entirely).
      return abbr.length > 22 ? `${abbr.slice(0, 20)}…` : abbr;
    });

  labels.exit().remove();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildNeighborSet(rels, id) {
  const set = new Set();
  rels.forEach(r => {
    if (r.source === id) set.add(r.target);
    else if (r.target === id) set.add(r.source);
  });
  return set;
}

function computeAppellateRanks(entities, rels) {
  const ids = new Set(entities.map(e => e.id));
  const edges = rels
    .filter(r => r.relationship_category === 'appellate_chain')
    .filter(r => ids.has(r.source) && ids.has(r.target));

  // Build reverse adjacency: higher -> [lower...]
  const incomingFrom = new Map(); // key: higher, value: lowers that appeal to it
  edges.forEach(r => {
    const higher = r.target;
    const lower = r.source;
    if (!incomingFrom.has(higher)) incomingFrom.set(higher, []);
    incomingFrom.get(higher).push(lower);
  });

  const rank = new Map();
  const root = 'supreme_court_india';
  rank.set(root, 0);

  const q = [root];
  while (q.length) {
    const cur = q.shift();
    const curRank = rank.get(cur) ?? 0;
    const lowers = incomingFrom.get(cur) || [];
    for (const low of lowers) {
      const nextRank = curRank + 1;
      const prev = rank.get(low);
      if (prev === undefined || nextRank < prev) {
        rank.set(low, nextRank);
        q.push(low);
      }
    }
  }

  return rank;
}

function computeOrgBands(entities, appellateRanks) {
  // Bands (top -> bottom):
  // 0: Apex constitutional + head-of-state
  // 1: High Courts + core appointment bodies
  // 2: Tribunals / regulators / oversight infrastructure
  // 3: State bodies + subordinate courts + roles/people
  const band = new Map();

  for (const e of entities) {
    const id = e.id;
    const type = e.type;
    const cluster = e.cluster;

    if (id === 'supreme_court_india' || id === 'president_india') {
      band.set(id, 0);
      continue;
    }

    if (type === 'ConstitutionalCourt' && id.startsWith('hc_')) {
      band.set(id, 1);
      continue;
    }

    if (cluster === 'appointment_bodies' || type === 'AppointmentBody') {
      band.set(id, 1);
      continue;
    }

    if (cluster === 'tribunals_adr' || type === 'CentralTribunal' || type === 'StateTribunal') {
      band.set(id, 2);
      continue;
    }

    if (cluster === 'regulatory_bodies' || type === 'RegulatoryBodyQJ') {
      band.set(id, 2);
      continue;
    }

    if (cluster === 'digital_infrastructure' || cluster === 'financing_audit' || cluster === 'training_professional') {
      band.set(id, 2);
      continue;
    }

    if (cluster === 'constitutional_courts' && type === 'ConstitutionalCourt') {
      // Other constitutional courts (SC already handled)
      band.set(id, 1);
      continue;
    }

    // Default bottom band
    band.set(id, 3);
  }

  return band;
}

function computeHorizontalGroups(entities) {
  // Prefer state/UT from jurisdiction_scope.states_covered/uts_covered.
  // For TN sample entities (ids like tn_*), use id prefix.
  // Else group as Central.
  const map = new Map();
  for (const e of entities) {
    const id = e.id || '';
    const js = e.jurisdiction_scope || e._detail?.jurisdiction_scope || {};
    const states = Array.isArray(js.states_covered) ? js.states_covered : [];
    const uts = Array.isArray(js.uts_covered) ? js.uts_covered : [];

    if (id.startsWith('tn_') || id === 'tnerc' || id === 'tn_rera') {
      map.set(id, 'TN');
      continue;
    }

    if (states.length === 1) {
      map.set(id, states[0]);
      continue;
    }
    if (uts.length === 1) {
      map.set(id, uts[0]);
      continue;
    }

    // High Courts: use the first state code if multi, else label as MultiState.
    if (id.startsWith('hc_') && states.length > 1) {
      map.set(id, 'MultiState_HC');
      continue;
    }

    if (e.level_of_government === 'State') {
      map.set(id, 'State');
      continue;
    }

    map.set(id, 'Central');
  }
  return map;
}

function computeOrgChartPositions({
  entities,
  relationships,
  ranks,
  fallbackRank,
  bandIndexById,
  groups,
  width,
  height,
}) {
  // Hybrid layout:
  // - Y is banded (hierarchy)
  // - X is clustered within each band using same-band links (network feel)
  const getBand = (e) => bandIndexById.get(e.id) ?? 3;
  const getGroup = (e) => groups.get(e.id) ?? 'Central';
  const getRank = (e) => ranks.get(e.id) ?? fallbackRank;

  const ids = new Set(entities.map(e => e.id));
  const rMax = maxDrawableNodeRadius(entities);
  const minCenterDist = NODE_SPACING_RADIUS_MULT * rMax;
  const bandPitch = Math.max(BAND_GAP + 40, minCenterDist * 2.15);
  const bandClampSim = Math.max(70, BAND_GAP * 0.35, minCenterDist * 0.48);

  const groupKeys = Array.from(new Set(entities.map(e => getGroup(e))));
  groupKeys.sort((a, b) => (a === 'Central' ? -1 : b === 'Central' ? 1 : a.localeCompare(b)));
  const groupCols = Math.max(2, Math.min(8, groupKeys.length));
  const colW = Math.max(220, (width - CLUSTER_PADDING * 2) / groupCols);
  const groupX = new Map();
  groupKeys.forEach((gk, i) => {
    const col = i % groupCols;
    const cx = CLUSTER_PADDING + col * colW + colW / 2;
    groupX.set(gk, cx);
  });

  // Partition entities by band
  const bandToEntities = new Map();
  for (const e of entities) {
    const b = getBand(e);
    if (!bandToEntities.has(b)) bandToEntities.set(b, []);
    bandToEntities.get(b).push(e);
  }

  const positions = {};

  // Pre-index relationships for within-band links
  const rels = (relationships || [])
    .filter(r => ids.has(r.source) && ids.has(r.target));

  // Pin the very top entities side-by-side — separation respects minCenterDist.
  const topY = CLUSTER_PADDING;
  const pinSep = Math.max(180, minCenterDist * 1.05);
  positions['president_india'] = { x: width / 2 - pinSep / 2, y: topY };
  positions['supreme_court_india'] = { x: width / 2 + pinSep / 2, y: topY };

  // Layout each band independently
  const bandKeys = Array.from(bandToEntities.keys()).sort((a, b) => a - b);
  for (const band of bandKeys) {
    const bandEntities = bandToEntities.get(band) || [];
    const bandBaseY = CLUSTER_PADDING + band * bandPitch;
    const bandClamp = bandClampSim;

    // Nodes for this band
    const nodes = bandEntities.map(e => {
      const pinned = positions[e.id];
      const x0 = pinned?.x ?? (groupX.get(getGroup(e)) ?? width / 2) + (Math.random() - 0.5) * 60;
      const y0 = pinned?.y ?? (bandBaseY + (Math.random() - 0.5) * bandClamp);
      return {
        id: e.id,
        ref: e,
        x: x0,
        y: y0,
        _group: getGroup(e),
        _rank: getRank(e),
      };
    });
    const byId = new Map(nodes.map(n => [n.id, n]));

    // Links only within this band to create local clustering
    const links = rels
      .filter(r => (byId.has(r.source) && byId.has(r.target)))
      .map(r => ({ ...r, source: byId.get(r.source), target: byId.get(r.target) }));

    // Stable order for deterministic packing
    nodes.sort((a, b) => {
      if (a._rank !== b._rank) return a._rank - b._rank;
      return (a.ref.abbreviation || a.ref.name || a.id).localeCompare(b.ref.abbreviation || b.ref.name || b.id);
    });

    // Mini-simulation: create a “blob” within the band (X grouped, Y softly banded).
    const linkDist = Math.max(80, minCenterDist * 0.92);
    const charge = -Math.max(380, minCenterDist * 10);
    const collideR = minCenterDist / 2;
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(linkDist).strength(0.72))
      .force('charge', d3.forceManyBody().strength(charge))
      .force('collide', d3.forceCollide().radius(() => collideR).iterations(4))
      .force('x', d3.forceX(d => groupX.get(d._group) ?? width / 2).strength(0.32))
      .force('y', d3.forceY(bandBaseY).strength(0.16))
      .stop();

    for (let i = 0; i < 220; i++) sim.tick();

    // Write back positions
    for (const n of nodes) {
      if (positions[n.id]) continue; // keep pinned overrides
      // Clamp to band bounds to keep hierarchy readable.
      const y = Math.max(bandBaseY - bandClamp, Math.min(bandBaseY + bandClamp, n.y));
      positions[n.id] = { x: n.x, y };
    }
  }

  // Final pass: enforce minimum center-to-center distance within each band.
  resolveOverlapsByBand({
    entities,
    positions,
    bandIndexById,
    width,
    height,
    minDist: minCenterDist,
    bandPitch,
  });

  return positions;
}

function resolveOverlapsByBand({ entities, positions, bandIndexById, width, height, minDist, bandPitch }) {
  const pitch = bandPitch ?? (BAND_GAP + 40);
  const bands = new Map();
  for (const e of entities) {
    const b = bandIndexById.get(e.id) ?? 3;
    if (!positions[e.id]) continue;
    if (!bands.has(b)) bands.set(b, []);
    bands.get(b).push(e.id);
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  for (const [band, ids] of bands.entries()) {
    if (ids.length < 2) continue;
    const bandBaseY = CLUSTER_PADDING + band * pitch;
    const bandClamp = Math.max(100, pitch * 0.38, minDist * 0.55);

    for (let iter = 0; iter < 120; iter++) {
      let moved = 0;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const aId = ids[i], bId = ids[j];
          const a = positions[aId], bpos = positions[bId];
          if (!a || !bpos) continue;
          let dx = bpos.x - a.x;
          let dy = bpos.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          if (dist >= minDist) continue;

          // Push apart along the separating axis.
          const push = (minDist - dist) * 0.5;
          dx /= dist; dy /= dist;
          a.x -= dx * push; a.y -= dy * push;
          bpos.x += dx * push; bpos.y += dy * push;
          moved++;
        }
      }

      // Keep nodes inside viewport and inside band.
      for (const id of ids) {
        const p = positions[id];
        if (!p) continue;
        p.x = clamp(p.x, 40, width - 40);
        p.y = clamp(p.y, bandBaseY - bandClamp, bandBaseY + bandClamp);
      }

      if (moved === 0) break;
    }
  }
}

function buildPositionMap() {
  const map = {};
  if (!State.graph) return map;
  State.graph.entities.forEach(e => {
    const n = simNodesById.get(e.id);
    if (n) map[e.id] = { x: n.x, y: n.y };
    else if (e.position) map[e.id] = e.position;
  });
  return map;
}

function curvePath(x1, y1, x2, y2) {
  // Cubic bezier — offset control points perpendicular to the line
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dr = Math.sqrt(dx * dx + dy * dy) * 0.4;
  // Slight arc
  return `M${x1},${y1} Q${(x1+x2)/2 + dy*0.2},${(y1+y2)/2 - dx*0.2} ${x2},${y2}`;
}

function govLevelFill(level) {
  switch(level) {
    case 'Central': return '#1a3a5c';
    case 'State': return '#1a4a2a';
    case 'UT': return '#3a2a4a';
    case 'Shared_MultiState': return '#3a2a1a';
    case 'Shared_CentralState': return '#2a3a1a';
    default: return '#2d2d2d';
  }
}

function irLevel(score) {
  if (score <= 2) return 'low';
  if (score <= 5) return 'moderate';
  if (score <= 8) return 'high';
  return 'severe';
}

function irColor(score) {
  const colors = State.graph ? State.getIndependenceRiskColors() : {};
  return colors[irLevel(score)] || '#27ae60';
}

function formatRelType(type) {
  return type.replace(/_/g, ' ').toLowerCase();
}

function zoomToCluster(cluster) {
  // Programmatically zoom so the cluster fills the viewport
  // This transitions from L0 to L1
  const svgEl = document.getElementById('main-svg');
  const zoom = d3.zoom().on('zoom', (event) => {
    root.attr('transform', event.transform);
    State.setTransform(event.transform);
  });
  d3.select(svgEl).call(
    zoom.transform,
    d3.zoomIdentity.translate(width/2, height/2).scale(0.6)
  );
  State.setZoomLevel(1);
  render();
}

function showEdgeTooltip(event, d) {
  // Simple tooltip — could be enhanced
  const existing = document.getElementById('edge-tooltip');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'edge-tooltip';
  t.style.cssText = `position:fixed;left:${event.clientX+12}px;top:${event.clientY-20}px;
    background:#1a1a2e;color:#eee;padding:6px 10px;border-radius:6px;
    font-size:11px;pointer-events:none;z-index:1000;max-width:260px;
    border:1px solid #444;`;
  t.innerHTML = `<strong>${formatRelType(d.relationship_type)}</strong>
    ${d.is_constitutional ? '<span style="color:#27ae60"> ⊕ Constitutional</span>' : ''}
    ${d.is_binding ? '<span style="color:#e67e22"> ⊕ Binding</span>' : ''}
    ${d.notes ? `<br><small style="color:#aaa">${d.notes.slice(0,120)}…</small>` : ''}
    ${d.year_abolished ? `<br><small style="color:#e74c3c">Abolished ${d.year_abolished}</small>` : ''}`;
  document.body.appendChild(t);
}

let tooltipHideTimer = null;

function cancelTooltipHide() {
  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }
}

/** Lets the cursor move onto the tooltip to scroll before it closes. */
function scheduleHideTooltip(ms = 220) {
  cancelTooltipHide();
  tooltipHideTimer = setTimeout(() => {
    tooltipHideTimer = null;
    hideTooltip();
  }, ms);
}

function clampTooltipToViewport(el, event) {
  const margin = 10;
  const w = el.offsetWidth || 320;
  const h = el.offsetHeight || 200;
  let left = event.clientX + 14;
  let top = event.clientY - 18;
  if (left + w > window.innerWidth - margin) left = window.innerWidth - w - margin;
  if (left < margin) left = margin;
  if (top + h > window.innerHeight - margin) top = window.innerHeight - h - margin;
  if (top < margin) top = margin;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function wireTooltipPointerHold(el) {
  el.addEventListener('mouseenter', cancelTooltipHide);
  el.addEventListener('mouseleave', () => scheduleHideTooltip(200));
}

function hideTooltip() {
  cancelTooltipHide();
  const t = document.getElementById('edge-tooltip');
  if (t) t.remove();
}

function htmlIndependenceRiskBreakdown(breakdown) {
  if (!breakdown || typeof breakdown !== 'object') return '';
  const rows = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, pts]) => {
      const sign = pts >= 0 ? '+' : '';
      const cls = pts > 0 ? '#e74c3c' : '#16a34a';
      return `<div style="display:flex;gap:8px;font-size:11px;padding:2px 0">
        <span style="font-family:var(--font-mono,monospace);min-width:32px;font-weight:700;color:${cls}">${sign}${pts}</span>
        <span style="color:#4b5563;line-height:1.35">${reason}</span>
      </div>`;
    })
    .join('');
  return `<div style="margin-top:8px;padding:8px;border-radius:6px;background:rgba(17,24,39,0.04)">${rows}</div>`;
}

function showNodeRelationshipsTooltip(event, node, rels) {
  hideTooltip();

  const t = document.createElement('div');
  t.id = 'edge-tooltip';
  t.className = 'graph-hover-tooltip';
  t.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'background:#ffffff',
    'color:#111827',
    'padding:0',
    'border-radius:10px',
    'font-size:12px',
    'pointer-events:auto',
    'z-index:1200',
    'max-width:min(440px,calc(100vw - 24px))',
    'max-height:min(78vh,640px)',
    'border:1px solid rgba(17,24,39,0.12)',
    'box-shadow:0 12px 30px rgba(17,24,39,0.14)',
    'display:flex',
    'flex-direction:column',
    'overflow:hidden',
  ].join(';');

  if (State.viewMode === 'risk') {
    const derived = node.derived || {};
    const irColors = State.getIndependenceRiskColors();
    const level = derived.independence_risk_level || 'unknown';
    const score = derived.independence_risk_score;
    const levelColor = irColors[level] || '#6b7280';
    let html = `<div style="flex-shrink:0;padding:10px 12px 0;font-weight:700">${node.abbreviation || node.name}</div>`;
    html += `<div style="flex-shrink:0;font-size:11px;color:#6b7280;margin-bottom:4px;padding:0 12px">Independence risk</div>`;
    html += `<div style="flex-shrink:0;display:flex;align-items:baseline;gap:10px;margin-bottom:4px;padding:0 12px">
      <span style="font-size:20px;font-weight:800;font-family:var(--font-mono,monospace)">${score ?? '—'}</span>
      <span style="font-size:11px;font-weight:700;color:${levelColor}">${(level || '').toUpperCase()}</span>
    </div>`;
    html += `<div class="graph-hover-tooltip-body" style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:0 12px 12px">`;
    html += htmlIndependenceRiskBreakdown(derived.independence_risk_breakdown);
    html += '</div>';
    t.innerHTML = html;
    document.body.appendChild(t);
    wireTooltipPointerHold(t);
    requestAnimationFrame(() => {
      clampTooltipToViewport(t, event);
      requestAnimationFrame(() => clampTooltipToViewport(t, event));
    });
    return;
  }

  const connected = rels.filter(r => r.source === node.id || r.target === node.id);
  if (!connected.length) return;

  const byCat = new Map();
  connected.forEach(r => {
    const cat = r.relationship_category || 'other';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(r);
  });

  const lookupName = (id) => (State.getEntityById(id)?.abbreviation || State.getEntityById(id)?.name || id);
  const catTitle = (c) => (c || '').replace(/_/g, ' ');
  const relTitle = (r) => (r.relationship_type || '').replace(/_/g, ' ');

  let html = `<div style="flex-shrink:0;padding:10px 12px 0;font-weight:700">${node.abbreviation || node.name}</div>`;
  html += `<div style="flex-shrink:0;color:#6b7280;font-size:11px;margin-bottom:6px;padding:0 12px">${connected.length} relationship(s)</div>`;
  html += '<div class="graph-hover-tooltip-body" style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:0 10px 12px 12px">';
  for (const [cat, items] of byCat.entries()) {
    html += `<div style="margin:8px 0 4px 0;font-size:11px;color:#374151;font-weight:700">${catTitle(cat)}</div>`;
    for (const r of items) {
      const other = r.source === node.id ? r.target : r.source;
      html += `<div style="font-size:11px;color:#111827;line-height:1.45;padding:2px 0">
        <span style="color:#6b7280">${relTitle(r)}</span> → <span style="font-weight:600">${lookupName(other)}</span>
      </div>`;
    }
  }
  html += '</div>';
  t.innerHTML = html;
  document.body.appendChild(t);
  wireTooltipPointerHold(t);
  requestAnimationFrame(() => {
    clampTooltipToViewport(t, event);
    requestAnimationFrame(() => clampTooltipToViewport(t, event));
  });
}

// Click on background: deselect
document.addEventListener('click', (e) => {
  if (e.target.id === 'main-svg' || e.target === document.getElementById('canvas-container')) {
    State.clearEntity();
  }
});
