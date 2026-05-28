// JEM — Left navigator: virtualized tree + dual mode
import { State } from './state.js';
import { selectAndOpenEntity } from './entitySelection.js';

const ROW_H = 28;
const OVERSCAN = 8;

let listEl;
let scrollEl;
let viewportEl;
let flatRows = [];
let expanded = new Set(['__root__']);

export function initNavigatorTree() {
  scrollEl = document.getElementById('nav-tree-scroll');
  viewportEl = document.getElementById('nav-tree-viewport');
  listEl = document.getElementById('nav-tree-list');

  document.querySelectorAll('[data-nav-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-nav-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.setNavMode(btn.dataset.navMode);
      rebuildFlatRows();
      renderTree();
    });
  });

  document.querySelectorAll('[data-browse-facet]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-browse-facet]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.setBrowseFacet(btn.dataset.browseFacet);
      rebuildFlatRows();
      renderTree();
    });
  });

  document.querySelectorAll('.nav-preset').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  scrollEl?.addEventListener('scroll', () => renderTree());

  const events = ['graphLoaded', 'focusChanged', 'navModeChanged', 'browseFacetChanged', 'yearChanged', 'filterChanged', 'collapseChanged'];
  events.forEach(ev => State.subscribe(ev, () => {
    rebuildFlatRows();
    renderTree();
  }));

  State.subscribe('entitySelected', () => renderTree());
  State.subscribe('treeSelectionChanged', () => renderTree());

  State.subscribe('graphLoaded', () => {
    expanded.add('supreme_court_india');
    expanded.add('president_india');
    rebuildFlatRows();
    renderTree();
  });

  State.subscribe('focusChanged', (id) => {
    if (id && !id.startsWith('__browse_')) expandPathToEntity(id);
  });
}

function applyPreset(preset) {
  State.clearTreeSelection();
  if (preset === 'tribunals') {
    State.setNavMode('browse');
    State.setBrowseFacet('cluster');
    State.setFocusEntity(State.browseGroupId('cluster', 'tribunals_adr'));
    const ids = State._browseIndex?.cluster?.tribunals_adr || [];
    ids.forEach(id => State.toggleTreeSelection(id, true));
  } else if (preset === 'quasi') {
    State.setNavMode('browse');
    State.setBrowseFacet('type');
    const types = State._browseIndex?.type || {};
    for (const [t, ids] of Object.entries(types)) {
      if (t.includes('Regulatory') || t.includes('QJ')) ids.forEach(id => State.toggleTreeSelection(id, true));
    }
  } else if (preset === 'nclt') {
    const fuse = window.__jemFuse;
    if (fuse) {
      const hits = fuse.search('NCLT').slice(0, 40);
      hits.forEach(h => State.toggleTreeSelection(h.item.id, true));
      if (hits[0]) selectAndOpenEntity(hits[0].item);
    }
  } else if (preset === 'tamilnadu') {
    State.setNavMode('browse');
    State.setBrowseFacet('state');
    const key = Object.keys(State._browseIndex?.state || {}).find(k => /tamil/i.test(k));
    if (key) {
      State.setFocusEntity(State.browseGroupId('state', key));
      (State._browseIndex.state[key] || []).forEach(id => State.toggleTreeSelection(id, true));
    }
  }
  rebuildFlatRows();
  renderTree();
  State.emit('treeSelectionChanged', State.treeSelectedIds);
}

function rebuildFlatRows() {
  flatRows = [];
  if (!State.graph) return;

  if (State.navMode === 'appellate') {
    flatRows.push({ type: 'header', label: 'Appellate hierarchy' });
    const roots = ['supreme_court_india', 'president_india'].filter(r => State.getEntityById(r));
    for (const r of roots) walkAppellate(r, 0);
    return;
  }

  flatRows.push({ type: 'header', label: `Browse by ${State.browseFacet}` });
  const groups = State._browseIndex?.[State.browseFacet] || {};
  for (const key of Object.keys(groups).sort()) {
    const gid = State.browseGroupId(State.browseFacet, key);
    const depth = 0;
    flatRows.push({
      type: 'group',
      id: gid,
      label: key.replace(/_/g, ' '),
      depth,
      memberCount: groups[key].length,
      expanded: expanded.has(gid),
    });
    if (expanded.has(gid)) {
      for (const eid of groups[key]) {
        const e = State.getEntityById(eid);
        if (!e || !State._entityPassesTimeFilter(e)) continue;
        flatRows.push({ type: 'entity', id: eid, label: e.abbreviation || e.name, depth: 1 });
      }
    }
  }
}

