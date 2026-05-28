// JEM — Focus Trinity canvas (Parent → Children → Grandchildren) — label-only rows
import { State } from './state.js';
import { selectAndOpenEntity } from './entitySelection.js';
import { refreshViewStatus } from './viewStatus.js';
import { gapMarkerText } from './nodeVisuals.js';

let svg, layerEdges, layerNodes, breadcrumbsEl, canvasWrap;
let zoomBehavior = null;
let contentBounds = { width: 960, height: 480, minX: 0, minY: 0 };
let prefersReducedMotion = false;
let hasInitialFit = false;
let userAdjustedZoom = false;

const COL_W = 300;
const COL_GAP = 56;
const ROW_GAP = 52;
const PAD_TOP = 56;
const PAD_LEFT = 48;
const LABEL_OFFSET_X = -118;
const LABEL_PAD_X = 8;
const LABEL_PAD_Y = 5;

export function initFocusCanvas() {
  svg = d3.select('#focus-svg');
  canvasWrap = document.getElementById('focus-canvas-wrap');
  const root = svg.select('#focus-root');
  layerEdges = root.select('#focus-layer-edges');
  layerNodes = root.select('#focus-layer-nodes');
  breadcrumbsEl = document.getElementById('focus-breadcrumbs');

  prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  updateMapHint();
  window.matchMedia('(max-width: 900px)').addEventListener('change', updateMapHint);

  zoomBehavior = d3.zoom()
    .scaleExtent([0.35, 3.5])
    .filter((event) => {
      if (event.type === 'wheel') return event.ctrlKey || event.metaKey;
      if (event.type === 'dblclick') return false;
      return !event.button || event.button === 0;
    })
    .on('zoom', (event) => {
      if (event.sourceEvent) userAdjustedZoom = true;
      d3.select('#focus-root').attr('transform', event.transform);
    });

  d3.select('#focus-svg').call(zoomBehavior);

  const events = [
    'focusChanged', 'navModeChanged', 'browseFacetChanged',
    'lensChanged', 'filterChanged', 'viewModeChanged', 'derivedToggle',
    'yearChanged', 'collapseChanged', 'aggregateChanged', 'entitySelected',
  ];
  events.forEach(ev => State.subscribe(ev, () => renderFocusCanvas()));

  document.getElementById('btn-focus-zoom-in')?.addEventListener('click', (e) => {
    e.preventDefault();
    zoomBy(1.25);
  });
  document.getElementById('btn-focus-zoom-out')?.addEventListener('click', (e) => {
    e.preventDefault();
    zoomBy(0.8);
  });
  document.getElementById('btn-focus-zoom-reset')?.addEventListener('click', (e) => {
    e.preventDefault();
    userAdjustedZoom = false;
    fitFocusToView();
  });

  window.addEventListener('resize', () => {
    if (hasInitialFit) fitFocusToView({ animate: false });
  });

  let lastFitFocusId = null;
  State.subscribe('focusChanged', (id) => {
    if (id === lastFitFocusId) return;
    lastFitFocusId = id;
    userAdjustedZoom = false;
    requestAnimationFrame(() => {
      updateContentBoundsFromDom();
      fitFocusToView({ animate: !prefersReducedMotion });
      hasInitialFit = true;
    });
  });
}

