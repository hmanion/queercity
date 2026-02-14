// events-shared-utils.js
// One shared ES module for both pages (main listings + weekday view)
// Goals: eliminate duplication, fix date parsing (local), unify dashes, centralise recurrence logic.
// Usage: <script type="module" src="..."> and import the pieces you need.

// Typography
export const NBSP   = "\u00A0";   
export const EN_DASH = "\u2013"
export const EM_DASH = "\u2014";
export const SEP_EN = NBSP + EN_DASH + NBSP; // preferred time/date sep: 19:00 – 21:00
export const SEP_EM = NBSP + EM_DASH + NBSP; // alt sep if you prefer em dash
export const FILTER_CATEGORIES = ['Activity', 'Arts', 'Club', 'Celebration', 'Life', 'Sexy'];

// Date helpers (local, day-precise)
export function parseISODateLocal(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const dateOnly = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const y = Number(dateOnly[1]), mo = Number(dateOnly[2]) - 1, d = Number(dateOnly[3]);
    const dt = new Date(y, mo, d, 0, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dateTime = new Date(iso);
  return Number.isNaN(dateTime.getTime()) ? null : dateTime;
}

export const startOfDay = (date) => { const d = new Date(date); d.setHours(0,0,0,0); return d; };
export const endOfDay   = (date) => { const d = new Date(date); d.setHours(23,59,59,999); return d; };
export function startOfWeek(date) { const d = new Date(date); const day = (d.getDay()+6)%7; d.setDate(d.getDate()-day); d.setHours(0,0,0,0); return d; }
export function endOfWeek(date)   { const s = startOfWeek(date); const e = new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); return e; }
export function startOfMonth(date){ const d = new Date(date.getFullYear(), date.getMonth(), 1); d.setHours(0,0,0,0); return d; }
export function endOfMonth(date)  { const d = new Date(date.getFullYear(), date.getMonth()+1, 0); d.setHours(23,59,59,999); return d; }
export function isSameMonth(d1,d2){ return d1.getMonth()===d2.getMonth() && d1.getFullYear()===d2.getFullYear(); }
export function toISODate(d)      { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }

export function formatDate(dateStr, locale='en-GB') {
  const d = parseISODateLocal(dateStr);
  if (!d) return '';
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}

export function toHHMM(t) {
  if (!t || typeof t !== 'string') return '';
  const m = t.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  return m ? `${m[1]}:${m[2]}` : t;
}

export function splitKeywords(keywords) {
  if (Array.isArray(keywords)) return keywords.map(x => String(x).trim().toLowerCase()).filter(Boolean);
  if (!keywords || typeof keywords !== 'string') return [];
  return keywords.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
}

function normalizeCategoryLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw === raw.toLowerCase()) {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  return raw;
}