function walkAppellate(id, depth) {
  const e = State.getEntityById(id);
  if (!e) return;
  const kids = State._childrenByParent?.[id] || [];
  flatRows.push({
    type: 'entity',
    id,
    label: e.abbreviation || e.name,
    depth,
    hasChildren: kids.length > 0,
    expanded: expanded.has(id),
  });
  if (kids.length && expanded.has(id)) {
    for (const kid of kids) walkAppellate(kid, depth + 1);
  }
}

function renderTree() {
  if (!listEl || !scrollEl) return;
  rebuildFlatRows();

  const totalH = flatRows.length * ROW_H;
  listEl.style.height = `${totalH}px`;

  const scrollTop = scrollEl.scrollTop;
  const viewH = scrollEl.clientHeight;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(flatRows.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);

  const frag = document.createDocumentFragment();
  for (let i = start; i < end; i++) {
    const row = flatRows[i];
    const el = document.createElement('div');
    el.className = 'nav-tree-row';
    el.style.top = `${i * ROW_H}px`;
    el.style.height = `${ROW_H}px`;
    el.style.paddingLeft = `${8 + (row.depth || 0) * 14}px`;

    if (row.type === 'header') {
      el.classList.add('nav-tree-header');
      el.textContent = row.label;
      frag.appendChild(el);
      continue;
    }

    if (row.type === 'group') {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'nav-tree-toggle';
      toggle.textContent = row.expanded ? '−' : '+';
      toggle.setAttribute('aria-label', row.expanded ? 'Collapse' : 'Expand');
      toggle.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (expanded.has(row.id)) expanded.delete(row.id);
        else expanded.add(row.id);
        renderTree();
      });
      el.appendChild(toggle);
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'nav-tree-label';
      label.textContent = `${row.label} (${row.memberCount})`;
      label.addEventListener('click', () => State.setFocusEntity(row.id));
      el.appendChild(label);
      frag.appendChild(el);
      continue;
    }

    if (row.hasChildren) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'nav-tree-toggle';
      toggle.textContent = row.expanded ? '−' : '+';
      toggle.setAttribute('aria-label', row.expanded ? 'Collapse' : 'Expand');
      toggle.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (expanded.has(row.id)) expanded.delete(row.id);
        else expanded.add(row.id);
        renderTree();
      });
      el.appendChild(toggle);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'nav-tree-toggle spacer';
      el.appendChild(spacer);
    }

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'nav-tree-check';
    cb.checked = State.treeSelectedIds.has(row.id);
    cb.addEventListener('click', (ev) => ev.stopPropagation());
    cb.addEventListener('change', () => {
      State.toggleTreeSelection(row.id, cb.checked);
    });
    el.appendChild(cb);

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'nav-tree-label';
    if (row.id === State.selectedEntityId) label.classList.add('selected');
    if (row.id === State.focusEntityId) label.classList.add('focused');
    label.textContent = row.label;
    label.addEventListener('click', () => selectAndOpenEntity(row.id));
    el.appendChild(label);

    frag.appendChild(el);
  }

  listEl.innerHTML = '';
  listEl.appendChild(frag);
}

export function expandPathToEntity(entityId) {
  if (!entityId) return;
  let cur = entityId;
  const parents = State._parentsByChild || {};
  while (cur) {
    expanded.add(cur);
    cur = parents[cur];
  }
  expanded.add('supreme_court_india');
  expanded.add('president_india');
}
