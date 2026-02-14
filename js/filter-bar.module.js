import { createTagDropdown } from './tag-filter.module.js';

export function ensureFilterBar(beforeEl) {
  let bar = document.getElementById('category-filter-bar');
  if (!bar) {
    bar = document.createElement('section');
    bar.id = 'category-filter-bar';
    bar.className = 'category-filter-bar';
    beforeEl.parentNode.insertBefore(bar, beforeEl);
  } else {
    bar.innerHTML = '';
  }
  return bar;
}

export function buildFilterBar({
  barEl,
  categories = [],
  showCategories = true,
  initialTags = [],
  showRecurringToggle = true,
  recurringDefaultOn = false,
  onChangeCategories,
  onChangeRecurring,
  onChangeTags,
  tagIdPrefix,
}) {
  let selectedCats = null;

  if (showCategories) {
    const row = document.createElement('div');
    row.className = 'filter-row';
    barEl.appendChild(row);

    const allBtn = document.createElement('button');
    allBtn.textContent = 'All';
    allBtn.className = 'cat-pill active';
    allBtn.setAttribute('aria-pressed', 'true');
    row.appendChild(allBtn);

    const catBtns = categories.map((cat) => {
      const btn = document.createElement('button');
      btn.textContent = cat;
      btn.className = `cat-pill ${cat}`;
      btn.dataset.cat = cat;
      btn.setAttribute('aria-pressed', 'false');
      row.appendChild(btn);
      return btn;
    });

    const updateCatsUI = () => {
      const allActive = selectedCats === null || selectedCats.size === 0;
      allBtn.classList.toggle('active', allActive);
      allBtn.setAttribute('aria-pressed', String(allActive));
      catBtns.forEach((btn) => {
        const active = selectedCats && selectedCats.has(btn.dataset.cat);
        btn.classList.toggle('active', !!active);
        btn.setAttribute('aria-pressed', String(!!active));
      });
    };

    allBtn.addEventListener('click', () => {
      selectedCats = null;
      updateCatsUI();
      if (onChangeCategories) onChangeCategories(null);
    });

    catBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (selectedCats === null) selectedCats = new Set();
        const cat = btn.dataset.cat;
        if (selectedCats.has(cat)) selectedCats.delete(cat); else selectedCats.add(cat);

        if (selectedCats.size === 0) {
          selectedCats = null;
          if (onChangeCategories) onChangeCategories(null);
        } else if (onChangeCategories) {
          onChangeCategories(new Set(selectedCats));
        }

        updateCatsUI();
      });
    });

    updateCatsUI();
  }

  if (showRecurringToggle) {
    const right = document.createElement('div');
    right.className = 'filter-right';

    const recBtn = document.createElement('button');
    recBtn.className = `toggle recurring ${recurringDefaultOn ? 'on' : 'off'}`;
    recBtn.setAttribute('aria-pressed', String(recurringDefaultOn));
    recBtn.textContent = recurringDefaultOn ? 'Recurring: Shown' : 'Recurring: Hidden';
    right.appendChild(recBtn);
    barEl.appendChild(right);

    recBtn.addEventListener('click', () => {
      const on = recBtn.classList.toggle('on');
      recBtn.classList.toggle('off', !on);
      recBtn.setAttribute('aria-pressed', String(on));
      recBtn.textContent = on ? 'Recurring: Shown' : 'Recurring: Hidden';
      if (onChangeRecurring) onChangeRecurring(on);
    });
  }

  const tagCtrl = createTagDropdown(
    barEl,
    initialTags,
    onChangeTags,
    tagIdPrefix ? { idPrefix: tagIdPrefix } : {},
  );

  return {
    setTagOptions(tags) {
      tagCtrl.setOptions(tags);
    },
  };
}