export function renderFocusCanvas() {
  if (!State.graph || !svg) return;

  const { parent, children, grandchildren, entityIds } = State.getFocusTrinitySlice();
  const rels = State.getTrinityRelationships(entityIds);
  const irColors = State.getIndependenceRiskColors();

  renderBreadcrumbs(parent);
  const positions = layoutTrinity(parent, children, grandchildren);

  const duration = prefersReducedMotion ? 0 : 220;

  const edges = layerEdges.selectAll('path.focus-edge')
    .data(rels, d => d.id || `${d.source}-${d.target}-${d.relationship_category}`);

  edges.exit()
    .transition().duration(duration * 0.8)
    .attr('opacity', 0)
    .remove();

  const edgesEnter = edges.enter().append('path')
    .attr('class', 'focus-edge')
    .attr('fill', 'none')
    .attr('marker-end', d => `url(#arrow-${d.relationship_category})`)
    .attr('opacity', 0);

  edgesEnter.merge(edges)
    .transition().duration(duration)
    .attr('opacity', d => (State.isRelationshipHistorical(d) ? 0.25 : 0.45))
    .attr('stroke', d => (State.getRelationshipColors()[d.relationship_category] || '#64748b'))
    .attr('stroke-width', 1.25)
    .attr('d', d => edgePath(positions, d));

  const nodeList = [];
  if (parent) nodeList.push({ ...parent, _col: 0, _role: 'parent' });
  children.forEach(c => nodeList.push({ ...c, _col: 1, _role: 'child' }));
  grandchildren.forEach(g => nodeList.push({ ...g, _col: 2, _role: 'grandchild' }));

  const nodes = layerNodes.selectAll('g.focus-node')
    .data(nodeList, d => d.id);

  nodes.exit()
    .transition().duration(duration * 0.7)
    .attr('opacity', 0)
    .remove();

  const enter = nodes.enter().append('g')
    .attr('class', 'focus-node')
    .attr('opacity', 0)
    .style('cursor', 'pointer');

  enter.append('rect').attr('class', 'focus-label-box');
  enter.append('text').attr('class', 'focus-label');
  enter.append('g').attr('class', 'focus-actions');
  enter.append('rect').attr('class', 'focus-hit');

  const merged = enter.merge(nodes);

  merged
    .transition().duration(duration)
    .attr('opacity', 1)
    .attr('transform', d => {
      const p = positions[d.id] || { x: 0, y: 0 };
      return `translate(${p.x},${p.y})`;
    })
    .attr('class', d => {
      let c = 'focus-node';
      if (d.id === State.selectedEntityId) c += ' focus-node-selected';
      if (d.id === State.focusEntityId) c += ' focus-node-focus';
      if (d._jemBrowseGroup) c += ' focus-node-group';
      return c;
    });

  merged.select('.focus-label')
    .attr('text-anchor', 'start')
    .attr('dominant-baseline', 'central')
    .attr('x', LABEL_OFFSET_X)
    .attr('y', 0)
    .attr('font-size', d => (d._col === 0 ? '12px' : '11px'))
    .attr('font-weight', d => {
      if (d.id === State.selectedEntityId) return '700';
      if (d._col === 0) return '700';
      return '500';
    })
    .attr('fill', d => labelFill(d, irColors))
    .text(d => labelLine(d));

  merged.select('.focus-actions').each(function renderActions(d) {
    const g = d3.select(this);
    g.selectAll('*').remove();
    if (d._col === 0 && d.id === State.focusEntityId) return;

    const btn = g.append('g')
      .attr('class', 'focus-drill-btn')
      .style('cursor', 'pointer')
      .on('click', (event) => {
        event.stopPropagation();
        State.setFocusEntity(d.id);
      });

    btn.append('text')
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'central')
      .attr('x', 0)
      .attr('fill', '#2563eb')
      .attr('font-size', '13px')
      .attr('font-weight', '700')
      .text('›');
    btn.append('title').text('Drill down (3 generations)');
  });

  layoutLabelBoxes(merged, irColors);

  merged.on('click', (event, d) => {
    event.stopPropagation();
    selectAndOpenEntity(d);
  });

  requestAnimationFrame(() => {
    updateContentBoundsFromDom();
    if (!userAdjustedZoom) {
      fitFocusToView({ animate: false });
      hasInitialFit = true;
    }
  });
  refreshViewStatus();
}

function layoutLabelBoxes(merged, irColors) {
  merged.each(function layoutOne(d) {
    const g = d3.select(this);
    const textNode = g.select('.focus-label').node();
    const box = g.select('.focus-label-box');
    const hit = g.select('.focus-hit');
    if (!textNode) return;

    const b = textNode.getBBox();
    const x = b.x - LABEL_PAD_X;
    const y = b.y - LABEL_PAD_Y;
    const w = b.width + LABEL_PAD_X * 2;
    const h = b.height + LABEL_PAD_Y * 2;

    box
      .attr('x', x)
      .attr('y', y)
      .attr('width', w)
      .attr('height', h)
      .attr('rx', 4)
      .attr('fill', labelBoxFill(d))
      .attr('stroke', labelBoxStroke(d, irColors))
      .attr('stroke-width', d.id === State.selectedEntityId || d.id === State.focusEntityId ? 1.5 : 1)
      .lower();

    hit.attr('x', x).attr('y', y).attr('width', w).attr('height', h).attr('fill', 'transparent');

    const actions = g.select('.focus-actions');
    if (!actions.select('.focus-drill-btn').empty()) {
      actions.attr('transform', `translate(${b.x + b.width + LABEL_PAD_X + 6}, 0)`);
    }
  });
}

