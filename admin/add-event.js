const form = document.getElementById('add-event-form');
const tokenInput = document.getElementById('token');
const loadOptionsBtn = document.getElementById('load-options');
const loadEventsBtn = document.getElementById('load-events');
const newEventBtn = document.getElementById('new-event');
const deleteEventBtn = document.getElementById('delete-event');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('status');
const eventsListEl = document.getElementById('events-listing');
const eventIdInput = document.getElementById('event-id');

const citySelect = document.getElementById('city_id');
const placeModeSelect = document.getElementById('place_mode');
const placeSelect = document.getElementById('place_id');
const placeExistingFields = document.getElementById('place-existing-fields');
const placeNewFields = document.getElementById('place-new-fields');

const orgModeSelect = document.getElementById('organization_mode');
const orgSelect = document.getElementById('organization_id');
const orgExistingFields = document.getElementById('organization-existing-fields');
const orgNewFields = document.getElementById('organization-new-fields');
const eventAudienceSelect = document.getElementById('event_audience_label_id');
const prideSelect = document.getElementById('pride_id');
const eventGenreSelect = document.getElementById('event-genre');
const newOrgAudienceSelect = document.getElementById('new_organization_audience_label_id');
const newOrgCategorySelect = document.getElementById('new_organization_category');
const tagSelect = document.getElementById('tag_ids');

const isMockMode = new URLSearchParams(window.location.search).get('mock') === '1';

const mockOptions = {
  cities: [
    { id: 1, name: 'Manchester', slug: 'manchester' },
    { id: 2, name: 'London', slug: 'london' },
  ],
  places: [
    { id: 10, name: 'The DBA' },
    { id: 11, name: 'YES Manchester' },
  ],
  organizations: [
    { id: 20, name: 'Queer Fam', category: 'Social', audience_label: 'all' },
    { id: 21, name: 'Sapphic Social', category: 'Social', audience_label: 'lesbian' },
  ],
  audience_labels: [
    { id: 100, name: 'lesbian' },
    { id: 101, name: 'gay' },
    { id: 102, name: 'bi' },
    { id: 103, name: 'trans' },
    { id: 104, name: 'men' },
    { id: 105, name: 'flinta' },
    { id: 106, name: 'all' },
  ],
  event_categories: ['Life', 'Sex', 'Social', 'Active', 'Music', 'Arts', 'Celebration'],
  organization_categories: ['Charity', 'Activity', 'Social', 'Arts', 'Club', 'Life', 'Sexy'],
  prides: [
    { id: 200, name: 'Manchester Village Pride', borough: 'Manchester', location: 'Gay Village' },
    { id: 201, name: 'Stockport Pride', borough: 'Stockport', location: 'Stockport' },
  ],
  tags: [
    { id: 30, name: 'community' },
    { id: 31, name: 'club' },
    { id: 32, name: 'drag' },
    { id: 33, name: 'workshop' },
  ],
};

let optionsLoaded = false;
let events = [];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#b00020' : '#000';
}

function setHidden(el, hidden) {
  el.classList.toggle('hidden', hidden);
}

function updatePlaceModeUI() {
  const mode = placeModeSelect.value;
  setHidden(placeExistingFields, mode !== 'existing');
  setHidden(placeNewFields, mode !== 'new');
}

function updateOrgModeUI() {
  const mode = orgModeSelect.value;
  setHidden(orgExistingFields, mode !== 'existing');
  setHidden(orgNewFields, mode !== 'new');
}

function fillSelect(selectEl, items, valueKey = 'id', labelKey = 'name', placeholder = 'Select an option') {
  selectEl.innerHTML = '';

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholder;
  selectEl.appendChild(placeholderOption);

  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = String(item[valueKey]);
    option.textContent = item[labelKey] ? `${item[labelKey]} (#${item[valueKey]})` : `#${item[valueKey]}`;
    selectEl.appendChild(option);
  });
}

function fillTagSelect(tags) {
  tagSelect.innerHTML = '';
  tags.forEach((tag) => {
    const option = document.createElement('option');
    option.value = String(tag.id);
    option.textContent = `${tag.name} (#${tag.id})`;
    tagSelect.appendChild(option);
  });
}

function fillAudienceSelect(selectEl, audienceLabels, placeholder) {
  fillSelect(selectEl, audienceLabels || [], 'id', 'name', placeholder);
}

function fillPrideSelect(prides) {
  prideSelect.innerHTML = '';
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = 'No linked pride';
  prideSelect.appendChild(placeholderOption);

  (prides || []).forEach((pride) => {
    const option = document.createElement('option');
    option.value = String(pride.id);
    const extras = [pride.location, pride.borough].filter(Boolean).join(', ');
    option.textContent = extras ? `${pride.name} (${extras})` : pride.name;
    prideSelect.appendChild(option);
  });
}

