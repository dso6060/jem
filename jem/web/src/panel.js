// D3LEM — Entity Detail Panel (Level 3)
// Opens on entity click. Shows all attributes with sourced facts.
// Derived scores shown with "Pending review" notice if not validated.

import { State } from './state.js';

export function openDetailPanel(entity) {
  const panel = document.getElementById('detail-panel');
  const nameEl = document.getElementById('detail-entity-name');
  const typeEl = document.getElementById('detail-entity-type');
  const body = document.getElementById('detail-panel-body');

  nameEl.textContent = entity.name;
  if (entity.name_hindi) {
    nameEl.innerHTML = `${entity.name}<span class="detail-name-hindi"> ${entity.name_hindi}</span>`;
  }

  typeEl.textContent = `${formatType(entity.type)} · ${entity.level_of_government} · ${entity.operational_status}`;
  typeEl.className = `detail-type status-${entity.operational_status.toLowerCase().replace('_','-')}`;

  body.innerHTML = buildPanelHTML(entity);

  panel.classList.remove('hidden');
  panel.scrollTop = 0;
}

export function closeDetailPanel() {
  document.getElementById('detail-panel').classList.add('hidden');
  State.clearEntity();
}

function buildPanelHTML(e) {
  const d = e._detail || {};
  const derived = e.derived || {};
  const irColors = State.graph ? State.getIndependenceRiskColors() : {};
  const irLevel = derived.independence_risk_level || 'unknown';
  const irScore = derived.independence_risk_score;
  const dpScore = derived.discretionary_power_score;

  let html = '';

  // ── Data Quality Banner ────────────────────────────────
  html += `<div class="detail-quality-banner quality-${e.data_quality}">
    ${qualityIcon(e.data_quality)} Data: <strong>${e.data_quality}</strong>
    ${e.data_quality_notes ? `— ${e.data_quality_notes}` : ''}
  </div>`;

  // ── Lifecycle ──────────────────────────────────────────
  html += section('Lifecycle', `
    <div class="detail-row"><span class="lbl">Established</span><span>${e.created_year}</span></div>
    ${e.abolished_year ? `<div class="detail-row abolished"><span class="lbl">Abolished</span><span>${e.abolished_year}</span></div>` : ''}
    <div class="detail-row"><span class="lbl">Status</span><span class="status-badge status-${(e.operational_status||'').toLowerCase().replace('_','-')}">${e.operational_status}</span></div>
    ${e.constitutional_basis ? `<div class="detail-row"><span class="lbl">Constitutional basis</span><span class="monospace">${e.constitutional_basis}</span></div>` : ''}
    ${e.statutory_basis ? `<div class="detail-row"><span class="lbl">Statutory basis</span><span>${e.statutory_basis}</span></div>` : ''}
  `);

  // ── Appointment Chain ──────────────────────────────────
  if (d.appointment) {
    const a = d.appointment;
    html += section('Appointment Chain', `
      ${row('Nominates', a.nominates)}
      ${row('Recommends', a.recommends)}
      ${a.consulted && a.consulted.length ? row('Consulted (binding: ' + (a.consultation_binding ? 'YES' : 'no') + ')', a.consulted.join(', ')) : ''}
      ${row('Formally appoints', a.formally_appoints)}
      ${a.criteria_public !== null && a.criteria_public !== undefined ?
        `<div class="detail-row ${!a.criteria_public ? 'risk-flag' : ''}">
          <span class="lbl">Appointment criteria public?</span>
          <span>${a.criteria_public ? '✓ Yes' : '✗ No — opacity risk'}</span>
        </div>` : ''}
      ${row('Tenure', a.tenure)}
      ${a.reappointment_possible !== undefined ?
        `<div class="detail-row ${a.reappointment_possible ? 'risk-flag' : ''}">
          <span class="lbl">Reappointment possible?</span>
          <span>${a.reappointment_possible ? '⚠ Yes — creates dependency' : '✓ No'}</span>
        </div>` : ''}
      ${row('Removal authority', a.removal_authority)}
      ${a.removal_requires_parliament !== undefined ?
        `<div class="detail-row">
          <span class="lbl">Removal requires Parliament?</span>
          <span>${a.removal_requires_parliament ? '✓ Yes' : '✗ No'}</span>
        </div>` : ''}
    `);
  }

  // ── Funding ────────────────────────────────────────────
  if (d.funding) {
    const f = d.funding;
    html += section('Funding', `
      ${row('Primary source', f.primary_source)}
      ${row('Responsible ministry', f.ministry_responsible)}
      ${f.state_contribution_percent ? row('State share', f.state_contribution_percent + '%') : ''}
      ${f.budget_figure_crore ? row('Budget (₹ crore)', `${f.budget_figure_crore} Cr (FY ${f.budget_year})`) : ''}
    `);
  }

  // ── Audit ──────────────────────────────────────────────
  if (d.audit) {
    const a = d.audit;
    html += section('Audit & Oversight', `
      ${row('Audited by', a.audited_by)}
      ${row('Audit type', a.audit_type)}
      ${a.audit_report_public !== undefined ?
        `<div class="detail-row">
          <span class="lbl">Audit reports public?</span>
          <span>${a.audit_report_public ? '✓ Yes' : '✗ No'}</span>
        </div>` : ''}
      ${row('Conduct oversight body', a.conduct_oversight_body || 'None identified')}
    `);
  }

  // ── Complaint Mechanism ────────────────────────────────
  if (d.complaint_mechanism) {
    const c = d.complaint_mechanism;
    let complaintHtml = '';
    if (c.bias_complaint_to && c.bias_complaint_to.length > 0) {
      c.bias_complaint_to.forEach((b, i) => {
        complaintHtml += `<div class="complaint-body">
          <strong>${i+1}. ${b.body}</strong>
          <div class="complaint-detail">${b.mechanism}</div>
          <div class="complaint-flags">
            ${b.external_to_judiciary ? '<span class="flag green">External oversight</span>' : '<span class="flag orange">Internal only</span>'}
            ${b.is_public_process ? '<span class="flag green">Public process</span>' : '<span class="flag grey">Not public</span>'}
            ${b.complainant_has_locus ? '<span class="flag green">Complainant has locus</span>' : '<span class="flag red">No locus for complainant</span>'}
            ${b.timeframe_defined ? '<span class="flag green">Timeframe defined</span>' : '<span class="flag grey">No defined timeframe</span>'}
          </div>
        </div>`;
      });
    } else {
      complaintHtml = '<div class="risk-flag-block">⚠ No complaint mechanism found</div>';
    }
    if (c.criminal_prosecution) {
      const cp = c.criminal_prosecution;
      complaintHtml += `<div class="detail-row risk-flag">
        <span class="lbl">Criminal prosecution requires sanction from</span>
        <span>${cp.requires_sanction_from}</span>
      </div>`;
      if (cp.consultation_required_with) {
        complaintHtml += `<div class="detail-row ${cp.consultation_binding ? 'risk-flag' : ''}">
          <span class="lbl">Consultation with (binding: ${cp.consultation_binding ? 'YES' : 'no'})</span>
          <span>${cp.consultation_required_with}</span>
        </div>`;
      }
    }
    if (c.lokpal_jurisdiction) {
      const ljClass = c.lokpal_jurisdiction === 'No' ? 'risk-flag' : c.lokpal_jurisdiction === 'Contested' ? 'contested-flag' : '';
      complaintHtml += `<div class="detail-row ${ljClass}">
        <span class="lbl">Lokpal jurisdiction</span>
        <span>${c.lokpal_jurisdiction}${c.lokpal_jurisdiction_note ? ' — ' + c.lokpal_jurisdiction_note : ''}</span>
      </div>`;
    }
    html += section('Complaint Mechanism (Bias / Misconduct)', complaintHtml);
  }

  // ── Derived Scores ─────────────────────────────────────
  if (irScore !== undefined || dpScore !== undefined) {
    const validated = derived.scores_validated;
    html += `<div class="detail-section">
      <div class="detail-section-title">
        Structural Risk Indicators
        ${!validated ? '<span class="unvalidated-badge">⚐ Pending community review</span>' : ''}
      </div>
      ${irScore !== undefined ? `
        <div class="score-row">
          <div class="score-label">Independence Risk</div>
          <div class="score-bar-outer">
            <div class="score-bar-fill ir-${irLevel}" style="width:${Math.min(100, irScore*8)}%"></div>
          </div>
          <div class="score-number" style="color:${irColors[irLevel] || '#27ae60'}">${irScore} — ${irLevel.toUpperCase()}</div>
        </div>
        ${buildBreakdown(derived.independence_risk_breakdown)}
      ` : ''}
      ${dpScore !== undefined ? `
        <div class="score-row" style="margin-top:12px">
          <div class="score-label">Discretionary Power</div>
          <div class="score-bar-outer">
            <div class="score-bar-fill dp" style="width:${Math.min(100, dpScore*6)}%"></div>
          </div>
          <div class="score-number">${dpScore}</div>
        </div>
        ${buildBreakdown(derived.discretionary_power_breakdown)}
      ` : ''}
      <div class="score-note">
        These scores are algorithmically derived from the data fields above.
        They are structural indicators, not judgments on conduct.
        Each factor links back to a data field — see ARCHITECTURE.md.
      </div>
    </div>`;
  }

  // ── Sources ────────────────────────────────────────────
  if (e.sources && e.sources.length > 0) {
    let sourceHtml = e.sources.map(s =>
      `<div class="source-row">
        <span class="source-type source-type-${(s.type||'').toLowerCase()}">${s.type || '?'}</span>
        <a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.label}</a>
        ${s.accessed_date ? `<span class="source-date">Accessed ${s.accessed_date}</span>` : ''}
      </div>`
    ).join('');
    html += section('Primary Sources', sourceHtml);
  }

  return html;
}

