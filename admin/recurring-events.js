const form = document.getElementById('recurring-event-form');
const tokenInput = document.getElementById('token');
const loadOptionsBtn = document.getElementById('load-options');
const loadEventsBtn = document.getElementById('load-events');
const newEventBtn = document.getElementById('new-event');
const deleteEventBtn = document.getElementById('delete-event');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('status');
const eventsListEl = document.getElementById('events-listing');
const eventIdInput = document.getElementById('event-id');
const eventsFilterSearch = document.getElementById('events-filter-search');
const eventsFilterCategory = document.getElementById('events-filter-category');
const eventsFilterFrequency = document.getElementById('events-filter-frequency');
const eventsFilterReset = document.getElementById('events-filter-reset');

const citySelect = document.getElementById('city_id');
const placeSelect = document.getElementById('place_id');
const orgSelect = document.getElementById('organization_id');
const eventAudienceSelect = document.getElementById('event_audience_label_id');
const prideSelect = document.getElementById('pride_id');
const eventGenreSelect = document.getElementById('event-genre');
const tagSelect = document.getElementById('tag_ids');

const DEFAULT_TZ = 'Europe/London';
const DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

let optionsLoaded = false;
let events = [];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#b00020' : '#000';
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

function selectedByDay() {
  return Array.from(form.querySelectorAll('input[name="by_day"]:checked'))
    .map((input) => String(input.value || '').trim())
    .filter((code) => DAY_CODES.includes(code));
}

function setByDaySelection(byDay) {
  const wanted = new Set((byDay || []).map((item) => String(item || '').trim().toUpperCase()));
  form.querySelectorAll('input[name="by_day"]').forEach((input) => {
    input.checked = wanted.has(String(input.value || '').trim().toUpperCase());
  });
}

function fillTagSelection(tagIds) {
  const wanted = new Set((tagIds || []).map((id) => Number(id)));
  Array.from(tagSelect.options).forEach((option) => {
    option.selected = wanted.has(Number(option.value));
  });
}

function recurringEventSummary(event) {
  const byDay = Array.isArray(event.by_day) ? event.by_day.join(', ') : '';
  return [event.genre, event.repeat_frequency, byDay, event.start_time, event.start_date].filter(Boolean).join(' | ');
}

