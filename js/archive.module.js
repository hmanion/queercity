import {
  SEP_EN,
  parseISODateLocal,
  startOfDay,
  toISODate,
  formatEventDateTime,
  FILTER_CATEGORIES,
  getEventEndDate,
  createSection,
  getCategory,
  getUniqueTags,
  getEventStartDate,
} from './events-shared-utils.js';
import { buildEventCard } from './event-card.module.js';
import { fetchJsonWithFallback } from './fetch-json.module.js';
import { ensureFilterBar, buildFilterBar } from './filter-bar.module.js';
import { matchesRecurring, matchesTags, setSectionTitleCount } from './event-filters.module.js';

function monthKeyTitleFromISO(iso) {
  const d = parseISODateLocal(iso);
  if (!d) return null;
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const title = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  return { key, title };
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
  .then((oneOff) => {
    const container = document.getElementById('archivelist');
    if (!container) return;

    const todayStart = startOfDay(new Date());
    const pastSingles = (oneOff || [])
      .filter((e) => e && e.startDate)
      .filter((ev) => {
        const end = getEventEndDate(ev);
        return !!end && end < todayStart;
      });

    const groups = new Map();
    pastSingles.forEach((ev) => {
      const mt = monthKeyTitleFromISO(ev.startDate);
      if (!mt) return;
      if (!groups.has(mt.key)) groups.set(mt.key, { title: mt.title, items: [] });
      groups.get(mt.key).items.push(ev);
    });

    const filterBar = ensureFilterBar(container);
    let selectedCats = null;
    let selectedTags = null;
    let tagMode = 'any';
    let showRecurring = false;

    const filterCtrl = buildFilterBar({
      barEl: filterBar,
      categories: FILTER_CATEGORIES,
      showCategories: true,
      initialTags: getUniqueTags(pastSingles),
      showRecurringToggle: true,
      recurringDefaultOn: showRecurring,
      onChangeCategories: (cats) => {
        selectedCats = cats;
        render();
      },
      onChangeRecurring: (on) => {
        showRecurring = on;
        render();
      },
      onChangeTags: (tagsSet, mode) => {
        selectedTags = tagsSet;
        tagMode = mode || tagMode;
        render();
      },
    });

    let counter = 0;

    const render = () => {
      container.innerHTML = '';
      const monthEntries = Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
      const byCategory = (ev) => (!selectedCats ? true : selectedCats.has(getCategory(ev)));

      const allPreTag = monthEntries.flatMap(([, { items }]) =>
        (items || [])
          .filter(byCategory)
          .filter((ev) => matchesRecurring(ev, showRecurring))
      );
      filterCtrl.setTagOptions(getUniqueTags(allPreTag));

      counter = 0;
      monthEntries.forEach(([key, { title, items }]) => {
        const preTag = (items || [])
          .filter(byCategory)
          .filter((ev) => matchesRecurring(ev, showRecurring));

        const filteredItems = preTag
          .filter((ev) => matchesTags(ev, selectedTags, tagMode))
          .sort((a, b) => {
            const ad = getEventStartDate(a) || new Date(0);
            const bd = getEventStartDate(b) || new Date(0);
            return bd - ad || String(a.name || '').localeCompare(String(b.name || ''));
          });

        if (!filteredItems.length) return;

        const listEl = createSection(container, title, `archive-${key}`);
        const section = listEl.parentElement;
        if (section) {
          section.dataset.baseTitle = title;
          section.style.display = '';
        }
        setSectionTitleCount(listEl, filteredItems.length);

        const frag = document.createDocumentFragment();
        filteredItems.forEach((ev) => {
          frag.appendChild(buildEventCard(ev, counter++, {
            idPrefix: 'archiveEvent',
            dateText: (item) => formatEventDateTime(item, SEP_EN),
          }));
        });
        listEl.appendChild(frag);
      });
    };

    render();
  })
  .catch((err) => console.error('Error building archive page:', err));