export function getCategory(ev) {
  const v = ev && (ev.category || ev.genre || ev.eventType);
  const label = v ? normalizeCategoryLabel(v) : '';
  if (label.toLowerCase() === 'music') return 'Club';
  return label;
}
export function getEventUrl(ev) { return ev && ev.url ? String(ev.url) : ''; }
export function getEventImage(ev) { return ev && ev.image ? ev.image : ''; }
export function getEventPrice(ev) {
  if (!ev) return '';
  if (ev.offers && ev.offers.price != null && ev.offers.price !== '') return String(ev.offers.price);
  return ev.price != null ? String(ev.price) : '';
}
export function getEventStartTime(ev) {
  if (!ev) return '';
  if (ev.startTime) return toHHMM(String(ev.startTime));
  if (ev.eventSchedule && ev.eventSchedule.startTime) return toHHMM(String(ev.eventSchedule.startTime));
  const s = String(ev.startDate || '');
  const m = s.match(/T(\d{2}:\d{2})(?::\d{2})?/);
  return m ? m[1] : '';
}
export function getEventEndTime(ev) {
  if (!ev) return '';
  if (ev.endTime) return toHHMM(String(ev.endTime));
  if (ev.eventSchedule && ev.eventSchedule.endTime) return toHHMM(String(ev.eventSchedule.endTime));
  const s = String(ev.endDate || '');
  const m = s.match(/T(\d{2}:\d{2})(?::\d{2})?/);
  return m ? m[1] : '';
}
export function formatEventDateTime(ev, sep = SEP_EN) {
  if (!ev) return '';
  const start = formatDate(ev.startDate);
  if (!start) return '';
  const startTime = getEventStartTime(ev);
  const endTime = getEventEndTime(ev);
  if (ev.endDate && !endTime) {
    const end = formatDate(ev.endDate);
    return `${start}${sep}${end}`;
  }
  if (startTime && endTime) return `${start} ${formatTimeRange(startTime, endTime, sep)}`;
  if (startTime) return `${start} ${startTime}`;
  return start;
}
function isManchesterLocality(value) {
  const norm = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  return norm === 'manchester' || norm === 'cityofmanchester';
}
export function getLocationParts(ev) {
  if (!ev) return [];
  const includeTown = (town) => (town && !isManchesterLocality(town) ? town : '');
  if (ev.locName || ev.locStreet || ev.locTown || ev.locPost) {
    return [ev.locName, ev.locStreet, includeTown(ev.locTown), ev.locPost].filter(Boolean);
  }
  const loc = ev.location || {};
  const addr = loc.address || {};
  return [loc.name, addr.streetAddress, includeTown(addr.addressLocality), addr.postalCode].filter(Boolean);
}
export function getTagsList(ev) {
  if (!ev) return [];
  if (Array.isArray(ev.tags)) return ev.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean);
  return splitKeywords(ev.keywords);
}
export function getRecurringFrequency(ev) {
  if (!ev) return '';
  if (ev.frequency) return String(ev.frequency);
  const rf = ev.eventSchedule && ev.eventSchedule.repeatFrequency ? String(ev.eventSchedule.repeatFrequency) : '';
  if (rf === 'P1W') return 'Weekly';
  if (rf === 'P2W') return 'Fortnightly';
  if (rf === 'P1M') return 'Monthly';
  return rf;
}
export function getRecurringDayWeek(ev) {
  if (!ev) return '';
  if (ev.dayWeek) return String(ev.dayWeek);
  const byDay = ev.eventSchedule && ev.eventSchedule.byDay ? String(ev.eventSchedule.byDay) : '';
  const map = { Monday:'Monday', Tuesday:'Tuesday', Wednesday:'Wednesday', Thursday:'Thursday', Friday:'Friday', Saturday:'Saturday', Sunday:'Sunday' };
  const mUrl = byDay.match(/schema\.org\/([A-Za-z]+)/);
  if (mUrl && map[mUrl[1]]) return map[mUrl[1]];
  const mTok = byDay.match(/([A-Z]{2})$/);
  if (!mTok) return '';
  const rev = { MO:'Monday', TU:'Tuesday', WE:'Wednesday', TH:'Thursday', FR:'Friday', SA:'Saturday', SU:'Sunday' };
  return rev[mTok[1]] || '';
}
export function getRecurringOccurrence(ev) {
  if (!ev) return '';
  if (ev.occurrence) return String(ev.occurrence);
  const byDay = ev.eventSchedule && ev.eventSchedule.byDay ? String(ev.eventSchedule.byDay) : '';
  const m = byDay.match(/^(-?\d+)[A-Z]{2}$/);
  if (!m) return '';
  const n = Number(m[1]);
  if (n === 1) return 'first';
  if (n === 2) return 'second';
  if (n === 3) return 'third';
  if (n === 4) return 'fourth';
  if (n === 5) return 'fifth';
  if (n === -1) return 'last';
  return '';
}

export function getEventStartDate(ev){ return ev && ev.startDate ? parseISODateLocal(ev.startDate) : null; }
export function getEventEndDate(ev){ if(!ev) return null; return ev.endDate ? parseISODateLocal(ev.endDate) : (ev.startDate ? parseISODateLocal(ev.startDate) : null); }
export function eventOverlaps(ev, from, to){ const s=getEventStartDate(ev), e=getEventEndDate(ev); return !!(s && e && e>=from && s<=to); }
export function inRange(dateStr, from, to){ const d = parseISODateLocal(dateStr); return !!(d && d>=from && d<=to); }

// Time helpers
export function parseTimeToMinutes(t){ if(!t || typeof t!=="string") return NaN; const m=t.match(/^(\d{1,2}):(\d{2})$/); if(!m) return NaN; const hh=Number(m[1]), mm=Number(m[2]); if(hh<0||hh>23||mm<0||mm>59) return NaN; return hh*60+mm; }
export function formatTimeRange(startTime, endTime, sep=SEP_EN){ const hasS=!!startTime, hasE=!!endTime; if(hasS&&hasE) return String(startTime)+sep+String(endTime); if(hasS) return String(startTime); if(hasE) return String(endTime); return ''; }

// Tag/category helpers
export function getUniqueCategories(events){ const set=new Set(); (events||[]).forEach(e=>{ const c=getCategory(e); if(c) set.add(c); }); return Array.from(set).sort((a,b)=>a.localeCompare(b)); }
export function getUniqueTags(events){ const set=new Set(); (events||[]).forEach(e=>{ getTagsList(e).forEach(t=>set.add(t)); }); return Array.from(set).sort((a,b)=>a.localeCompare(b)); }
export function eventKey(ev){ const parts=getLocationParts(ev); return [ev?.name||'', ev?.startDate||'', parts[0]||'', parts[3]||''].join('|').toLowerCase(); }