function labelBoxFill(d) {
  if (d.id === State.selectedEntityId || d.id === State.focusEntityId) return '#eff6ff';
  if (d._jemBrowseGroup) return '#f8fafc';
  return '#ffffff';
}

function labelBoxStroke(d, irColors) {
  if (d.id === State.selectedEntityId || d.id === State.focusEntityId) return '#2563eb';
  if (State.showIndependenceRisk) {
    const level = (d.derived || {}).independence_risk_level || 'low';
    return irColors[level] || '#cbd5e1';
  }
  return '#e2e8f0';
}

function unionBBox(a, b) {
  if (!a || (a.width === 0 && a.height === 0)) return b;
  if (!b || (b.width === 0 && b.height === 0)) return a;
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x + a.width, b.x + b.width);
  const y1 = Math.max(a.y + a.height, b.y + b.height);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function updateContentBoundsFromDom() {
  const root = document.getElementById('focus-root');
  const nodesLayer = document.getElementById('focus-layer-nodes');
  const edgesLayer = document.getElementById('focus-layer-edges');
  if (!root || !svg) {
    contentBounds = { width: 800, height: 400, minX: 0, minY: 0 };
    return;
  }

  const pad = 48;
  const extraRight = 36;

  try {
    let bb = root.getBBox();
    if (nodesLayer) bb = unionBBox(bb, nodesLayer.getBBox());
    if (edgesLayer) bb = unionBBox(bb, edgesLayer.getBBox());

    if (!bb.width && !bb.height) {
      contentBounds = { width: 800, height: 400, minX: 0, minY: 0 };
      return;
    }

    const minX = bb.x - pad;
    const minY = bb.y - pad;
    const maxX = bb.x + bb.width + pad + extraRight;
    const maxY = bb.y + bb.height + pad;
    const contentW = Math.max(520, maxX - minX);
    const contentH = Math.max(280, maxY - minY);
    const viewH = canvasWrap?.clientHeight || 400;

    contentBounds = { minX, minY, width: contentW, height: contentH };

    const svgH = Math.max(contentH, viewH);
    svg
      .attr('width', contentW)
      .attr('height', svgH)
      .style('min-width', `${contentW}px`)
      .style('min-height', `${svgH}px`);
  } catch {
    contentBounds = { width: 800, height: 400, minX: 0, minY: 0 };
  }
}

function labelLine(d) {
  const gap = gapMarkerText(d);
  const primary = d._col === 0
    ? (d.name || d.abbreviation || d.id)
    : (d.abbreviation || d.name || d.id);
  const raw = gap ? `${gap} ${primary}` : primary;
  const maxLen = d._col === 2 ? 34 : d._col === 1 ? 38 : 44;
  return raw.length > maxLen ? `${raw.slice(0, maxLen - 1)}…` : raw;
}

function labelFill(d, irColors) {
  if (State.viewMode === 'gaps' && d.operational_status === 'De_Facto_Blocked') return '#c2410c';
  if (State.showIndependenceRisk) {
    const level = (d.derived || {}).independence_risk_level || 'low';
    return irColors[level] || '#111827';
  }
  if (d.id === State.selectedEntityId) return '#2563eb';
  if (d.id === State.focusEntityId) return '#1e40af';
  if (d._jemBrowseGroup) return '#6b7280';
  return '#111827';
}

function layoutTrinity(parent, children, grandchildren) {
  const pos = {};
  const colX = [PAD_LEFT + COL_W * 0.5, PAD_LEFT + COL_W + COL_GAP + COL_W * 0.5, PAD_LEFT + 2 * (COL_W + COL_GAP) + COL_W * 0.5];

  if (parent) pos[parent.id] = { x: colX[0], y: PAD_TOP + 48 };

  const layoutColumn = (items, col) => {
    const n = items.length;
    if (!n) return;
    const startY = PAD_TOP + 32;
    const totalH = (n - 1) * ROW_GAP;
    items.forEach((item, i) => {
      pos[item.id] = {
        x: colX[col],
        y: startY + (n === 1 ? 48 : i * ROW_GAP - totalH / 2 + 48),
      };
    });
  };

  layoutColumn(children, 1);
  layoutColumn(grandchildren, 2);
  return pos;
}

