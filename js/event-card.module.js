import {
  formatDate,
  getCategory,
  getEventStartTime,
  getEventUrl,
  getLocationParts,
  isMultiDayEvent,
  getAudienceLabel,
} from './events-shared-utils.js';

function getOrganizationName(event) {
  const candidates = [
    event?.organizationName,
    event?.organizerName,
    event?.organization,
    event?.organizer,
    event?.organizations,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string') {
      const text = candidate.trim();
      if (text) return text;
      continue;
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        if (typeof item === 'string' && item.trim()) return item.trim();
        if (item && typeof item === 'object' && typeof item.name === 'string' && item.name.trim()) {
          return item.name.trim();
        }
      }
      continue;
    }
    if (candidate && typeof candidate === 'object' && typeof candidate.name === 'string' && candidate.name.trim()) {
      return candidate.name.trim();
    }
  }

  return '';
}

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
  const categorySlug = String(category || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (categorySlug) {
    top.classList.add(`eventboxtop--${categorySlug}`);
  }
  const catDiv = document.createElement('div');
  catDiv.className = 'category ' + category;
  if (categoryIdPrefix) catDiv.id = `${categoryIdPrefix}${i}`;
  catDiv.textContent = category;
  top.appendChild(catDiv);
  top.appendChild(link);

  const startDateLabel = formatDate(event?.startDate || '');
  const startTimeLabel = getEventStartTime(event);
  const mergedDateLabel = startDateLabel
    ? (startTimeLabel ? `${startDateLabel} · ${startTimeLabel}` : startDateLabel)
    : '';
  dateDiv.textContent = dateBeforeLink
    ? String(dateText(event) || mergedDateLabel)
    : mergedDateLabel;
  locDiv.textContent = getLocationParts(event)[0] || '';

  meta.appendChild(dateDiv);
  meta.appendChild(locDiv);

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

  const organizationName = getOrganizationName(event);
  if (organizationName) {
    const orgLabel = document.createElement('div');
    orgLabel.className = 'event-org';
    orgLabel.textContent = organizationName;
    leftBadges.appendChild(orgLabel);
  }

  const infoAction = document.createElement(url ? 'a' : 'div');
  infoAction.className = 'eventboxcta eventboxcta-secondary';
  if (url) {
    infoAction.href = url;
    infoAction.rel = 'noopener noreferrer';
    infoAction.target = '_blank';
  }
  infoAction.textContent = 'INFO';
  rightBadges.appendChild(infoAction);

  actions.appendChild(leftBadges);
  actions.appendChild(rightBadges);
  bottom.appendChild(meta);
  bottom.appendChild(actions);

  eventBox.appendChild(top);
  eventBox.appendChild(bottom);
  return eventBox;
}
