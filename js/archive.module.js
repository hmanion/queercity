// archive.module.no-recurring.js (ESM)
// Archive page WITHOUT recurring events
// - Reads one-off events from output.json only
// - Groups past events by "Month Year" with counts
// - Uses en-dash with non-breaking spaces for date/time ranges
//
// HTML wiring (archive.html):
// <meta charset="utf-8" />
// <div id="archivelist"></div>
// <script type="module" src="/js/archive.module.no-recurring.js"></script>

import {
  SEP_EN,
  // dates & formatting
  parseISODateLocal, startOfDay, toISODate,
  formatEventDateTime,
  // event helper
  getEventEndDate,
  // small DOM helper
  createSection,
  getCategory,
  getUniqueCategories, getUniqueTags, getTagsList
} from './events-shared-utils.js';
import { buildEventCard } from './event-card.module.js';
import { fetchJsonWithFallback } from './fetch-json.module.js';
import { createTagDropdown } from './tag-filter.module.js';

function monthKeyTitleFromISO(iso) {
  const d = parseISODateLocal(iso);
  if (!d) return null;
  const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const title = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  return { key, title, date: d };
}

function ensureMonthSection(container, title, id) {
  return createSection(container, title, id);
}

function ensureFilterBar(beforeEl) {
  let bar = document.getElementById('category-filter-bar');
  if (!bar) {
    bar = document.createElement('section');
    bar.id = 'category-filter-bar';
    bar.className = 'category-filter-bar';
    beforeEl.parentNode.insertBefore(bar, beforeEl);
  } else {
    bar.innerHTML = '';
  }
  return bar;
}

function buildFilters(barEl, categories, initialTags, onChangeCats, onChangeTags) {
  let selectedCats = null;
  const row = document.createElement('div');
  row.className = 'filter-row';
  barEl.appendChild(row);

  const allBtn = document.createElement('button');
  allBtn.textContent = 'All';
  allBtn.className = 'cat-pill active';
  allBtn.setAttribute('aria-pressed', 'true');
  row.appendChild(allBtn);

  const catBtns = categories.map((cat) => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    btn.className = 'cat-pill ' + cat;
    btn.dataset.cat = cat;
    btn.setAttribute('aria-pressed', 'false');
    row.appendChild(btn);
    return btn;
  });

  function updateCatsUI() {
    const allActive = selectedCats === null || (selectedCats && selectedCats.size === 0);
    allBtn.classList.toggle('active', allActive);
    allBtn.setAttribute('aria-pressed', String(allActive));
    catBtns.forEach((btn) => {
      const on = selectedCats && selectedCats.has(btn.dataset.cat);
      btn.classList.toggle('active', !!on);
      btn.setAttribute('aria-pressed', String(!!on));
    });
  }

  allBtn.addEventListener('click', () => { selectedCats = null; updateCatsUI(); onChangeCats(null); });
  catBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (selectedCats === null) selectedCats = new Set();
      const cat = btn.dataset.cat;
      if (selectedCats.has(cat)) selectedCats.delete(cat); else selectedCats.add(cat);
      if (selectedCats.size === 0) {
        selectedCats = null;
        onChangeCats(null);
      } else {
        onChangeCats(new Set(selectedCats));
      }
      updateCatsUI();
    });
  });

  const tagCtrl = createTagDropdown(barEl, initialTags, onChangeTags);
  updateCatsUI();
  return { setTagOptions: (tags) => tagCtrl.setOptions(tags) };
}

const now = new Date();
const from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
const to = new Date(now);
to.setDate(to.getDate() - 1);
const fromParam = toISODate(from);
const toParam = toISODate(to);

fetchJsonWithFallback(
  `../api/output.php?from=${encodeURIComponent(fromParam)}&to=${encodeURIComponent(toParam)}`,
  '../output.json',
)
  .then(oneOff => {
    const container = document.getElementById('archivelist');
    if (!container) return;

    const todayStart = startOfDay(new Date());

    // Only include one-off events that ended before today
    const pastSingles = (oneOff || [])
      .filter(e => e && e.startDate)
      .filter(ev => {
        const end = getEventEndDate(ev);
        return !!end && end < todayStart;
      });

    // Group by month-year of startDate
    const groups = new Map();
    for (const ev of pastSingles) {
      const mt = monthKeyTitleFromISO(ev.startDate);
      if (!mt) continue;
      if (!groups.has(mt.key)) groups.set(mt.key, { title: mt.title, items: [] });
      groups.get(mt.key).items.push(ev);
    }

    const filterBar = ensureFilterBar(container);
    const categories = getUniqueCategories(pastSingles);
    const tags = getUniqueTags(pastSingles);

    let selectedCats = null;
    let selectedTags = null;
    let tagMode = 'any';

    const filterCtrl = buildFilters(
      filterBar,
      categories,
      tags,
      (cats) => { selectedCats = cats; render(); },
      (tagsSet, mode) => { selectedTags = tagsSet; tagMode = mode || tagMode; render(); },
    );

    function applyFilters(items) {
      const byCategory = (ev) => {
        if (!selectedCats) return true;
        return selectedCats.has(getCategory(ev));
      };
      const preTag = items.filter(byCategory);

      const availableTags = getUniqueTags(preTag);
      filterCtrl.setTagOptions(availableTags);

      const byTags = (ev) => {
        if (!selectedTags || selectedTags.size === 0) return true;
        const eventTags = getTagsList(ev);
        if (tagMode === 'all') {
          for (const t of selectedTags) if (!eventTags.includes(t)) return false;
          return true;
        }
        return eventTags.some((t) => selectedTags.has(t));
      };
      return preTag.filter(byTags);
    }

    let counter = 0;
    function render() {
      container.innerHTML = '';
      const monthEntries = Array.from(groups.entries())
        .sort((a, b) => b[0].localeCompare(a[0]));

      counter = 0;
      for (const [key, { title, items }] of monthEntries) {
        const filteredItems = applyFilters(items);
        if (!filteredItems.length) continue;
        filteredItems.sort((a, b) => parseISODateLocal(b.startDate) - parseISODateLocal(a.startDate) || String(a.name||'').localeCompare(String(b.name||'')));
        const listEl = ensureMonthSection(container, title, `archive-${key}`);
        const section = listEl.parentElement;
        if (section) {
          const h2 = section.querySelector('h2.event-section-title');
          if (h2) h2.textContent = `${title} (${filteredItems.length})`;
        }
        const frag = document.createDocumentFragment();
        filteredItems.forEach(ev => {
          frag.appendChild(buildEventCard(ev, counter++, {
            idPrefix: 'archiveEvent',
            dateText: (item) => formatEventDateTime(item, SEP_EN),
          }));
        });
        listEl.appendChild(frag);
      }
    }

    render();
  })
  .catch(err => console.error('Error building archive page:', err));
