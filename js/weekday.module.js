// weekday.module.fixed.js (ESM)
// Fixes SyntaxError from shadowing imported `createSection`.
// Uses only the shared `createSection` from events-shared-utils.js
// Also: rotates days so today is first, sorts by time, formats ordinals & times with en‑dash.

import {
  SEP_EN, EN_DASH,
  formatTimeRange, parseTimeToMinutes,
  formatOccurrenceDisplay, createSection,
  getCategory, getLocationParts, getEventUrl,
  getEventStartTime, getEventEndTime,
  getRecurringFrequency, getRecurringOccurrence, getRecurringDayWeek
} from './events-shared-utils.js';

function normalizeWeekday(s) { return String(s || '').trim().toLowerCase(); }
function titleCase(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

function buildEventBox(event, index) {
  const i = index + 1;
  const eventBox = document.createElement('div');
  eventBox.id = `weekdayEvent${i}`;
  eventBox.className = 'eventbox';

  const eventBoxTop = document.createElement('div');
  eventBoxTop.id = `weekdayEventTop${i}`;
  eventBoxTop.className = 'eventboxtop';

  const eventBoxBottom = document.createElement('div');
  eventBoxBottom.id = `weekdayEventBottom${i}`;
  eventBoxBottom.className = 'eventboxbottom';

  const eventTime = document.createElement('div');
  eventTime.className = 'date';
  eventTime.textContent = formatTimeRange(getEventStartTime(event), getEventEndTime(event), SEP_EN);

  const link = document.createElement('a');
  const url = getEventUrl(event);
  if (url) { link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; }

  const nameDiv = document.createElement('div');
  nameDiv.className = 'name';
  nameDiv.id = `weekdayName${i}`;
  nameDiv.textContent = event.name || 'Untitled event';
  link.appendChild(nameDiv);

  const catDiv = document.createElement('div');
  const category = getCategory(event);
  catDiv.className = 'category ' + category;
  catDiv.id = `weekdayCategory${i}`;
  catDiv.textContent = category;

  const locDiv = document.createElement('div');
  locDiv.className = 'location';
  locDiv.id = `weekdayLocation${i}`;
  locDiv.textContent = getLocationParts(event).join(', ');

  eventBoxTop.appendChild(eventTime);
  eventBoxTop.appendChild(link);
  eventBoxTop.appendChild(locDiv);
  eventBox.appendChild(eventBoxTop);
  eventBoxBottom.appendChild(catDiv);

  const freq = getRecurringFrequency(event);
  if (freq) {
    const label = document.createElement('div');
    label.className = 'category recurring';
    const occ = formatOccurrenceDisplay(getRecurringOccurrence(event));
    label.textContent = occ ? `${freq} ${EN_DASH} ${occ}` : String(freq);
    eventBoxBottom.appendChild(label);
  }

  eventBox.appendChild(eventBoxBottom);
  return eventBox;
}

function groupByWeekday(events) {
  const groups = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
  (events || []).forEach(ev => {
    const wd = normalizeWeekday(getRecurringDayWeek(ev));
    if (Object.prototype.hasOwnProperty.call(groups, wd)) groups[wd].push(ev);
  });
  return groups;
}

function sortByTimeThenName(arr) {
  return (arr || []).slice().sort((a, b) => {
    const ma = parseTimeToMinutes(getEventStartTime(a));
    const mb = parseTimeToMinutes(getEventStartTime(b));
    if (Number.isNaN(ma) && Number.isNaN(mb)) return String(a.name||'').localeCompare(String(b.name||''));
    if (Number.isNaN(ma)) return 1;
    if (Number.isNaN(mb)) return -1;
    if (ma !== mb) return ma - mb;
    return String(a.name||'').localeCompare(String(b.name||''));
  });
}

fetch('../api/directory.php?limit=2000')
  .then(r => r.json())
  .then(directory => {
    const container = document.getElementById('weekdaylist');
    if (!container) return;
    const groups = groupByWeekday(directory || []);

    // Rotate weekdays so the current day appears first (browser local time)
    const baseOrder = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const jsDay = new Date().getDay(); // 0=Sun..6=Sat
    const startIndex = (jsDay + 6) % 7; // map to Mon=0..Sun=6
    const order = baseOrder.slice(startIndex).concat(baseOrder.slice(0, startIndex));

    let counter = 0;
    order.forEach(wd => {
      const listEl = createSection(container, titleCase(wd) + 's', `${wd}`);
      listEl.innerHTML = '';
      const arr = sortByTimeThenName(groups[wd] || []);
      if (!arr.length) { listEl.parentElement.style.display = 'none'; return; }
      const frag = document.createDocumentFragment();
      arr.forEach(ev => { const box = buildEventBox(ev, counter++); frag.appendChild(box); });
      listEl.appendChild(frag);
      listEl.parentElement.style.display = '';
    });
  })
  .catch(err => console.error('Error building weekday page:', err));
