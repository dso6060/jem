// JEM — Shared node fill / kind helpers (focus canvas + map)
import { State } from './state.js';
import { entityNodeShape } from './nodeShapes.js';

export function entityVisualKind(e) {
  if (!e) return 'stakeholder';
  const t = e.type;
  const c = e.cluster;
  if (
    t === 'ConstitutionalCourt'
    || t === 'HighCourtBench'
    || t === 'SubordinateCivilCourt'
    || t === 'CityCivilCourt'
    || t === 'SpecialCourt'
  ) {
    return 'court';
  }
  if (
    t === 'RegulatoryBodyQJ'
    || t === 'ADRBody'
    || t === 'ConsumerCommission'
    || c === 'tribunals_adr'
    || c === 'arbitration'
    || c === 'regulatory_bodies'
  ) {
    return 'allied';
  }
  return 'stakeholder';
}

export function judicialBodyFill(level) {
  if (level === 'Central') return '#1e3d63';
  if (level === 'State') return '#1d4a2e';
  if (level === 'UT') return '#3a2850';
  if (level === 'Shared_MultiState') return '#3a2418';
  if (level === 'Shared_CentralState') return '#263818';
  return '#2d3436';
}

export function alliedBodyFill(d) {
  const c = d?.cluster;
  if (c === 'tribunals_adr') return '#2b6cb0';
  if (c === 'regulatory_bodies') return '#4a235a';
  if (c === 'arbitration') return '#3182ce';
  return '#3d5a80';
}

export function stakeholderNodeFill(level) {
  if (level === 'Central') return '#4a5568';
  if (level === 'State') return '#5a6b5c';
  return '#3d4852';
}

export function nodeFillColor(d) {
  const kind = entityVisualKind(d);
  if (kind === 'court') return judicialBodyFill(d.level_of_government);
  if (kind === 'allied') return alliedBodyFill(d);
  return stakeholderNodeFill(d.level_of_government);
}

export function focusNodeRadius(d) {
  const kind = entityVisualKind(d);
  let base = kind === 'stakeholder' ? 22 : 28;
  if (State?.showDiscretionaryPower) {
    const dp = (d.derived || {}).discretionary_power_score || 1;
    base = Math.min(base + dp * 1.2, 42);
  }
  return base;
}

export function gapMarkerText(d) {
  if (!State?.showGaps) return '';
  if (d.gap_flag || (Number(d.gap_count) || 0) > 0) return '*';
  if (d.structural_exception && State.showExceptions) return 'EX';
  const c = d.circularity_score ?? d.derived?.circularity_score ?? 0;
  if (c > 0 && State.showCircularity) return '⟳';
  return '';
}

export function isRectNode(d) {
  return entityNodeShape(d) === 'rect';
}
