export function createTagDropdown(container, initialTags, onChangeTagsWithMode, options = {}) {
  const idPrefix = String(options.idPrefix || 'tag-');
  let selected = new Set();
  let mode = 'any';

  const wrap = document.createElement('div');
  wrap.className = 'tag-filter dropdown';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'tags-toggle';
  toggleBtn.setAttribute('aria-expanded', 'false');
  toggleBtn.textContent = 'Tags';

  const panel = document.createElement('div');
  panel.className = 'tags-panel';
  panel.style.display = 'none';

  const modeWrap = document.createElement('div');
  modeWrap.className = 'tags-mode';
  const modeLabel = document.createElement('span');
  modeLabel.textContent = 'Match:';
  const anyBtn = document.createElement('button');
  anyBtn.type = 'button';
  anyBtn.className = 'tag-mode any active';
  anyBtn.textContent = 'Any';
  anyBtn.setAttribute('aria-pressed', 'true');
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'tag-mode all';
  allBtn.textContent = 'All';
  allBtn.setAttribute('aria-pressed', 'false');
  modeWrap.appendChild(modeLabel);
  modeWrap.appendChild(anyBtn);
  modeWrap.appendChild(allBtn);

  const list = document.createElement('div');
  list.className = 'tags-list';

  const actions = document.createElement('div');
  actions.className = 'tags-actions';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'tags-clear';
  clearBtn.textContent = 'Clear';
  actions.appendChild(clearBtn);

  panel.appendChild(modeWrap);
  panel.appendChild(list);
  panel.appendChild(actions);
  wrap.appendChild(toggleBtn);
  wrap.appendChild(panel);
  container.appendChild(wrap);

  function emit() {
    onChangeTagsWithMode(selected.size ? new Set(selected) : null, mode);
  }

  function updateModeUI() {
    const isAny = mode === 'any';
    anyBtn.classList.toggle('active', isAny);
    allBtn.classList.toggle('active', !isAny);
    anyBtn.setAttribute('aria-pressed', String(isAny));
    allBtn.setAttribute('aria-pressed', String(!isAny));
  }

  let currentOptions = initialTags || [];
  function renderOptions(tags) {
    list.innerHTML = '';
    tags.forEach((tag) => {
      const id = `${idPrefix}${tag.replace(/[^a-z0-9]+/g, '-')}`;
      const label = document.createElement('label');
      label.className = 'tag-option';
      label.setAttribute('for', id);
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.value = tag;
      cb.checked = selected.has(tag);
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(tag); else selected.delete(tag);
        emit();
      });
      const txt = document.createElement('span');
      txt.textContent = tag;
      label.appendChild(cb);
      label.appendChild(txt);
      list.appendChild(label);
    });
  }

  toggleBtn.addEventListener('click', () => {
    const open = panel.style.display === 'none';
    panel.style.display = open ? 'block' : 'none';
    toggleBtn.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      panel.style.display = 'none';
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });

  clearBtn.addEventListener('click', () => {
    selected.clear();
    renderOptions(currentOptions);
    emit();
  });

  anyBtn.addEventListener('click', () => { mode = 'any'; updateModeUI(); emit(); });
  allBtn.addEventListener('click', () => { mode = 'all'; updateModeUI(); emit(); });

  updateModeUI();
  renderOptions(currentOptions);

  return {
    setOptions(newTags) {
      currentOptions = Array.from(newTags || []);
      const before = new Set(selected);
      selected = new Set(Array.from(selected).filter((t) => currentOptions.includes(t)));
      const changed = before.size !== selected.size || Array.from(before).some((t) => !selected.has(t));
      renderOptions(currentOptions);
      if (changed) emit();
    },
  };
}
