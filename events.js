// Manchester Events – recurring.plus (EM DASH fix)
// Uses real EM DASH (—, \u2014) with non‑breaking spaces around it for times and date ranges.
// Also switches date text to textContent to avoid any HTML entity quirks.

// === Date Helpers (local, day-precise) ===
function parseISODateLocal(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  const dt = new Date(y, mo, d, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}
function isSameMonth(d1, d2) { return d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear(); }
function startOfWeek(date) { const d = new Date(date); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); d.setHours(0,0,0,0); return d; }
function endOfWeek(date) { const s = startOfWeek(date); const e = new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); return e; }
function endOfMonth(date) { const d = new Date(date.getFullYear(), date.getMonth()+1, 0); d.setHours(23,59,59,999); return d; }
function startOfDay(date) { const d = new Date(date); d.setHours(0,0,0,0); return d; }
function endOfDay(date) { const d = new Date(date); d.setHours(23,59,59,999); return d; }
function inRange(dateStr, from, to) { const d = parseISODateLocal(dateStr); if (!d) return false; return d >= from && d <= to; }
function toISODate(d) { const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function formatDate(dateStr) { const d = parseISODateLocal(dateStr); if (!d) return ''; return new Intl.DateTimeFormat('en-GB', { weekday:'short', day:'numeric', month:'short' }).format(d); }

// Use EM DASH with non‑breaking spaces
const NBSP = "\u00A0";
const EM_DASH = "\u2014";
const SEP = NBSP + EM_DASH + NBSP; // " — "

function formatDateTime(event) {
  const start = formatDate(event.startDate);
  if (!start) return '';
  if (event.endDate && !event.endTime) {
    const end = formatDate(event.endDate);
    return `${start}${SEP}${end}`; // e.g., "Mon 1 Sep — Thu 4 Sep"
  }
  if (event.startTime && event.endTime) {
    return `${start} ${event.startTime}${SEP}${event.endTime}`; // e.g., "Mon 1 Sep 19:00 — 21:00"
  }
  if (event.startTime && !event.endTime) {
    return `${start} ${event.startTime}`;
  }
  return start;
}

function getEventStartDate(ev) { return ev && ev.startDate ? parseISODateLocal(ev.startDate) : null; }
function getEventEndDate(ev) { if (!ev) return null; const end = ev.endDate ? parseISODateLocal(ev.endDate) : (ev.startDate ? parseISODateLocal(ev.startDate) : null); return end; }
function eventOverlaps(ev, from, to) { const s = getEventStartDate(ev); const e = getEventEndDate(ev); if (!s || !e) return false; return e >= from && s <= to; }
function eventKey(ev) { return [ev.name||'', ev.startDate||'', ev.locName||'', ev.locPost||''].join('|').toLowerCase(); }

// === UI Builders ===
function buildEventBox(event, index) {
  const i = index + 1;
  const eventBox = document.createElement('div'); eventBox.id = `event${i}`; eventBox.className = 'eventbox';
  const eventBoxTop = document.createElement('div'); eventBoxTop.id = `eventTop${i}`; eventBoxTop.className = 'eventboxtop';
  const eventBoxBottom = document.createElement('div'); eventBoxBottom.id = `eventBottom${i}`; eventBoxBottom.className = 'eventboxbottom';

  const link = document.createElement('a'); if (event.url) { link.href = event.url; link.rel = 'noopener noreferrer'; link.target = '_blank'; }
  const nameDiv = document.createElement('div'); nameDiv.className = 'name'; nameDiv.id = `name${i}`; nameDiv.textContent = event.name || 'Untitled event'; link.appendChild(nameDiv);

  const dateDiv = document.createElement('div'); dateDiv.className = 'date'; dateDiv.id = `date${i}`; // IMPORTANT: textContent (not innerHTML)
  dateDiv.textContent = formatDateTime(event);

  const catDiv = document.createElement('div'); catDiv.className = 'category ' + (event.category || ''); catDiv.id = `category${i}`; catDiv.textContent = event.category || '';
  const locDiv = document.createElement('div'); locDiv.className = 'location'; locDiv.id = `location${i}`; const parts = [event.locName, event.locStreet, event.locTown, event.locPost].filter(Boolean); locDiv.textContent = parts.join(', ');

  eventBoxTop.appendChild(link); eventBoxTop.appendChild(dateDiv); eventBoxTop.appendChild(locDiv); eventBox.appendChild(eventBoxTop); eventBoxBottom.appendChild(catDiv);
  if (event._isRecurring && event._recurrenceFrequency) { const label = document.createElement('div'); label.className = 'category recurring'; label.textContent = String(event._recurrenceFrequency); eventBoxBottom.appendChild(label); }
  eventBox.appendChild(eventBoxBottom); return eventBox;
}

function createSection(container, title, sectionId) { let section = document.getElementById(sectionId); if (!section) { section = document.createElement('section'); section.id = sectionId; const h2 = document.createElement('h2'); h2.className = 'event-section-title'; h2.textContent = title; section.appendChild(h2); const list = document.createElement('div'); list.className = 'event-section-list'; section.appendChild(list); container.appendChild(section); } else { const list = section.querySelector('.event-section-list'); if (list) list.innerHTML = ''; } return section.querySelector('.event-section-list'); }
function ensureFilterBar(beforeEl) { let bar = document.getElementById('category-filter-bar'); if (!bar) { bar = document.createElement('section'); bar.id='category-filter-bar'; bar.className='category-filter-bar'; beforeEl.parentNode.insertBefore(bar, beforeEl); } else { bar.innerHTML=''; } return bar; }
function getUniqueCategories(events) { const set = new Set(); events.forEach(e=>{ if (e && e.category) set.add(String(e.category).trim()); }); return Array.from(set).sort((a,b)=>a.localeCompare(b)); }
function getUniqueTags(events) { const set = new Set(); (events||[]).forEach(e=>{ if (e && Array.isArray(e.tags)) e.tags.forEach(t=>{ if (t!=null) set.add(String(t).trim().toLowerCase()); }); }); return Array.from(set).sort((a,b)=>a.localeCompare(b)); }

function buildTagDropdown(barEl, initialTags, onChangeTagsWithMode) {
  let selected = new Set(); let mode='any';
  const wrap=document.createElement('div'); wrap.className='tag-filter dropdown';
  const toggleBtn=document.createElement('button'); toggleBtn.type='button'; toggleBtn.className='tags-toggle'; toggleBtn.setAttribute('aria-expanded','false'); toggleBtn.textContent='Tags';
  const panel=document.createElement('div'); panel.className='tags-panel'; panel.style.display='none';
  const modeWrap=document.createElement('div'); modeWrap.className='tags-mode'; const modeLabel=document.createElement('span'); modeLabel.textContent='Match:';
  const anyBtn=document.createElement('button'); anyBtn.type='button'; anyBtn.className='tag-mode any active'; anyBtn.textContent='Any'; anyBtn.setAttribute('aria-pressed','true');
  const allBtn=document.createElement('button'); allBtn.type='button'; allBtn.className='tag-mode all'; allBtn.textContent='All'; allBtn.setAttribute('aria-pressed','false');
  modeWrap.appendChild(modeLabel); modeWrap.appendChild(anyBtn); modeWrap.appendChild(allBtn);
  const list=document.createElement('div'); list.className='tags-list';
  const actions=document.createElement('div'); actions.className='tags-actions'; const clearBtn=document.createElement('button'); clearBtn.type='button'; clearBtn.className='tags-clear'; clearBtn.textContent='Clear'; actions.appendChild(clearBtn);
  panel.appendChild(modeWrap); panel.appendChild(list); panel.appendChild(actions);
  wrap.appendChild(toggleBtn); wrap.appendChild(panel); barEl.appendChild(wrap);
  function emit(){ onChangeTagsWithMode(selected.size?new Set(selected):null, mode); }
  function updateModeUI(){ const isAny=mode==='any'; anyBtn.classList.toggle('active', isAny); allBtn.classList.toggle('active', !isAny); anyBtn.setAttribute('aria-pressed', String(isAny)); allBtn.setAttribute('aria-pressed', String(!isAny)); }
  function renderOptions(tags){ list.innerHTML=''; tags.forEach(tag=>{ const id=`tag-${tag.replace(/[^a-z0-9]+/g,'-')}`; const label=document.createElement('label'); label.className='tag-option'; label.setAttribute('for', id); const cb=document.createElement('input'); cb.type='checkbox'; cb.id=id; cb.value=tag; cb.checked=selected.has(tag); cb.addEventListener('change',()=>{ if(cb.checked) selected.add(tag); else selected.delete(tag); emit(); }); const txt=document.createElement('span'); txt.textContent=tag; label.appendChild(cb); label.appendChild(txt); list.appendChild(label); }); }
  toggleBtn.addEventListener('click',()=>{ const open=panel.style.display==='none'; panel.style.display=open?'block':'none'; toggleBtn.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click',(e)=>{ if(!wrap.contains(e.target)){ panel.style.display='none'; toggleBtn.setAttribute('aria-expanded','false'); } });
  clearBtn.addEventListener('click',()=>{ selected.clear(); renderOptions(currentOptions); emit(); });
  anyBtn.addEventListener('click',()=>{ mode='any'; updateModeUI(); emit(); });
  allBtn.addEventListener('click',()=>{ mode='all'; updateModeUI(); emit(); });
  let currentOptions = initialTags || [];
  function setOptions(newTags){ currentOptions = Array.from(newTags); const before = new Set(selected); selected = new Set(Array.from(selected).filter(t=>currentOptions.includes(t))); const changed = before.size !== selected.size || Array.from(before).some(t=>!selected.has(t)); renderOptions(currentOptions); if(changed) emit(); }
  updateModeUI(); renderOptions(currentOptions); return { setOptions, getSelected: ()=>new Set(selected), getMode: ()=>mode };
}
function buildFilters(barEl, categories, initialTags, onChangeCats, onToggleRecurring, onChangeTags){
  let selectedCats=null; const row=document.createElement('div'); row.className='filter-row'; barEl.appendChild(row);
  const allBtn=document.createElement('button'); allBtn.textContent='All'; allBtn.className='cat-pill active'; allBtn.setAttribute('aria-pressed','true'); row.appendChild(allBtn);
  const catBtns=categories.map(cat=>{ const btn=document.createElement('button'); btn.textContent=cat; btn.className='cat-pill '+cat; btn.dataset.cat=cat; btn.setAttribute('aria-pressed','false'); row.appendChild(btn); return btn; });
  function updateCatsUI(){ const allActive = selectedCats===null || (selectedCats && selectedCats.size===0); allBtn.classList.toggle('active', allActive); allBtn.setAttribute('aria-pressed', String(allActive)); catBtns.forEach(btn=>{ const isOn=selectedCats && selectedCats.has(btn.dataset.cat); btn.classList.toggle('active', !!isOn); btn.setAttribute('aria-pressed', String(!!isOn)); }); }
  allBtn.addEventListener('click',()=>{ selectedCats=null; updateCatsUI(); onChangeCats(null); });
  catBtns.forEach(btn=>{ btn.addEventListener('click',()=>{ if(selectedCats===null) selectedCats=new Set(); const cat=btn.dataset.cat; if(selectedCats.has(cat)) selectedCats.delete(cat); else selectedCats.add(cat); if(selectedCats.size===0){ selectedCats=null; onChangeCats(null); } else { onChangeCats(new Set(selectedCats)); } updateCatsUI(); }); });
  const right=document.createElement('div'); right.className='filter-right'; const recBtn=document.createElement('button'); recBtn.className='toggle recurring off'; recBtn.setAttribute('aria-pressed','true'); recBtn.textContent='Recurring: Hidden'; right.appendChild(recBtn); barEl.appendChild(right);
  recBtn.addEventListener('click',()=>{ const on=recBtn.classList.toggle('on'); recBtn.classList.toggle('off', !on); recBtn.setAttribute('aria-pressed', String(on)); recBtn.textContent = on ? 'Recurring: Shown' : 'Recurring: Hidden'; onToggleRecurring(on); });
  const tagCtrl = buildTagDropdown(barEl, initialTags, onChangeTags); updateCatsUI(); return { setTagOptions:(tags)=>tagCtrl.setOptions(tags) };
}

// === Recurring Expansion (unchanged from recurring.plus) ===
const DAY_TO_INDEX = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
const ORD_TO_NUM = { first:1, second:2, third:3, fourth:4, fifth:5, last:'last' };
function nextOnOrAfterDay(startDate, targetDayIndex){ const d = new Date(startDate); const diff = (targetDayIndex - d.getDay() + 7) % 7; d.setDate(d.getDate()+diff); d.setHours(0,0,0,0); return d; }
function nthWeekdayOfMonth(year, monthIndex, weekdayIndex, occurrence){ if(occurrence==='last'){ const last=new Date(year, monthIndex+1, 0); const diff=(last.getDay()-weekdayIndex+7)%7; last.setDate(last.getDate()-diff); last.setHours(0,0,0,0); return last; } else { const first=new Date(year, monthIndex, 1); const diff=(weekdayIndex - first.getDay() + 7)%7; const day=1 + diff + (occurrence-1)*7; const d=new Date(year, monthIndex, day); if(d.getMonth()!==monthIndex) return null; d.setHours(0,0,0,0); return d; } }
function parseOccurrenceList(occurrenceStr){ if(!occurrenceStr) return []; const norm = String(occurrenceStr).toLowerCase().replace(/\./g,' '); const tokens = norm.split(/[,/&]|\band\b|\s+/g).map(t=>t.trim()).filter(Boolean); const mapNum = { '1':'first','1st':'first','first':'first','2':'second','2nd':'second','second':'second','3':'third','3rd':'third','third':'third','4':'fourth','4th':'fourth','fourth':'fourth','5':'fifth','5th':'fifth','fifth':'fifth','last':'last' }; const out = []; for(const t of tokens){ const key = mapNum[t] || t; if(ORD_TO_NUM[key] !== undefined) out.push(ORD_TO_NUM[key]); } return out.filter((v,i,a)=>a.indexOf(v)===i); }
function expandRecurringWeekly(rec, rangeStart, rangeEnd){ const out=[]; const dayIdx = DAY_TO_INDEX[String(rec.dayWeek||'').toLowerCase()]; if(dayIdx==null) return out; let cursor = nextOnOrAfterDay(rangeStart, dayIdx); while(cursor <= rangeEnd){ out.push({ ...rec, startDate: toISODate(cursor), _isRecurring:true, _recurrenceFrequency: rec.frequency }); cursor = new Date(cursor); cursor.setDate(cursor.getDate()+7); } return out; }
function expandRecurringFortnightly(rec, rangeStart, rangeEnd){ const out=[]; const dayIdx = DAY_TO_INDEX[String(rec.dayWeek||'').toLowerCase()]; if(dayIdx==null) return out; const anchorStr = rec.startDate || rec.anchorDate; let firstOccur; if(anchorStr){ const anchor = parseISODateLocal(anchorStr); if(anchor){ firstOccur = nextOnOrAfterDay(anchor, dayIdx); } } if(!firstOccur){ firstOccur = nextOnOrAfterDay(rangeStart, dayIdx); } let cursor = nextOnOrAfterDay(rangeStart, dayIdx); if(firstOccur){ const diffDays = Math.floor((cursor - firstOccur)/(24*3600*1000)); const mod = ((diffDays % 14) + 14) % 14; if(mod !== 0){ cursor = new Date(cursor); cursor.setDate(cursor.getDate() + (14 - mod)); } } while(cursor <= rangeEnd){ out.push({ ...rec, startDate: toISODate(cursor), _isRecurring:true, _recurrenceFrequency: rec.frequency || 'Fortnightly' }); cursor = new Date(cursor); cursor.setDate(cursor.getDate()+14); } return out; }
function expandRecurringMonthlySingle(rec, rangeStart, rangeEnd){ const out=[]; const dayIdx = DAY_TO_INDEX[String(rec.dayWeek||'').toLowerCase()]; const occKey = String(rec.occurrence||'').toLowerCase(); const occ = ORD_TO_NUM[occKey]; if(dayIdx==null || !occ) return out; const cursor=new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1); cursor.setHours(0,0,0,0); while(cursor <= rangeEnd){ const y=cursor.getFullYear(); const m=cursor.getMonth(); const d=nthWeekdayOfMonth(y,m,dayIdx,occ); if(d && d>=rangeStart && d<=rangeEnd){ out.push({ ...rec, startDate: toISODate(d), _isRecurring:true, _recurrenceFrequency: rec.frequency }); } cursor.setMonth(cursor.getMonth()+1,1); } return out; }
function expandRecurringMonthlyMulti(rec, rangeStart, rangeEnd){ const out=[]; const dayIdx = DAY_TO_INDEX[String(rec.dayWeek||'').toLowerCase()]; const occList = parseOccurrenceList(rec.occurrence); if(dayIdx==null || !occList.length) return out; const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1); cursor.setHours(0,0,0,0); while(cursor <= rangeEnd){ const y=cursor.getFullYear(); const m=cursor.getMonth(); for(const occ of occList){ const d = nthWeekdayOfMonth(y,m,dayIdx,occ); if(d && d>=rangeStart && d<=rangeEnd){ out.push({ ...rec, startDate: toISODate(d), _isRecurring:true, _recurrenceFrequency: rec.frequency }); } } cursor.setMonth(cursor.getMonth()+1,1); } return out; }
function expandRecurringEvent(rec, rangeStart, rangeEnd){ const freq = String(rec.frequency||'').toLowerCase(); if(freq === 'weekly') return expandRecurringWeekly(rec, rangeStart, rangeEnd); if(freq === 'fortnightly' || freq === 'biweekly') return expandRecurringFortnightly(rec, rangeStart, rangeEnd); if(freq === 'monthly'){ const occList = parseOccurrenceList(rec.occurrence); if(occList.length > 1) return expandRecurringMonthlyMulti(rec, rangeStart, rangeEnd); return expandRecurringMonthlySingle(rec, rangeStart, rangeEnd); } return []; }
function expandAllRecurring(directory, rangeStart, rangeEnd){ const res=[]; (directory||[]).forEach(rec=>{ res.push(...expandRecurringEvent(rec, rangeStart, rangeEnd)); }); return res; }

// === Main ===
Promise.all([
  fetch('output.json').then(r=>r.ok?r.json():[]).catch(()=>[]),
  fetch('directory.json').then(r=>r.ok?r.json():[]).catch(()=>[])
]).then(([oneOffData, directoryData])=>{
  const now = new Date();
  const todayStart = startOfDay(now); const todayEnd = endOfDay(now);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1); const tomorrowStart = startOfDay(tomorrow); const tomorrowEnd = endOfDay(tomorrow);
  const thisMonthName = now.toLocaleString('en-GB', { month:'long' });
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth()+1, 1); const nextMonthName = nextMonthDate.toLocaleString('en-GB', { month:'long' });
  const startWeek = startOfWeek(now); const endWeek = endOfWeek(now); const endOfNextMonth = endOfMonth(nextMonthDate);

  const singlesRaw = (oneOffData||[]).filter(e=>e && e.startDate).map(e=>({ ...e }));
  const recurringRaw = expandAllRecurring(directoryData||[], startWeek, endOfNextMonth);
  function notEndedBeforeToday(ev){ const e = getEventEndDate(ev); return !e || e >= todayStart; }
  const singles = singlesRaw.filter(notEndedBeforeToday); const recurring = recurringRaw.filter(notEndedBeforeToday);

  const allEvents = [...singles, ...recurring].sort((a,b)=>{ const da = getEventStartDate(a) || new Date(8640000000000000); const db = getEventStartDate(b) || new Date(8640000000000000); return da - db; });

  const eventList=document.getElementById('eventlist'); if(!eventList) return;
  const filterBar = ensureFilterBar(eventList); const categories = getUniqueCategories(allEvents); const tags = getUniqueTags(allEvents);

  const base = {
    today: allEvents.filter(e=>eventOverlaps(e, todayStart, todayEnd)),
    tomorrow: allEvents.filter(e=>eventOverlaps(e, tomorrowStart, tomorrowEnd)),
    thisWeek: allEvents.filter(e=>inRange(e.startDate, startWeek, endWeek)),
    restOfMonth: allEvents.filter(e=>{ const d = getEventStartDate(e); return d && isSameMonth(d, now) && d > endWeek; }),
    nextMonth: allEvents.filter(e=>{ const d = getEventStartDate(e); return d && isSameMonth(d, nextMonthDate); })
  };

  function ensureSections(){ eventList.innerHTML=''; const todayEl=createSection(eventList,'Today','section-today'); const tomorrowEl=createSection(eventList,'Tomorrow','section-tomorrow'); const weekListEl=createSection(eventList,'Happening this week','section-this-week'); const restListEl=createSection(eventList,`The rest of ${thisMonthName}`,'section-rest-of-month'); const nextListEl=createSection(eventList,`Next Month - ${nextMonthName}`,'section-next-month'); return { todayEl, tomorrowEl, weekListEl, restListEl, nextListEl }; }

  let counter=0;
  function appendEvents(listEl, arr, shownKeys){ const filtered=(arr||[]).filter(ev=>{ const k=eventKey(ev); if(shownKeys && shownKeys.has(k)) return false; if(shownKeys) shownKeys.add(k); return true; }); if(filtered.length===0){ const section=listEl.parentElement; if(section) section.style.display='none'; return; } const frag=document.createDocumentFragment(); filtered.forEach(ev=>{ const box=buildEventBox(ev, counter++); frag.appendChild(box); }); listEl.appendChild(frag); const section=listEl.parentElement; if(section) section.style.display=''; }

  let selectedCats=null, selectedTags=null, tagMode='any', showRecurring=false;
  const filterCtrl = buildFilters(
    filterBar,
    categories,
    tags,
    (cats)=>{ selectedCats=cats; render(selectedCats, showRecurring, selectedTags, tagMode); },
    (on)=>{ showRecurring=on; render(selectedCats, showRecurring, selectedTags, tagMode); },
    (tagsSet, mode)=>{ selectedTags=tagsSet; tagMode=mode||tagMode; render(selectedCats, showRecurring, selectedTags, tagMode); }
  );

  function render(selectedCats, showRecurring, selectedTags, tagMode){
    const { todayEl, tomorrowEl, weekListEl, restListEl, nextListEl } = ensureSections(); counter=0; const shown = new Set();
    const byCat = (ev)=>{ if(!selectedCats) return true; const cat=(ev.category||'').trim(); return selectedCats.has(cat); };
    const byRecurring = (ev)=>(showRecurring ? true : !ev._isRecurring);
    const preTagToday = base.today.filter(byCat).filter(byRecurring);
    const preTagTomorrow = base.tomorrow.filter(byCat).filter(byRecurring);
    const preTagWeek = base.thisWeek.filter(byCat).filter(byRecurring);
    const preTagRest = base.restOfMonth.filter(byCat).filter(byRecurring);
    const preTagNext = base.nextMonth.filter(byCat).filter(byRecurring);
    const visibleBeforeTags = [...preTagToday, ...preTagTomorrow, ...preTagWeek, ...preTagRest, ...preTagNext];
    const availableTags = getUniqueTags(visibleBeforeTags); filterCtrl.setTagOptions(availableTags);
    const byTags = (ev)=>{ if(!selectedTags || selectedTags.size===0) return true; const evtTags = Array.isArray(ev.tags) ? ev.tags.map(t=>String(t).trim().toLowerCase()) : []; if(tagMode==='all'){ for(const t of selectedTags){ if(!evtTags.includes(t)) return false; } return true; } return evtTags.some(t=>selectedTags.has(t)); };
    const applyAll = (arr)=>arr.filter(byTags);
    appendEvents(todayEl, applyAll(preTagToday), shown);
    appendEvents(tomorrowEl, applyAll(preTagTomorrow), shown);
    appendEvents(weekListEl, applyAll(preTagWeek), shown);
    appendEvents(restListEl, applyAll(preTagRest), shown);
    appendEvents(nextListEl, applyAll(preTagNext), shown);
  }

  render(selectedCats, showRecurring, selectedTags, tagMode);
}).catch(err=>console.error('Error loading JSON:', err));