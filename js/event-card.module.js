import {
  EN_DASH,
  getCategory,
  getEventUrl,
  getLocationParts,
  getRecurringFrequency,
  getRecurringOccurrence,
  formatOccurrenceDisplay,
} from './events-shared-utils.js';

export function buildEventCard(event, index, options = {}) {
  const i = index + 1;
  const {
    idPrefix = 'event',
    topIdPrefix = null,
    bottomIdPrefix = null,
    nameIdPrefix = null,
    dateIdPrefix = null,
    categoryIdPrefix = null,
    locationIdPrefix = null,
    dateBeforeLink = false,
    recurringLabelMode = 'none',
    dateText = () => '',
  } = options;

  const eventBox = document.createElement('div');
  eventBox.id = `${idPrefix}${i}`;
  eventBox.className = 'eventbox';

  const top = document.createElement('div');
  if (topIdPrefix) top.id = `${topIdPrefix}${i}`;
  top.className = 'eventboxtop';

  const bottom = document.createElement('div');
  if (bottomIdPrefix) bottom.id = `${bottomIdPrefix}${i}`;
  bottom.className = 'eventboxbottom';

  const link = document.createElement('a');
  const url = getEventUrl(event);
  if (url) {
    link.href = url;
    link.rel = 'noopener noreferrer';
    link.target = '_blank';
  }

  const nameDiv = document.createElement('div');
  nameDiv.className = 'name';
  if (nameIdPrefix) nameDiv.id = `${nameIdPrefix}${i}`;
  nameDiv.textContent = event.name || 'Untitled event';
  link.appendChild(nameDiv);

  const dateDiv = document.createElement('div');
  dateDiv.className = 'date';
  if (dateIdPrefix) dateDiv.id = `${dateIdPrefix}${i}`;
  dateDiv.textContent = String(dateText(event) || '');

  const locDiv = document.createElement('div');
  locDiv.className = 'location';
  if (locationIdPrefix) locDiv.id = `${locationIdPrefix}${i}`;
  locDiv.textContent = getLocationParts(event).join(', ');

  if (dateBeforeLink) {
    top.appendChild(dateDiv);
    top.appendChild(link);
  } else {
    top.appendChild(link);
    top.appendChild(dateDiv);
  }
  top.appendChild(locDiv);

  const category = getCategory(event);
  const catDiv = document.createElement('div');
  catDiv.className = 'category ' + category;
  if (categoryIdPrefix) catDiv.id = `${categoryIdPrefix}${i}`;
  catDiv.textContent = category;
  bottom.appendChild(catDiv);

  if (recurringLabelMode === 'main' && event._isRecurring && event._recurrenceFrequency) {
    const label = document.createElement('div');
    label.className = 'category recurring';
    label.textContent = String(event._recurrenceFrequency);
    bottom.appendChild(label);
  }

  if (recurringLabelMode === 'weekday') {
    const freq = getRecurringFrequency(event);
    if (freq) {
      const label = document.createElement('div');
      label.className = 'category recurring';
      const occ = formatOccurrenceDisplay(getRecurringOccurrence(event));
      label.textContent = occ ? `${freq} ${EN_DASH} ${occ}` : String(freq);
      bottom.appendChild(label);
    }
  }

  eventBox.appendChild(top);
  eventBox.appendChild(bottom);
  return eventBox;
}