function fillCategorySelect(categories) {
  newOrgCategorySelect.innerHTML = '';
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = 'Select category';
  newOrgCategorySelect.appendChild(placeholderOption);

  (categories || []).forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    newOrgCategorySelect.appendChild(option);
  });
}

function fillEventCategorySelect(categories) {
  const current = eventGenreSelect.value;
  eventGenreSelect.innerHTML = '';
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = 'Select a category';
  eventGenreSelect.appendChild(placeholderOption);

  (categories || []).forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    eventGenreSelect.appendChild(option);
  });

  if (current) {
    eventGenreSelect.value = current;
  }
}

function csvToArray(csvRaw) {
  return csvRaw.split(',').map((x) => x.trim()).filter((x) => x.length > 0);
}

function selectedTagIds() {
  return Array.from(tagSelect.selectedOptions)
    .map((opt) => Number(opt.value))
    .filter((v) => Number.isInteger(v) && v > 0);
}

function fromSqlDateTimeToLocalInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(' ', 'T').slice(0, 16);
}

function eventSummary(event) {
  const when = event.start_datetime ? fromSqlDateTimeToLocalInput(event.start_datetime).replace('T', ' ') : 'No date';
  const bits = [event.genre, when].filter(Boolean).join(' | ');
  return bits || 'No details';
}

function renderEvents() {
  if (!events.length) {
    eventsListEl.innerHTML = '<p>No events found.</p>';
    return;
  }
  const rows = events.map((event) => `
    <button type="button" class="admin-listing-item" data-event-id="${event.id}">
      <strong>${event.name || '(Untitled event)'}</strong>
      <span>${eventSummary(event)}</span>
      <span>#${event.id}</span>
    </button>
  `).join('');
  eventsListEl.innerHTML = rows;
}

function resetEditor() {
  const token = tokenInput.value;
  const selectedCity = citySelect.value;
  form.reset();
  tokenInput.value = token;
  citySelect.value = selectedCity;
  eventIdInput.value = '';
  placeModeSelect.value = 'existing';
  orgModeSelect.value = 'none';
  updatePlaceModeUI();
  updateOrgModeUI();
  deleteEventBtn.disabled = true;
  submitBtn.textContent = 'Create event';
}

function fillTagSelection(tagIds) {
  const wanted = new Set((tagIds || []).map((id) => Number(id)));
  Array.from(tagSelect.options).forEach((option) => {
    option.selected = wanted.has(Number(option.value));
  });
}

function editEvent(event) {
  eventIdInput.value = String(event.id || '');
  form.elements.name.value = event.name || '';
  form.elements.description.value = event.description || '';
  form.elements.url.value = event.url || '';
  form.elements.image_url.value = event.image_url || '';
  form.elements.genre.value = event.genre || '';
  form.elements.keywords_text.value = event.keywords_text || '';
  form.elements.start_datetime.value = fromSqlDateTimeToLocalInput(event.start_datetime);
  form.elements.end_datetime.value = fromSqlDateTimeToLocalInput(event.end_datetime);
  form.elements.city_id.value = event.city_id ? String(event.city_id) : '';
  form.elements.event_audience_label_id.value = event.event_audience_label_id ? String(event.event_audience_label_id) : '';
  form.elements.pride_id.value = event.pride_id ? String(event.pride_id) : '';
  form.elements.place_mode.value = 'existing';
  form.elements.place_id.value = event.place_id ? String(event.place_id) : '';
  form.elements.organization_mode.value = event.organization_id ? 'existing' : 'none';
  form.elements.organization_id.value = event.organization_id ? String(event.organization_id) : '';
  form.elements.existing_organization_role.value = event.organization_role || '';
  form.elements.price.value = event.price == null ? '' : String(event.price);
  form.elements.price_currency.value = event.price_currency || '';
  form.elements.offer_url.value = event.offer_url || '';
  fillTagSelection(event.tag_ids || []);

  updatePlaceModeUI();
  updateOrgModeUI();
  deleteEventBtn.disabled = !eventIdInput.value;
  submitBtn.textContent = 'Save event';
  setStatus(`Editing event #${event.id}.`);
}

async function apiRequest(method, body = null) {
  const token = tokenInput.value.trim();
  const url = method === 'GET'
    ? (token ? `../api/admin-add-event.php?token=${encodeURIComponent(token)}` : '../api/admin-add-event.php')
    : '../api/admin-add-event.php';

  const response = await fetch(url, method === 'GET'
    ? { method: 'GET' }
    : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token ? { token, ...body } : { ...body }),
      });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