function edgePath(positions, rel) {
  const s = positions[rel.source];
  const t = positions[rel.target];
  if (!s || !t) return '';
  const sx = s.x + LABEL_OFFSET_X + 60;
  const tx = t.x + LABEL_OFFSET_X + 60;
  const mx = (sx + tx) / 2;
  return `M${sx},${s.y} Q${mx},${s.y} ${tx},${t.y}`;
}

function renderBreadcrumbs(parent) {
  if (!breadcrumbsEl) return;
  if (!parent) {
    breadcrumbsEl.innerHTML = '';
    return;
  }
  const crumbs = [];
  if (State.navMode === 'browse') {
    crumbs.push({ label: 'Browse', id: null });
    crumbs.push({ label: State.browseFacet, id: null });
  } else {
    crumbs.push({ label: 'Appellate', id: 'supreme_court_india' });
    let cur = parent.id;
    const chain = [parent];
    const parents = State._parentsByChild || {};
    while (parents[cur] && chain.length < 6) {
      cur = parents[cur];
      const ent = State.getEntityById(cur);
      if (ent) chain.unshift(ent);
    }
    chain.forEach(ent => {
      crumbs.push({
        label: ent.abbreviation || ent.name,
        id: ent.id,
      });
    });
  }
  breadcrumbsEl.innerHTML = crumbs.map((c) => {
    if (!c.id) return `<span class="focus-crumb dim">${c.label}</span>`;
    return `<button type="button" class="focus-crumb" data-focus-id="${c.id}">${c.label}</button>`;
  }).join('<span class="focus-crumb-sep">›</span>');

  breadcrumbsEl.querySelectorAll('[data-focus-id]').forEach(btn => {
    btn.addEventListener('click', () => State.setFocusEntity(btn.dataset.focusId));
  });
}

export function fitFocusToView(options = {}) {
  if (!canvasWrap || !zoomBehavior) return;
  updateContentBoundsFromDom();

  const ww = canvasWrap.clientWidth || 400;
  const wh = canvasWrap.clientHeight || 300;
  const { minX, minY, width: bw, height: bh } = contentBounds;

  const kWidth = (ww / bw) * 0.94;
  const kHeight = (wh / bh) * 0.94;
  let k = kWidth;
  if (bh * kWidth <= wh * 1.02) {
    k = Math.min(kWidth, kHeight);
  }
  k = Math.min(Math.max(k, 0.4), 3);

  const tx = (ww - bw * k) / 2 - minX * k;
  const ty = bh * k <= wh
    ? (wh - bh * k) / 2 - minY * k
    : 12 - minY * k;

  const t = d3.zoomIdentity.translate(tx, ty).scale(k);
  const sel = d3.select('#focus-svg');
  if (options.animate !== false && !prefersReducedMotion) {
    sel.transition().duration(280).call(zoomBehavior.transform, t);
  } else {
    sel.call(zoomBehavior.transform, t);
  }

  if (canvasWrap) {
    canvasWrap.scrollTop = 0;
    if (bw * k > ww * 1.02) canvasWrap.scrollLeft = 0;
  }
}

function zoomBy(factor) {
  if (!zoomBehavior) return;
  const sel = d3.select('#focus-svg');
  if (prefersReducedMotion) sel.call(zoomBehavior.scaleBy, factor);
  else sel.transition().duration(200).call(zoomBehavior.scaleBy, factor);
}

function updateMapHint() {
  const el = document.getElementById('focus-map-hint');
  if (!el) return;
  el.textContent = window.matchMedia('(max-width: 900px)').matches
    ? 'Drag to pan · pinch to zoom · use Tree tab for the full list'
    : 'Scroll to pan · drag map · Ctrl+wheel (or ⌘+wheel) to zoom';
}

export function render() {
  renderFocusCanvas();
}
