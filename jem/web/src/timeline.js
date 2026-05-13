// JEM — Timeline Scroller
// Persistent across all zoom levels.
// Marks key constitutional events on the track.
// Filters visible entities as year changes.

import { State } from './state.js';
import { render } from './renderer.js';

const YEAR_MIN = 1950;
const YEAR_MAX = new Date().getFullYear();

let isDragging = false;
let trackEl, thumbEl, progressEl, yearDisplay, eventsLayer;

export function initTimeline() {
  trackEl = document.getElementById('timeline-track');
  thumbEl = document.getElementById('timeline-thumb');
  progressEl = document.getElementById('timeline-progress');
  yearDisplay = document.getElementById('timeline-year-display');
  eventsLayer = document.getElementById('timeline-events-layer');

  // Be resilient to minor markup differences.
  const yearMaxEl = document.getElementById('timeline-year-max');
  if (yearMaxEl) yearMaxEl.textContent = YEAR_MAX;
  const rightLabelEl = document.getElementById('timeline-label-right');
  if (rightLabelEl) rightLabelEl.textContent = YEAR_MAX;

  // Set initial year
  setYear(YEAR_MAX);

  // Render event markers once graph is loaded
  State.subscribe('graphLoaded', () => {
    renderEventMarkers();
    setYear(YEAR_MAX);
  });

  // Drag handlers
  thumbEl.addEventListener('mousedown', startDrag);
  trackEl.addEventListener('mousedown', jumpToPosition);
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);

  // Touch support
  thumbEl.addEventListener('touchstart', e => { isDragging = true; e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', e => {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    handlePosition(touch.clientX);
  }, { passive: false });
  document.addEventListener('touchend', () => { isDragging = false; });
}

function startDrag(e) {
  isDragging = true;
  e.preventDefault();
}

function onDrag(e) {
  if (!isDragging) return;
  handlePosition(e.clientX);
}

function stopDrag() {
  isDragging = false;
}

function jumpToPosition(e) {
  if (e.target === thumbEl) return;
  handlePosition(e.clientX);
}

function handlePosition(clientX) {
  const rect = trackEl.getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const year = Math.round(YEAR_MIN + fraction * (YEAR_MAX - YEAR_MIN));
  setYear(year);
}

function setYear(year) {
  year = Math.max(YEAR_MIN, Math.min(YEAR_MAX, year));
  const fraction = (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN);

  // Position thumb
  const trackWidth = trackEl.offsetWidth;
  const thumbLeft = fraction * trackWidth;
  thumbEl.style.left = `${thumbLeft}px`;
  progressEl.style.width = `${fraction * 100}%`;

  yearDisplay.textContent = year;

  if (State.currentYear !== year) {
    State.setYear(year);
    render();
  }
}

function renderEventMarkers() {
  if (!State.graph) return;
  const events = State.graph.timeline_events || [];

  eventsLayer.innerHTML = '';
  events.forEach(ev => {
    const fraction = (ev.year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN);
    const left = fraction * 100;

    const marker = document.createElement('div');
    marker.className = `timeline-event-marker timeline-event-${ev.type || 'default'}`;
    marker.style.left = `${left}%`;
    marker.title = `${ev.year}: ${ev.label}`;

    // Tooltip on hover
    marker.addEventListener('mouseenter', (e) => {
      showEventTooltip(e, ev);
    });
    marker.addEventListener('mouseleave', () => {
      const t = document.getElementById('event-tooltip');
      if (t) t.remove();
    });

    eventsLayer.appendChild(marker);
  });
}

function showEventTooltip(e, ev) {
  const existing = document.getElementById('event-tooltip');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.id = 'event-tooltip';
  t.style.cssText = `
    position: fixed;
    left: ${e.clientX - 60}px;
    bottom: 70px;
    background: #1a1a2e;
    color: #eee;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    pointer-events: none;
    z-index: 1000;
    max-width: 240px;
    border: 1px solid #444;
    text-align: center;
  `;
  t.innerHTML = `<strong>${ev.year}</strong><br>${ev.label}`;
  document.body.appendChild(t);
}