async function loadOptions() {
  if (isMockMode) {
    fillSelect(citySelect, mockOptions.cities, 'id', 'name', 'Select city');
    fillSelect(placeSelect, mockOptions.places, 'id', 'name', 'Select place');
    fillSelect(orgSelect, mockOptions.organizations, 'id', 'name', 'Select organization');
    fillAudienceSelect(eventAudienceSelect, mockOptions.audience_labels, 'No label');
    fillAudienceSelect(newOrgAudienceSelect, mockOptions.audience_labels, 'No label');
    fillPrideSelect(mockOptions.prides);
    fillEventCategorySelect(mockOptions.event_categories);
    fillCategorySelect(mockOptions.organization_categories);
    fillTagSelect(mockOptions.tags);
    citySelect.value = '1';
    optionsLoaded = true;
    setStatus('Mock mode: options loaded locally.');
    return;
  }

  const token = tokenInput.value.trim();
  const url = token
    ? `../api/admin-options.php?token=${encodeURIComponent(token)}`
    : '../api/admin-options.php';

  setStatus('Loading options...');
  const response = await fetch(url, { method: 'GET' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Failed to load options (${response.status})`);
  }

  fillSelect(citySelect, data.cities || [], 'id', 'name', 'Select city');
  fillSelect(placeSelect, data.places || [], 'id', 'name', 'Select place');
  fillSelect(orgSelect, data.organizations || [], 'id', 'name', 'Select organization');
  fillAudienceSelect(eventAudienceSelect, data.audience_labels || [], 'No label');
  fillAudienceSelect(newOrgAudienceSelect, data.audience_labels || [], 'No label');
  fillPrideSelect(data.prides || []);
  fillEventCategorySelect(data.event_categories || mockOptions.event_categories);
  fillCategorySelect(data.organization_categories || []);
  fillTagSelect(data.tags || []);

  const manchester = (data.cities || []).find((c) => String(c.slug || '').toLowerCase() === 'manchester');
  if (manchester) {
    citySelect.value = String(manchester.id);
  }

  optionsLoaded = true;
  setStatus('Options loaded.');
}

function buildSavePayload() {
  const fd = new FormData(form);
  const organizationMode = String(fd.get('organization_mode') || 'none');
  const organizationRole = organizationMode === 'new'
    ? String(fd.get('new_organization_role') || '').trim()
    : String(fd.get('existing_organization_role') || '').trim();

  const payload = {
    action: 'save',
    id: Number(fd.get('id') || 0),
    name: String(fd.get('name') || '').trim(),
    description: String(fd.get('description') || '').trim(),
    url: String(fd.get('url') || '').trim(),
    image_url: String(fd.get('image_url') || '').trim(),
    genre: String(fd.get('genre') || '').trim(),
    keywords_text: String(fd.get('keywords_text') || '').trim(),
    start_datetime: String(fd.get('start_datetime') || '').trim(),
    end_datetime: String(fd.get('end_datetime') || '').trim(),
    city_id: Number(fd.get('city_id') || 0),
    place_mode: String(fd.get('place_mode') || 'existing'),
    place_id: Number(fd.get('place_id') || 0),
    new_place_name: String(fd.get('new_place_name') || '').trim(),
    new_place_street_address: String(fd.get('new_place_street_address') || '').trim(),
    new_place_locality: String(fd.get('new_place_locality') || '').trim(),
    new_place_postal_code: String(fd.get('new_place_postal_code') || '').trim(),
    new_place_country: String(fd.get('new_place_country') || '').trim(),
    organization_mode: organizationMode,
    organization_id: Number(fd.get('organization_id') || 0),
    new_organization_name: String(fd.get('new_organization_name') || '').trim(),
    new_organization_category: String(fd.get('new_organization_category') || '').trim(),
    new_organization_url: String(fd.get('new_organization_url') || '').trim(),
    new_organization_logo_url: String(fd.get('new_organization_logo_url') || '').trim(),
    new_organization_audience_label_id: Number(fd.get('new_organization_audience_label_id') || 0),
    organization_role: organizationRole,
    event_audience_label_id: Number(fd.get('event_audience_label_id') || 0),
    pride_id: Number(fd.get('pride_id') || 0),
    tag_ids: selectedTagIds(),
    new_tags: csvToArray(String(fd.get('new_tags_csv') || '')),
    price: String(fd.get('price') || '').trim(),
    price_currency: String(fd.get('price_currency') || '').trim().toUpperCase(),
    offer_url: String(fd.get('offer_url') || '').trim(),
  };

  if (payload.end_datetime === '') {
    delete payload.end_datetime;
  }
  return payload;
}

async function loadEvents() {
  if (isMockMode) {
    const key = 'qc_mock_events';
    events = JSON.parse(localStorage.getItem(key) || '[]').map((entry) => ({
      id: entry.id,
      ...entry.payload,
      start_datetime: entry.payload.start_datetime ? `${entry.payload.start_datetime.replace('T', ' ')}:00` : null,
      end_datetime: entry.payload.end_datetime ? `${entry.payload.end_datetime.replace('T', ' ')}:00` : null,
      tag_ids: entry.payload.tag_ids || [],
    }));
    renderEvents();
    setStatus(`Loaded ${events.length} mock events.`);
    return;
  }

  if (!optionsLoaded) {
    await loadOptions();
  }

  setStatus('Loading events...');
  const data = await apiRequest('GET');
  events = Array.isArray(data.events) ? data.events.slice() : [];
  renderEvents();
  setStatus(`Loaded ${events.length} events.`);
}

async function saveEvent(event) {
  event.preventDefault();

  try {
    const payload = buildSavePayload();
    const isUpdate = payload.id > 0;
    setStatus(isUpdate ? 'Saving event...' : 'Creating event...');

    if (isMockMode) {
      const key = 'qc_mock_events';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const id = payload.id > 0 ? payload.id : Date.now();
      const next = existing.filter((item) => Number(item.id) !== Number(id));
      next.push({ id, payload });
      localStorage.setItem(key, JSON.stringify(next, null, 2));
      await loadEvents();
      const saved = events.find((item) => Number(item.id) === Number(id));
      if (saved) editEvent(saved);
      setStatus(isUpdate ? `Updated mock event #${id}.` : `Created mock event #${id}.`);
      return;
    }

    const data = await apiRequest('POST', payload);
    events = Array.isArray(data.events) ? data.events.slice() : events;
    renderEvents();
    const saved = events.find((item) => Number(item.id) === Number(data.event_id));
    if (saved) {
      editEvent(saved);
    }
    setStatus(isUpdate ? `Saved event #${data.event_id}.` : `Created event #${data.event_id}.`);
  } catch (error) {
    setStatus(error.message || 'Failed to save event.', true);
  }
}

