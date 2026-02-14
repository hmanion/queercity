// weekday.module.fixed.js (ESM)
// Fixes SyntaxError from shadowing imported `createSection`.
// Uses only the shared `createSection` from events-shared-utils.js
// Also: rotates days so today is first, sorts by time, formats ordinals & times with en‑dash.

import {
  SEP_EN,
  formatTimeRange, parseTimeToMinutes,
  createSection,
  getEventStartTime, getEventEndTime,
  getRecurringDayWeek
} from './events-shared-utils.js';
import { buildEventCard } from './event-card.module.js';
import { fetchJsonWithFallback } from './fetch-json.module.js';

function normalizeWeekday(s) { return String(s || '').trim().toLowerCase(); }
function titleCase(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

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

fetchJsonWithFallback('../api/directory.php?limit=2000', '../directory.json')
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
      arr.forEach(ev => {
        const box = buildEventCard(ev, counter++, {
          idPrefix: 'weekdayEvent',
          topIdPrefix: 'weekdayEventTop',
          bottomIdPrefix: 'weekdayEventBottom',
          nameIdPrefix: 'weekdayName',
          categoryIdPrefix: 'weekdayCategory',
          locationIdPrefix: 'weekdayLocation',
          dateBeforeLink: true,
          dateText: (item) => formatTimeRange(getEventStartTime(item), getEventEndTime(item), SEP_EN),
          recurringLabelMode: 'weekday',
        });
        frag.appendChild(box);
      });
      listEl.appendChild(frag);
      listEl.parentElement.style.display = '';
    });
  })
  .catch(err => console.error('Error building weekday page:', err));
