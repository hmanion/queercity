import {
  EN_DASH,
  getCategory,
  getEventPrice,
  getEventUrl,
  getLocationParts,
  getRecurringFrequency,
  getRecurringOccurrence,
  formatOccurrenceDisplay,
  isMultiDayEvent,
  getAudienceLabel,
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
  const meta = document.createElement('div');
  meta.className = 'eventboxmeta';
  const actions = document.createElement('div');
  actions.className = 'eventboxactions';
  const leftBadges = document.createElement('div');
  leftBadges.className = 'eventbadges-left';
  const rightBadges = document.createElement('div');
  rightBadges.className = 'eventbadges-right';

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

  const category = getCategory(event);
  const catDiv = document.createElement('div');
  catDiv.className = 'category ' + category;
  if (categoryIdPrefix) catDiv.id = `${categoryIdPrefix}${i}`;
  catDiv.textContent = category;
  top.appendChild(catDiv);
  top.appendChild(link);

  if (dateBeforeLink) {
    meta.appendChild(dateDiv);
    meta.appendChild(locDiv);
  } else {
    meta.appendChild(dateDiv);
    meta.appendChild(locDiv);
  }

  const priceRaw = getEventPrice(event);
  const priceChip = document.createElement('div');
  priceChip.className = 'eventboxcta eventboxcta-primary';
  if (priceRaw === '' || priceRaw == null) {
    priceChip.textContent = 'INFO';
  } else if (Number(priceRaw) === 0) {
    priceChip.textContent = 'FREE';
  } else {
    const numericPrice = Number(priceRaw);
    priceChip.textContent = Number.isFinite(numericPrice) ? `£${numericPrice}` : String(priceRaw);
  }
  leftBadges.appendChild(priceChip);

  const audience = getAudienceLabel(event);
  if (audience) {
    const label = document.createElement('div');
    label.className = 'category audience';
    label.textContent = audience;
    leftBadges.appendChild(label);
  }

  if (isMultiDayEvent(event)) {
    const label = document.createElement('div');
    label.className = 'category multiday';
    label.textContent = 'Multi-day';
    leftBadges.appendChild(label);
  }

  if (recurringLabelMode === 'main' && event._isRecurring && event._recurrenceFrequency) {
    const label = document.createElement('div');
    label.className = 'category recurring';
    label.textContent = String(event._recurrenceFrequency);
    leftBadges.appendChild(label);
  }

  if (recurringLabelMode === 'weekday') {
    const freq = getRecurringFrequency(event);
    if (freq) {
      const label = document.createElement('div');
      label.className = 'category recurring';
      const occ = formatOccurrenceDisplay(getRecurringOccurrence(event));
      label.textContent = occ ? `${freq} ${EN_DASH} ${occ}` : String(freq);
      leftBadges.appendChild(label);
    }
  }

  if (url) {
    const rsvpLink = document.createElement('a');
    rsvpLink.className = 'eventboxcta eventboxcta-secondary';
    rsvpLink.href = url;
    rsvpLink.rel = 'noopener noreferrer';
    rsvpLink.target = '_blank';
    rsvpLink.textContent = 'RSVP';
    rightBadges.appendChild(rsvpLink);
  }

  actions.appendChild(leftBadges);
  actions.appendChild(rightBadges);
  bottom.appendChild(meta);
  bottom.appendChild(actions);

  eventBox.appendChild(top);
  eventBox.appendChild(bottom);
  return eventBox;
}
