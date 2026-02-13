const form = document.getElementById('add-event-form');
const tokenInput = document.getElementById('token');
const loadOptionsBtn = document.getElementById('load-options');
const statusEl = document.getElementById('status');

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
  organization_categories: ['Charity', 'Activity', 'Social', 'Arts', 'Club', 'Life', 'Sexy'],
  tags: [
    { id: 30, name: 'community' },
    { id: 31, name: 'club' },
    { id: 32, name: 'drag' },
    { id: 33, name: 'workshop' },
  ],
};

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

async function loadOptions() {
  if (isMockMode) {
    fillSelect(citySelect, mockOptions.cities, 'id', 'name', 'Select city');
    fillSelect(placeSelect, mockOptions.places, 'id', 'name', 'Select place');
    fillSelect(orgSelect, mockOptions.organizations, 'id', 'name', 'Select organization');
    fillAudienceSelect(eventAudienceSelect, mockOptions.audience_labels, 'No label');
    fillAudienceSelect(newOrgAudienceSelect, mockOptions.audience_labels, 'No label');
    fillCategorySelect(mockOptions.organization_categories);
    fillTagSelect(mockOptions.tags);
    citySelect.value = '1';
    setStatus('Mock mode: options loaded locally (no API call).');
    return;
  }

  const token = tokenInput.value.trim();
  if (!token) {
    setStatus('Enter token first.', true);
    return;
  }

  setStatus('Loading options...');
  const url = `../api/admin-options.php?token=${encodeURIComponent(token)}`;

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
  fillCategorySelect(data.organization_categories || []);
  fillTagSelect(data.tags || []);

  const manchester = (data.cities || []).find((c) => String(c.slug || '').toLowerCase() === 'manchester');
  if (manchester) {
    citySelect.value = String(manchester.id);
  }

  setStatus('Options loaded. You can now pick existing records.');
}

function selectedTagIds() {
  return Array.from(tagSelect.selectedOptions).map((opt) => Number(opt.value)).filter((v) => Number.isInteger(v) && v > 0);
}

function csvToArray(csvRaw) {
  return csvRaw
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function buildPayload() {
  const fd = new FormData(form);
  const organizationMode = String(fd.get('organization_mode') || 'none');
  const organizationRole = organizationMode === 'new'
    ? String(fd.get('new_organization_role') || '').trim()
    : String(fd.get('existing_organization_role') || '').trim();

  const payload = {
    token: String(fd.get('token') || '').trim(),
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

async function submitEvent(event) {
  event.preventDefault();

  try {
    const payload = buildPayload();
    setStatus('Creating event...');

    if (isMockMode) {
      const key = 'qc_mock_events';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const eventId = Date.now();
      existing.push({
        id: eventId,
        created_at: new Date().toISOString(),
        payload,
      });
      localStorage.setItem(key, JSON.stringify(existing, null, 2));
      setStatus(`Mock mode: saved event #${eventId} to localStorage key "${key}".`);
      const token = tokenInput.value;
      const selectedCity = citySelect.value;
      form.reset();
      tokenInput.value = token;
      citySelect.value = selectedCity;
      updatePlaceModeUI();
      updateOrgModeUI();
      return;
    }

    const response = await fetch('../api/admin-add-event.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Failed to create event (${response.status})`);
    }

    const token = tokenInput.value;
    const selectedCity = citySelect.value;
    setStatus(`Created event #${data.event_id}.`);
    form.reset();
    tokenInput.value = token;
    citySelect.value = selectedCity;
    updatePlaceModeUI();
    updateOrgModeUI();
  } catch (error) {
    setStatus(error.message || 'Failed to create event.', true);
  }
}

loadOptionsBtn.addEventListener('click', async () => {
  try {
    await loadOptions();
  } catch (error) {
    setStatus(error.message || 'Failed to load options.', true);
  }
});

placeModeSelect.addEventListener('change', updatePlaceModeUI);
orgModeSelect.addEventListener('change', updateOrgModeUI);
form.addEventListener('submit', submitEvent);

updatePlaceModeUI();
updateOrgModeUI();
if (isMockMode) {
  setStatus('Mock mode enabled. Click "Load existing DB options" to populate local test data.');
} else {
  setStatus('Enter token, click "Load existing DB options", then submit.');
}
