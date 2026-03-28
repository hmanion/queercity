const tokenInput = document.getElementById('token');
const loadBtn = document.getElementById('load-prides');
const seedBtn = document.getElementById('seed-prides');
const newBtn = document.getElementById('new-pride');
const form = document.getElementById('pride-form');
const statusEl = document.getElementById('status');
const listEl = document.getElementById('prides-listing');

const fieldId = document.getElementById('pride-id');
const fieldName = document.getElementById('pride-name');
const fieldWebsite = document.getElementById('pride-website-url');
const fieldLocation = document.getElementById('pride-location');
const fieldBorough = document.getElementById('pride-borough');
const fieldStartDate = document.getElementById('pride-start-date');
const fieldEndDate = document.getElementById('pride-end-date');
const fieldPublished = document.getElementById('pride-published');
const fieldSlug = document.getElementById('pride-slug');
const fieldNotes = document.getElementById('pride-notes');
const deleteBtn = document.getElementById('delete-pride');

let boroughs = [];
let prides = [];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#b00020' : '#000';
}

function populateBoroughs(items) {
  boroughs = Array.isArray(items) ? items.slice() : [];
  fieldBorough.innerHTML = '<option value="">Select borough</option>';
  boroughs.forEach((borough) => {
    const option = document.createElement('option');
    option.value = borough;
    option.textContent = borough;
    fieldBorough.appendChild(option);
  });
}

function resetForm() {
  form.reset();
  fieldId.value = '';
  if (boroughs.length && !fieldBorough.value) {
    fieldBorough.value = '';
  }
  deleteBtn.disabled = true;
}

function fillForm(pride) {
  fieldId.value = pride.id || '';
  fieldName.value = pride.name || '';
  fieldWebsite.value = pride.websiteUrl || '';
  fieldLocation.value = pride.location || '';
  fieldBorough.value = pride.borough || '';
  fieldStartDate.value = pride.startDate || '';
  fieldEndDate.value = pride.endDate || '';
  fieldPublished.checked = Number(pride.published || 0) === 1;
  fieldSlug.value = pride.slug || '';
  fieldNotes.value = pride.notes || '';
  deleteBtn.disabled = !fieldId.value;
}

function renderList() {
  if (!prides.length) {
    listEl.innerHTML = '<p>No prides found.</p>';
    return;
  }

  const rows = prides.map((pride) => {
    const meta = [pride.location, pride.borough, pride.startDate || 'Date TBC'].filter(Boolean).join(' | ');
    const state = Number(pride.published || 0) === 1 ? 'Published' : 'Draft';
    return `
      <button type="button" class="admin-listing-item" data-pride-id="${pride.id}">
        <strong>${pride.name}</strong>
        <span>${meta}</span>
        <span>${state} | ${pride.eventCount} linked events</span>
      </button>
    `;
  }).join('');

  listEl.innerHTML = rows;
}

async function request(method, body) {
  const token = tokenInput.value.trim();
  const url = method === 'GET'
    ? (token ? `../api/admin-prides.php?token=${encodeURIComponent(token)}` : '../api/admin-prides.php')
    : '../api/admin-prides.php';

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

async function loadPrides() {
  setStatus('Loading prides...');
  const data = await request('GET');
  prides = Array.isArray(data.prides) ? data.prides.slice() : [];
  populateBoroughs(data.boroughs || []);
  renderList();
  resetForm();
  setStatus(`Loaded ${prides.length} pride records.`);
}

function buildPayload() {
  return {
    action: 'save',
    id: Number(fieldId.value || 0),
    name: fieldName.value.trim(),
    website_url: fieldWebsite.value.trim(),
    location: fieldLocation.value.trim(),
    borough: fieldBorough.value.trim(),
    start_date: fieldStartDate.value || '',
    end_date: fieldEndDate.value || '',
    published: fieldPublished.checked,
    slug: fieldSlug.value.trim(),
    notes: fieldNotes.value.trim(),
  };
}

async function savePride(event) {
  event.preventDefault();
  setStatus('Saving pride...');
  const data = await request('POST', buildPayload());
  prides = Array.isArray(data.prides) ? data.prides.slice() : [];
  renderList();
  const saved = prides.find((item) => Number(item.id) === Number(data.saved_id));
  if (saved) {
    fillForm(saved);
  }
  setStatus(`Saved pride #${data.saved_id}.`);
}

async function deletePride() {
  const id = Number(fieldId.value || 0);
  if (!id) {
    setStatus('Choose an existing pride to delete.', true);
    return;
  }
  setStatus('Deleting pride...');
  const data = await request('POST', { action: 'delete', id });
  prides = Array.isArray(data.prides) ? data.prides.slice() : [];
  renderList();
  resetForm();
  setStatus(`Deleted pride #${data.deleted_id}.`);
}

async function seedDefaults() {
  setStatus('Seeding default prides...');
  const data = await request('POST', { action: 'seed_defaults' });
  prides = Array.isArray(data.prides) ? data.prides.slice() : [];
  renderList();
  resetForm();
  setStatus(`Seeded default pride records. Total now: ${prides.length}.`);
}

listEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-pride-id]');
  if (!button) return;
  const prideId = Number(button.dataset.prideId || 0);
  const pride = prides.find((item) => Number(item.id) === prideId);
  if (pride) {
    fillForm(pride);
    setStatus(`Editing ${pride.name}.`);
  }
});

loadBtn.addEventListener('click', async () => {
  try {
    await loadPrides();
  } catch (error) {
    setStatus(error.message || 'Failed to load prides.', true);
  }
});

seedBtn.addEventListener('click', async () => {
  try {
    await seedDefaults();
  } catch (error) {
    setStatus(error.message || 'Failed to seed prides.', true);
  }
});

newBtn.addEventListener('click', () => {
  resetForm();
  setStatus('Ready to create a new pride record.');
});

deleteBtn.addEventListener('click', async () => {
  try {
    await deletePride();
  } catch (error) {
    setStatus(error.message || 'Failed to delete pride.', true);
  }
});

form.addEventListener('submit', async (event) => {
  try {
    await savePride(event);
  } catch (error) {
    setStatus(error.message || 'Failed to save pride.', true);
  }
});

resetForm();
setStatus('Click "Load prides" to begin.');