// Recurrence helpers
export const DAY_TO_INDEX = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
export const ORD_TO_NUM = { first:1, second:2, third:3, fourth:4, fifth:5, last:'last' };

export function nextOnOrAfterDay(startDate, targetDayIndex){ const d=new Date(startDate); const diff=(targetDayIndex - d.getDay() + 7)%7; d.setDate(d.getDate()+diff); d.setHours(0,0,0,0); return d; }
export function nthWeekdayOfMonth(year, monthIndex, weekdayIndex, occurrence){ if(occurrence==='last'){ const last=new Date(year, monthIndex+1, 0); const diff=(last.getDay()-weekdayIndex+7)%7; last.setDate(last.getDate()-diff); last.setHours(0,0,0,0); return last; } const first=new Date(year, monthIndex, 1); const diff=(weekdayIndex-first.getDay()+7)%7; const day=1+diff+(occurrence-1)*7; const d=new Date(year, monthIndex, day); if(d.getMonth()!==monthIndex) return null; d.setHours(0,0,0,0); return d; }

// Parse occurrence string into list of ordinals: [1,3] or ['last']
export function parseOccurrenceList(occurrence){
  if(!occurrence) return [];
  const norm = String(occurrence).toLowerCase().replace(/\./g,' ');
  const tokens = norm.split(/[,/&]|\band\b|\s+/g).map(t=>t.trim()).filter(Boolean);
  const map = { '1':'first','1st':'first','first':'first', '2':'second','2nd':'second','second':'second', '3':'third','3rd':'third','third':'third', '4':'fourth','4th':'fourth','fourth':'fourth', '5':'fifth','5th':'fifth','fifth':'fifth', 'last':'last' };
  const out=[];
  for(const t of tokens){ const key = map[t] || t; const v = ORD_TO_NUM[key]; if(v!==undefined && !out.includes(v)) out.push(v); }
  // Keep numeric order, with 'last' at the end
  return out.sort((a,b)=> (a==='last'? 1 : b==='last'? -1 : a-b));
}

export function displayOrdinal(v){
  if(v==='last') return 'Last';
  const n = Number(v);
  if(!Number.isFinite(n) || n<=0) return '';
  const s = (n%10===1 && n%100!==11)?'st': (n%10===2 && n%100!==12)?'nd': (n%10===3 && n%100!==13)?'rd':'th';
  return `${n}${s}`;
}

export function formatOccurrenceDisplay(occurrence){
  const list = parseOccurrenceList(occurrence);
  if(!list.length) return '';
  return list.map(displayOrdinal).join(' & ');
}

export function expandRecurringWeekly(rec, rangeStart, rangeEnd){
  const out=[]; const dayIdx = DAY_TO_INDEX[String(getRecurringDayWeek(rec)||'').toLowerCase()]; if(dayIdx==null) return out; let cursor = nextOnOrAfterDay(rangeStart, dayIdx);
  while(cursor <= rangeEnd){ out.push({ ...rec, startDate: toISODate(cursor), _isRecurring:true, _recurrenceFrequency: getRecurringFrequency(rec) }); cursor = new Date(cursor); cursor.setDate(cursor.getDate()+7); }
  return out;
}

export function expandRecurringFortnightly(rec, rangeStart, rangeEnd){
  const out=[]; const dayIdx = DAY_TO_INDEX[String(getRecurringDayWeek(rec)||'').toLowerCase()]; if(dayIdx==null) return out;
  const anchorStr = rec.startDate || rec.anchorDate; let firstOccur;
  if(anchorStr){ const anchor = parseISODateLocal(anchorStr); if(anchor){ firstOccur = nextOnOrAfterDay(anchor, dayIdx); } }
  if(!firstOccur){ firstOccur = nextOnOrAfterDay(rangeStart, dayIdx); }
  let cursor = nextOnOrAfterDay(rangeStart, dayIdx);
  if(firstOccur){ const diffDays = Math.floor((cursor - firstOccur)/(24*3600*1000)); const mod = ((diffDays % 14) + 14) % 14; if(mod!==0){ cursor = new Date(cursor); cursor.setDate(cursor.getDate() + (14 - mod)); } }
  while(cursor <= rangeEnd){ out.push({ ...rec, startDate: toISODate(cursor), _isRecurring:true, _recurrenceFrequency: getRecurringFrequency(rec) || 'Fortnightly' }); cursor = new Date(cursor); cursor.setDate(cursor.getDate()+14); }
  return out;
}

