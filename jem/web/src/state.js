// JEM — Central State Store
// All UI state lives here. Modules subscribe to changes.

// Relationship categories shown in Structure (and as baseline for other modes).
// Keeps the map navigable — appointment / funding / etc. edges, not appellate-only.
const DEFAULT_STRUCTURE_LENSES = [
  'appellate_chain',
  'appointment',
  'funding',
  'supervisory',
  'audit',
  'complaint',
  'digital',
  'security',
  'training',
  'statutory_ref',
];

export const State = {
  // ── Data ──────────────────────────────────────────────
  graph: null,           // Loaded graph.json

  // ── View ──────────────────────────────────────────────
  zoomLevel: 0,          // 0=Constellation 1=Backbone 2=SubEntity 3=DetailPanel
  zoomTransform: null,   // d3.zoomTransform — current pan/zoom
  zoomScale: 1,          // transform.k — updated on every zoom event (see setTransform)
  selectedEntityId: null,

  // ── Time ──────────────────────────────────────────────
  currentYear: new Date().getFullYear(),

  // ── View mode (Structure | Risk | Gaps) ───────────────
  viewMode: 'structure', // 'structure' | 'risk' | 'gaps'

  // ── Filters / Lenses ──────────────────────────────────
  // Default Structure mode: appellate hierarchy only.
  activeLenses: new Set(DEFAULT_STRUCTURE_LENSES),
  showInvestigativeOverlay: false,
  activeImpactFilter: null,   // 'high_independence_risk' | 'not_constituted' | etc.

  // ── Derived Score Toggles ──────────────────────────────
  showIndependenceRisk: false,
  showDiscretionaryPower: false,

  // ── Gaps mode overlays (driven by setViewMode) ─────────
  showGaps: false,
  showExceptions: false,
  showCircularity: false,

  // ── Case-volume overlay (toggled from KPI strip "Critical clog" card) ──
  showCaseVolume: false,

  // ── Expand/Collapse ────────────────────────────────────
  // When true, only roots + expanded appellate children are shown; nodes with children get +/−.
  // If the graph has no appellate_chain from SC/President, we stay flat (all entities visible).
  useProgressiveExplorer: false,
  expandedEntityIds: new Set(),
  hiddenEntityIds: new Set(),
  _childrenByParent: null,

  // ── Subscribers ────────────────────────────────────────
  _listeners: {},

  get(key) {
    return this[key];
  },

  subscribe(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  },

  emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  },

  // ── Setters ───────────────────────────────────────────
  setYear(year) {
    this.currentYear = year;
    this.emit('yearChanged', year);
  },

  setZoomLevel(level) {
    this.zoomLevel = level;
    this.emit('zoomLevelChanged', level);
    document.getElementById('zoom-level-label').textContent = `L${level}`;
  },

  setTransform(t) {
    this.zoomTransform = t;
    this.zoomScale = t.k;
    // Auto-infer zoom level from scale
    const k = t.k;
    // Keep the UX simple: avoid dropping into L0 (cluster dashboard),
    // which becomes unreadable at larger entity counts.
    let level = 1;
    if (k < 0.4) level = 1;
    else if (k >= 0.4 && k < 1.0) level = 1;
    else if (k >= 1.0 && k < 2.5) level = 2;
    else if (k >= 2.5) level = 2;  // Still Level 2 — Level 3 is click-triggered
    if (this.zoomLevel !== level) this.setZoomLevel(level);
  },

  selectEntity(id) {
    this.selectedEntityId = id;
    this.emit('entitySelected', id);
    if (id) this.setZoomLevel(3);
  },

  clearEntity() {
    this.selectedEntityId = null;
    this.emit('entitySelected', null);
    // Return to Level 1 or 2 based on current transform
    const k = this.zoomTransform ? this.zoomTransform.k : 0.3;
    this.setZoomLevel(k >= 1.0 ? 2 : k >= 0.4 ? 1 : 0);
  },

  setViewMode(mode) {
    if (mode !== 'structure' && mode !== 'risk' && mode !== 'gaps') return;
    this.viewMode = mode;
    this.activeLenses = new Set(DEFAULT_STRUCTURE_LENSES);
    this.showInvestigativeOverlay = false;

    if (mode === 'structure') {
      this.showIndependenceRisk = false;
      this.showDiscretionaryPower = false;
      this.showGaps = false;
      this.showExceptions = false;
      this.showCircularity = false;
    } else if (mode === 'risk') {
      this.showIndependenceRisk = true;
      this.showDiscretionaryPower = true;
      this.showGaps = false;
      this.showExceptions = false;
      this.showCircularity = false;
    } else {
      this.showIndependenceRisk = false;
      this.showDiscretionaryPower = false;
      this.showGaps = true;
      this.showExceptions = true;
      this.showCircularity = true;
    }

    this.emit('viewModeChanged', mode);
    this.emit('lensChanged', 'viewMode');
    this.emit('derivedToggle', 'viewMode');
  },

  toggleLens(lens) {
    if (lens === 'investigative') {
      this.showInvestigativeOverlay = !this.showInvestigativeOverlay;
      this.emit('lensChanged', lens);
      return;
    }
    if (this.activeLenses.has(lens)) {
      this.activeLenses.delete(lens);
    } else {
      this.activeLenses.add(lens);
    }
    this.emit('lensChanged', lens);
  },

  /** All standard relationship categories (not the CBI/ED overlay). */
  selectAllRelationshipLenses() {
    this.activeLenses = new Set(DEFAULT_STRUCTURE_LENSES);
    this.emit('lensChanged', 'bulk');
  },

  /** No relationship edges; turns off investigative overlay too. */
  clearAllRelationshipLenses() {
    this.activeLenses = new Set();
    this.showInvestigativeOverlay = false;
    this.emit('lensChanged', 'bulk');
  },

  setImpactFilter(filterKey) {
    if (this.activeImpactFilter === filterKey) {
      this.activeImpactFilter = null;
    } else {
      this.activeImpactFilter = filterKey;
    }
    this.emit('filterChanged', this.activeImpactFilter);
  },

  toggleIR() {
    this.showIndependenceRisk = !this.showIndependenceRisk;
    this.emit('derivedToggle', 'ir');
  },

  toggleDP() {
    this.showDiscretionaryPower = !this.showDiscretionaryPower;
    this.emit('derivedToggle', 'dp');
  },

  toggleCaseVolume() {
    this.showCaseVolume = !this.showCaseVolume;
    this.emit('derivedToggle', 'caseVolume');
  },

  initExplorerDefaults() {
    if (!this.graph) return;
    this._childrenByParent = this._buildChildrenByParent();
    const roots = ['supreme_court_india', 'president_india'];
    const anyAppellateChild = roots.some(
      r => (this._childrenByParent[r] || []).length > 0
    );
    if (!anyAppellateChild) {
      this.useProgressiveExplorer = false;
      this.expandedEntityIds = new Set();
      this.hiddenEntityIds = new Set();
      this.emit('collapseChanged', null);
      return;
    }
    this.useProgressiveExplorer = true;
    this.expandedEntityIds = new Set();
    this._recomputeHiddenFromExpanded();
    this.emit('collapseChanged', null);
  },

  toggleExpand(entityId) {
    if (!entityId) return;
    if (!this.useProgressiveExplorer) return;
    if (this.expandedEntityIds.has(entityId)) {
      this.expandedEntityIds.delete(entityId);
    } else {
      this.expandedEntityIds.add(entityId);
    }
    this._recomputeHiddenFromExpanded();
    this.emit('collapseChanged', entityId);
  },

  /** Expand every branch under SC/President so the full appellate subtree is visible. */
  expandAllAppellateInExplorer() {
    if (!this.useProgressiveExplorer || !this.graph) return;
    if (!this._childrenByParent) this._childrenByParent = this._buildChildrenByParent();
    const roots = ['supreme_court_india', 'president_india'];
    const expanded = new Set();
    const q = roots.filter(r => this.graph.entities.some(e => e.id === r));
    const seen = new Set();
    while (q.length) {
      const id = q.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      const ch = this._childrenByParent[id] || [];
      if (ch.length) {
        expanded.add(id);
        for (const c of ch) q.push(c);
      }
    }
    this.expandedEntityIds = expanded;
    this._recomputeHiddenFromExpanded();
    this.emit('collapseChanged', 'expandAll');
  },

  /** Collapse back to roots only (still in progressive mode). */
  collapseExplorerToRoots() {
    if (!this.useProgressiveExplorer || !this.graph) return;
    this.expandedEntityIds = new Set();
    this._recomputeHiddenFromExpanded();
    this.emit('collapseChanged', 'collapseRoots');
  },

  _buildChildrenByParent() {
    const children = {};
    for (const r of (this.graph?.relationships || [])) {
      if (r.relationship_category !== 'appellate_chain') continue;
      const parent = r.target;
      const child = r.source;
      if (!parent || !child) continue;
      (children[parent] ||= []).push(child);
    }
    return children;
  },

  _recomputeHiddenFromExpanded() {
    if (!this.graph) return;
    if (!this._childrenByParent) this._childrenByParent = this._buildChildrenByParent();

    const allIds = new Set((this.graph.entities || []).map(e => e.id));
    const visible = new Set();

    // Roots always visible (top-level band)
    const roots = ['supreme_court_india', 'president_india'];
    for (const r of roots) if (allIds.has(r)) visible.add(r);

    // Reveal tree one level at a time based on expanded nodes.
    const stack = [...visible];
    while (stack.length) {
      const cur = stack.pop();
      if (!this.expandedEntityIds.has(cur)) continue;
      const kids = this._childrenByParent[cur] || [];
      for (const k of kids) {
        if (!allIds.has(k) || visible.has(k)) continue;
        visible.add(k);
        stack.push(k);
      }
    }

    this.hiddenEntityIds = new Set([...allIds].filter(id => !visible.has(id)));
  },

  // ── Queries ───────────────────────────────────────────
  getVisibleEntities() {
    if (!this.graph) return [];
    return this.graph.entities.filter(e => {
      if (this.hiddenEntityIds.has(e.id)) return false;
      // Time filter
      const created = e.created_year || 1950;
      const abolished = e.abolished_year || 9999;
      if (created > this.currentYear) return false;
      // If abolished before current year AND we are past abolition:
      // still show, but as ghost (handled by renderer opacity)

      // Impact filter
      if (this.activeImpactFilter) {
        return this._matchesImpactFilter(e, this.activeImpactFilter);
      }

      return true;
    });
  },

  _matchesImpactFilter(entity, filter) {
    const derived = entity.derived || {};
    switch(filter) {
      case 'high_independence_risk':
        return ['high', 'severe'].includes(derived.independence_risk_level);
      case 'appointer_funder_same':
        // Approximation — full check in build.py
        return derived.independence_risk_score >= 7;
      case 'no_public_criteria':
        return entity.appointment_criteria_public === false;
      case 'not_constituted':
        return entity.operational_status === 'Not_Constituted';
      case 'no_external_complaint':
        return entity.complaint_external_exists === false;
      case 'blocked_or_absent':
        // KPI card 3 — appellate vacuums + bodies legislated but never set up.
        return entity.operational_status === 'De_Facto_Blocked'
            || entity.operational_status === 'Not_Constituted';
      default:
        return true;
    }
  },

  getVisibleRelationships() {
    if (!this.graph) return [];
    const visibleIds = new Set(this.getVisibleEntities().map(e => e.id));

    return this.graph.relationships.filter(r => {
      // Both endpoints must be visible
      if (!visibleIds.has(r.source) || !visibleIds.has(r.target)) return false;

      // Historical relationships: show as faded if year_abolished < currentYear
      // (handled by renderer opacity, not filtered out)

      // Lens filter
      if (r.relationship_category === 'investigative') {
        return this.showInvestigativeOverlay;
      }
      return this.activeLenses.has(r.relationship_category);
    });
  },

  // Graph bundles may nest palettes under `legends` (repo-root graph.json) or
  // expose the same keys at the top level (jem/scripts/build.py output).
  getRelationshipColors() {
    if (!this.graph) return {};
    return this.graph.legends?.relationship_colors
      || this.graph.relationship_colors
      || {};
  },

  getDataQualityLegend() {
    if (!this.graph) return {};
    return this.graph.legends?.data_quality
      || this.graph.data_quality_legend
      || {};
  },

  getOperationalStatusLegend() {
    if (!this.graph) return {};
    return this.graph.legends?.operational_status
      || this.graph.operational_status_legend
      || {};
  },

  getIndependenceRiskColors() {
    if (!this.graph) return {};
    return this.graph.legends?.independence_risk_colors
      || this.graph.independence_risk_colors
      || {};
  },

  getEntityById(id) {
    if (!this.graph) return null;
    return this.graph.entities.find(e => e.id === id) || null;
  },

  isEntityVisible(entity) {
    const created = entity.created_year || 1950;
    return created <= this.currentYear;
  },

  isEntityHistorical(entity) {
    const abolished = entity.abolished_year;
    return abolished && abolished < this.currentYear;
  },

  isRelationshipHistorical(rel) {
    const abolished = rel.year_abolished;
    return abolished && abolished < this.currentYear;
  },
};