async function deleteEvent() {
  const id = Number(eventIdInput.value || 0);
  if (!id) {
    setStatus('Choose an existing event to delete.', true);
    return;
  }

  try {
    setStatus('Deleting event...');

    if (isMockMode) {
      const key = 'qc_mock_events';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const next = existing.filter((item) => Number(item.id) !== id);
      localStorage.setItem(key, JSON.stringify(next, null, 2));
      await loadEvents();
      resetEditor();
      setStatus(`Deleted mock event #${id}.`);
      return;
    }

    const data = await apiRequest('POST', { action: 'delete', id });
    events = Array.isArray(data.events) ? data.events.slice() : [];
    renderEvents();
    resetEditor();
    setStatus(`Deleted event #${data.deleted_id}.`);
  } catch (error) {
    setStatus(error.message || 'Failed to delete event.', true);
  }
}

eventsListEl.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-event-id]');
  if (!button) return;
  const eventId = Number(button.dataset.eventId || 0);
  const selected = events.find((item) => Number(item.id) === eventId);
  if (!selected) return;
  if (!optionsLoaded && !isMockMode) {
    await loadOptions();
  }
  editEvent(selected);
});

loadOptionsBtn.addEventListener('click', async () => {
  try {
    await loadOptions();
  } catch (error) {
    setStatus(error.message || 'Failed to load options.', true);
  }
});

loadEventsBtn.addEventListener('click', async () => {
  try {
    await loadEvents();
  } catch (error) {
    setStatus(error.message || 'Failed to load events.', true);
  }
});

newEventBtn.addEventListener('click', () => {
  resetEditor();
  setStatus('Ready to create a new event.');
});

deleteEventBtn.addEventListener('click', async () => {
  await deleteEvent();
});

placeModeSelect.addEventListener('change', updatePlaceModeUI);
orgModeSelect.addEventListener('change', updateOrgModeUI);
form.addEventListener('submit', saveEvent);

deleteEventBtn.disabled = true;
updatePlaceModeUI();
updateOrgModeUI();
if (isMockMode) {
  setStatus('Mock mode enabled. Load options and events to begin.');
} else {
  setStatus('Load options, then load events to edit existing records.');
}
