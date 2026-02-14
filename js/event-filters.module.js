import { getTagsList } from './events-shared-utils.js';

export function matchesRecurring(ev, showRecurring) {
  return showRecurring ? true : !ev._isRecurring;
}

export function matchesTags(ev, selectedTags, mode = 'any') {
  if (!selectedTags || selectedTags.size === 0) return true;
  const eventTags = getTagsList(ev);
  if (mode === 'all') {
    for (const tag of selectedTags) {
      if (!eventTags.includes(tag)) return false;
    }
    return true;
  }
  return eventTags.some((tag) => selectedTags.has(tag));
}

export function setSectionTitleCount(listEl, count) {
  const section = listEl.parentElement;
  if (!section) return;
  const h2 = section.querySelector('h2.event-section-title');
  const base = section.dataset.baseTitle || (h2 ? h2.textContent.replace(/\s*\(.*\)$/, '') : '');
  if (h2) h2.textContent = count > 0 ? `${base} (${count})` : base;
}