function populateEventFilters() {
  const categories = Array.from(new Set(events.map((e) => String(e.genre || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const frequencies = Array.from(new Set(events.map((e) => String(e.repeat_frequency || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  eventsFilterCategory.innerHTML = '<option value="">All categories</option>';
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    eventsFilterCategory.appendChild(option);
  });

  eventsFilterFrequency.innerHTML = '<option value="">All frequencies</option>';
  frequencies.forEach((frequency) => {
    const option = document.createElement('option');
    option.value = frequency;
    option.textContent = frequency;
    eventsFilterFrequency.appendChild(option);
  });
}

function getFilteredEvents() {
  const query = String(eventsFilterSearch.value || '').trim().toLowerCase();
  const category = String(eventsFilterCategory.value || '').trim();
  const frequency = String(eventsFilterFrequency.value || '').trim();

  return events.filter((event) => {
    if (category && String(event.genre || '') !== category) return false;
    if (frequency && String(event.repeat_frequency || '') !== frequency) return false;
    if (!query) return true;

    const haystack = [
      event.id,
      event.name,
      event.genre,
      event.keywords_text,
      event.repeat_frequency,
      event.start_date,
      event.start_time,
      (event.by_day || []).join(','),
    ].map((v) => String(v || '').toLowerCase()).join(' ');

    return haystack.includes(query);
  });
}

function renderEvents() {
  const visible = getFilteredEvents();
  if (!visible.length) {
    eventsListEl.innerHTML = '<p>No recurring events found.</p>';
    return;
  }
  const rows = visible.map((event) => `
    <button type="button" class="admin-listing-item" data-event-id="${event.id}">
      <strong>${event.name || '(Untitled event)'}</strong>
      <span>${recurringEventSummary(event)}</span>
      <span>#${event.id}</span>
    </button>
  `).join('');
  eventsListEl.innerHTML = rows;
}

function resetEditor() {
  const token = tokenInput.value;
  const selectedCity = citySelect.value;
  const selectedPlace = placeSelect.value;
  form.reset();
  tokenInput.value = token;
  citySelect.value = selectedCity;
  placeSelect.value = selectedPlace;
  eventIdInput.value = '';
  form.elements.schedule_timezone.value = DEFAULT_TZ;
  setByDaySelection([]);
  deleteEventBtn.disabled = true;
  submitBtn.textContent = 'Create recurring event';
}

function editEvent(event) {
  eventIdInput.value = String(event.id || '');
  form.elements.name.value = event.name || '';
  form.elements.description.value = event.description || '';
  form.elements.url.value = event.url || '';
  form.elements.image_url.value = event.image_url || '';
  form.elements.genre.value = event.genre || '';
  form.elements.keywords_text.value = event.keywords_text || '';
  form.elements.city_id.value = event.city_id ? String(event.city_id) : '';
  form.elements.place_id.value = event.place_id ? String(event.place_id) : '';
  form.elements.organization_id.value = event.organization_id ? String(event.organization_id) : '';
  form.elements.organization_role.value = event.organization_role || '';
  form.elements.event_audience_label_id.value = event.event_audience_label_id ? String(event.event_audience_label_id) : '';
  form.elements.pride_id.value = event.pride_id ? String(event.pride_id) : '';

  form.elements.repeat_frequency.value = event.repeat_frequency || '';
  form.elements.schedule_timezone.value = event.schedule_timezone || DEFAULT_TZ;
  form.elements.start_time.value = String(event.start_time || '').slice(0, 5);
  form.elements.end_time.value = String(event.end_time || '').slice(0, 5);
  form.elements.start_date.value = event.start_date || '';
  form.elements.end_date.value = event.end_date || '';
  form.elements.repeat_count.value = event.repeat_count == null ? '' : String(event.repeat_count);
  setByDaySelection(event.by_day || []);

  form.elements.price.value = event.price == null ? '' : String(event.price);
  form.elements.price_currency.value = event.price_currency || '';
  form.elements.offer_url.value = event.offer_url || '';
  fillTagSelection(event.tag_ids || []);

  deleteEventBtn.disabled = !eventIdInput.value;
  submitBtn.textContent = 'Save recurring event';
  setStatus(`Editing recurring event #${event.id}.`);
}

async function apiRequest(method, body = null) {
  const token = tokenInput.value.trim();
  const url = method === 'GET'
    ? (token ? `../api/admin-recurring-events.php?token=${encodeURIComponent(token)}` : '../api/admin-recurring-events.php')
    : '../api/admin-recurring-events.php';

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
  fillSelect(orgSelect, data.organizations || [], 'id', 'name', 'No linked organization');
  fillAudienceSelect(eventAudienceSelect, data.audience_labels || [], 'No label');
  fillPrideSelect(data.prides || []);
  fillEventCategorySelect(data.event_categories || []);
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
  const payload = {
    action: 'save',
    id: Number(fd.get('id') || 0),
    name: String(fd.get('name') || '').trim(),
    description: String(fd.get('description') || '').trim(),
    url: String(fd.get('url') || '').trim(),
    image_url: String(fd.get('image_url') || '').trim(),
    genre: String(fd.get('genre') || '').trim(),
    keywords_text: String(fd.get('keywords_text') || '').trim(),
    city_id: Number(fd.get('city_id') || 0),
    place_id: Number(fd.get('place_id') || 0),
    organization_id: Number(fd.get('organization_id') || 0),
    organization_role: String(fd.get('organization_role') || '').trim(),
    event_audience_label_id: Number(fd.get('event_audience_label_id') || 0),
    pride_id: Number(fd.get('pride_id') || 0),
    repeat_frequency: String(fd.get('repeat_frequency') || '').trim(),
    schedule_timezone: String(fd.get('schedule_timezone') || '').trim(),
    start_time: String(fd.get('start_time') || '').trim(),
    end_time: String(fd.get('end_time') || '').trim(),
    start_date: String(fd.get('start_date') || '').trim(),
    end_date: String(fd.get('end_date') || '').trim(),
    repeat_count: String(fd.get('repeat_count') || '').trim(),
    by_day: selectedByDay(),
    tag_ids: selectedTagIds(),
    new_tags: csvToArray(String(fd.get('new_tags_csv') || '')),
    price: String(fd.get('price') || '').trim(),
    price_currency: String(fd.get('price_currency') || '').trim().toUpperCase(),
    offer_url: String(fd.get('offer_url') || '').trim(),
  };

  if (payload.organization_id <= 0) {
    payload.organization_id = 0;
    payload.organization_role = '';
  }
  if (payload.event_audience_label_id <= 0) {
    payload.event_audience_label_id = 0;
  }
  if (payload.pride_id <= 0) {
    payload.pride_id = 0;
  }
  if (payload.end_time === '') {
    delete payload.end_time;
  }
  if (payload.end_date === '') {
    delete payload.end_date;
  }
  if (payload.repeat_count === '') {
    delete payload.repeat_count;
  }
  return payload;
}

async function loadEvents() {
  if (!optionsLoaded) {
    await loadOptions();
  }

  setStatus('Loading recurring events...');
  let data;
  try {
    data = await apiRequest('GET');
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (!message.includes('405')) {
      throw error;
    }
    data = await apiRequest('POST', { action: 'list' });
  }
  events = Array.isArray(data.events) ? data.events.slice() : [];
  populateEventFilters();
  renderEvents();
  setStatus(`Loaded ${events.length} recurring events.`);
}

async function saveEvent(event) {
  event.preventDefault();
  const payload = buildSavePayload();
  const isUpdate = payload.id > 0;
  setStatus(isUpdate ? 'Saving recurring event...' : 'Creating recurring event...');

  const data = await apiRequest('POST', payload);
  events = Array.isArray(data.events) ? data.events.slice() : events;
  populateEventFilters();
  renderEvents();
  const saved = events.find((item) => Number(item.id) === Number(data.event_id));
  if (saved) {
    editEvent(saved);
  }
  setStatus(isUpdate ? `Saved recurring event #${data.event_id}.` : `Created recurring event #${data.event_id}.`);
}

async function deleteEvent() {
  const id = Number(eventIdInput.value || 0);
  if (!id) {
    setStatus('Choose an existing recurring event to delete.', true);
    return;
  }

  setStatus('Deleting recurring event...');
  const data = await apiRequest('POST', { action: 'delete', id });
  events = Array.isArray(data.events) ? data.events.slice() : [];
  populateEventFilters();
  renderEvents();
  resetEditor();
  setStatus(`Deleted recurring event #${data.deleted_id}.`);
}

eventsListEl.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-event-id]');
  if (!button) return;
  const eventId = Number(button.dataset.eventId || 0);
  const selected = events.find((item) => Number(item.id) === eventId);
  if (!selected) return;
  if (!optionsLoaded) {
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
    setStatus(error.message || 'Failed to load recurring events.', true);
  }
});

newEventBtn.addEventListener('click', () => {
  resetEditor();
  setStatus('Ready to create a new recurring event.');
});

deleteEventBtn.addEventListener('click', async () => {
  try {
    await deleteEvent();
  } catch (error) {
    setStatus(error.message || 'Failed to delete recurring event.', true);
  }
});

form.addEventListener('submit', async (event) => {
  try {
    await saveEvent(event);
  } catch (error) {
    setStatus(error.message || 'Failed to save recurring event.', true);
  }
});

eventsFilterSearch.addEventListener('input', renderEvents);
eventsFilterCategory.addEventListener('change', renderEvents);
eventsFilterFrequency.addEventListener('change', renderEvents);
eventsFilterReset.addEventListener('click', () => {
  eventsFilterSearch.value = '';
  eventsFilterCategory.value = '';
  eventsFilterFrequency.value = '';
  renderEvents();
});

deleteEventBtn.disabled = true;
form.elements.schedule_timezone.value = DEFAULT_TZ;
setStatus('Load options, then load recurring events to edit existing records.');