export function expandRecurringMonthlySingle(rec, rangeStart, rangeEnd){
  const out=[]; const dayIdx = DAY_TO_INDEX[String(getRecurringDayWeek(rec)||'').toLowerCase()]; const occKey=String(getRecurringOccurrence(rec)||'').toLowerCase(); const occ = ORD_TO_NUM[occKey]; if(dayIdx==null || !occ) return out; const cursor=new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1); cursor.setHours(0,0,0,0);
  while(cursor <= rangeEnd){ const y=cursor.getFullYear(), m=cursor.getMonth(); const d=nthWeekdayOfMonth(y,m,dayIdx,occ); if(d && d>=rangeStart && d<=rangeEnd){ out.push({ ...rec, startDate: toISODate(d), _isRecurring:true, _recurrenceFrequency: getRecurringFrequency(rec) }); } cursor.setMonth(cursor.getMonth()+1,1); }
  return out;
}

export function expandRecurringMonthlyMulti(rec, rangeStart, rangeEnd){
  const out=[]; const dayIdx = DAY_TO_INDEX[String(getRecurringDayWeek(rec)||'').toLowerCase()]; const occList = parseOccurrenceList(getRecurringOccurrence(rec)); if(dayIdx==null || !occList.length) return out; const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1); cursor.setHours(0,0,0,0);
  while(cursor <= rangeEnd){ const y=cursor.getFullYear(), m=cursor.getMonth(); for(const occ of occList){ const d=nthWeekdayOfMonth(y,m,dayIdx,occ); if(d && d>=rangeStart && d<=rangeEnd){ out.push({ ...rec, startDate: toISODate(d), _isRecurring:true, _recurrenceFrequency: getRecurringFrequency(rec) }); } } cursor.setMonth(cursor.getMonth()+1,1); }
  return out;
}

export function expandRecurringEvent(rec, rangeStart, rangeEnd){
  const freq = String(getRecurringFrequency(rec)||'').toLowerCase();
  if(freq==='weekly') return expandRecurringWeekly(rec, rangeStart, rangeEnd);
  if(freq==='fortnightly' || freq==='biweekly') return expandRecurringFortnightly(rec, rangeStart, rangeEnd);
  if(freq==='monthly'){
    const occList = parseOccurrenceList(getRecurringOccurrence(rec));
    return (occList.length>1) ? expandRecurringMonthlyMulti(rec, rangeStart, rangeEnd)
                              : expandRecurringMonthlySingle(rec, rangeStart, rangeEnd);
  }
  return [];
}

export function expandAllRecurring(directory, rangeStart, rangeEnd){ const res=[]; (directory||[]).forEach(rec=>{ res.push(...expandRecurringEvent(rec, rangeStart, rangeEnd)); }); return res; }

// Small DOM helpers that both pages can share (optional)
export function createSection(container, title, sectionId){
  let section = document.getElementById(sectionId);
  if(!section){ section=document.createElement('section'); section.id=sectionId; const h2=document.createElement('h2'); h2.className='event-section-title'; h2.textContent=title; section.appendChild(h2); const list=document.createElement('div'); list.className='event-section-list'; section.appendChild(list); container.appendChild(section); }
  else { const list=section.querySelector('.event-section-list'); if(list) list.innerHTML=''; }
  return section.querySelector('.event-section-list');
}

// You can keep page-specific builders (cards, filters) in each page to avoid over‑generalisation.

/* =====================
USAGE (no bundler needed)
======================
1) Save this file as /js/events-shared-utils.js (or similar).
2) In your pages, switch scripts to modules:
   <script type="module" src="/js/events-main.js"></script>
   <script type="module" src="/js/weekday.js"></script>

3) In events-main.js:
   import {
     NBSP, EN_DASH, SEP_EN,
     parseISODateLocal, startOfDay, endOfDay, startOfWeek, endOfWeek,
     startOfMonth, endOfMonth, isSameMonth, toISODate,
     formatDate, getEventStartDate, getEventEndDate, eventOverlaps, inRange,
     getUniqueCategories, getUniqueTags, eventKey,
     expandAllRecurring, createSection, formatTimeRange
   } from './events-shared-utils.js';
   // ...replace duplicate helpers with imports above.

4) In weekday.js:
   import { SEP_EN, formatTimeRange, parseTimeToMinutes, formatOccurrenceDisplay, createSection } from './events-shared-utils.js';
   // Use formatOccurrenceDisplay(ev.occurrence) inside your frequency label.

5) Encoding: keep <meta charset="utf-8"> and ensure your server serves JS with charset=utf-8.
*/