// ── HTML Helpers ──────────────────────────────────────────────────────────────

function section(title, content) {
  if (!content || content.trim() === '') return '';
  return `<div class="detail-section">
    <div class="detail-section-title">${title}</div>
    ${content}
  </div>`;
}

function row(label, value) {
  if (!value) return '';
  return `<div class="detail-row">
    <span class="lbl">${label}</span>
    <span>${value}</span>
  </div>`;
}

function buildBreakdown(breakdown) {
  if (!breakdown || Object.keys(breakdown).length === 0) return '';
  let html = '<div class="breakdown">';
  Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, pts]) => {
      const sign = pts >= 0 ? '+' : '';
      const cls = pts > 0 ? 'breakdown-positive' : 'breakdown-negative';
      html += `<div class="breakdown-row ${cls}">
        <span class="breakdown-pts">${sign}${pts}</span>
        <span class="breakdown-reason">${reason}</span>
      </div>`;
    });
  html += '</div>';
  return html;
}

function qualityIcon(dq) {
  switch(dq) {
    case 'verified': return '✓';
    case 'complete': return '✓';
    case 'partial': return '?';
    case 'unverified': return '~';
    case 'contested': return '⚑';
    default: return '';
  }
}

function formatType(type) {
  return (type || '').replace(/([A-Z])/g, ' $1').trim();
}

// ── Event Binding (called after DOM ready) ────────────────────────────────────

export function initPanel() {
  document.getElementById('detail-close').addEventListener('click', closeDetailPanel);
  State.subscribe('entitySelected', id => {
    if (!id) closeDetailPanel();
  });
}
