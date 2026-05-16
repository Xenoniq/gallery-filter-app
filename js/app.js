import { categories, tags, sortOptions, galleryItems } from './data.js';
import { buildShareUrl, parseStateFromUrl, writeStateToUrl } from './url-state.js';

const FALLBACK_IMAGE = './assets/images/social-cover.jpg';
const DEFAULT_TITLE = 'PixelNest — Галерея с умной фильтрацией';
const collator = new Intl.Collator('ru-RU', { sensitivity: 'base', numeric: true });

const elements = {
  filtersForm: document.querySelector('#filtersForm'),
  categoryFilters: document.querySelector('#categoryFilters'),
  tagFilters: document.querySelector('#tagFilters'),
  searchInput: document.querySelector('#searchInput'),
  sortSelect: document.querySelector('#sortSelect'),
  selectedFilters: document.querySelector('#selectedFilters'),
  gallery: document.querySelector('#gallery'),
  emptyState: document.querySelector('#emptyState'),
  shareButton: document.querySelector('#shareButton'),
  copyLinkButton: document.querySelector('#copyLinkButton'),
  resetButton: document.querySelector('#resetButton'),
  resultsCounter: document.querySelector('#resultsCounter'),
  activeFiltersCounter: document.querySelector('#activeFiltersCounter'),
  sortModeChip: document.querySelector('#sortModeChip'),
  currentUrlField: document.querySelector('#currentUrlField'),
  previewImage: document.querySelector('#previewImage'),
  previewCategory: document.querySelector('#previewCategory'),
  previewTitle: document.querySelector('#preview-title'),
  previewDescription: document.querySelector('#previewDescription'),
  previewTags: document.querySelector('#previewTags'),
  openPreviewButton: document.querySelector('#openPreviewButton'),
  toast: document.querySelector('#toast'),
  lightbox: document.querySelector('#lightbox'),
  lightboxImage: document.querySelector('#lightboxImage'),
  lightboxCategory: document.querySelector('#lightboxCategory'),
  lightboxTitle: document.querySelector('#lightboxTitle'),
  lightboxDescription: document.querySelector('#lightboxDescription'),
  lightboxMeta: document.querySelector('#lightboxMeta'),
  lightboxTags: document.querySelector('#lightboxTags'),
  lightboxPrev: document.querySelector('#lightboxPrev'),
  lightboxNext: document.querySelector('#lightboxNext'),
};

const categoryKeys = Object.keys(categories);
const tagKeys = Object.keys(tags);
const sortKeys = Object.keys(sortOptions);
const validCategoryKeys = new Set(categoryKeys);
const validTagKeys = new Set(tagKeys);
const validSortKeys = new Set(sortKeys);

const state = normalizeState(
  parseStateFromUrl({
    validCategoryKeys,
    validTagKeys,
    validSortKeys,
  }),
);

let toastTimeoutId = 0;
let lastFilteredItems = [];
let activeLightboxIndex = -1;
let activeLightboxItemId = '';
let lastFocusedElement = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeState(candidate) {
  return {
    category: validCategoryKeys.has(candidate?.category) ? candidate.category : 'all',
    tags: [...new Set((candidate?.tags ?? []).filter((tag) => validTagKeys.has(tag)))].sort(),
    sort: validSortKeys.has(candidate?.sort) ? candidate.sort : 'featured',
    query: String(candidate?.query ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 60),
  };
}

function getActiveFiltersCount() {
  return Number(state.category !== 'all') + state.tags.length + Number(Boolean(state.query));
}

function setState(nextPartialState, { writeUrl = true } = {}) {
  Object.assign(state, normalizeState({ ...state, ...nextPartialState }));

  if (writeUrl) {
    writeStateToUrl(state);
  }

  syncUi();
}

function getCategoryLabel(categoryKey) {
  return categories[categoryKey]?.label ?? 'Без категории';
}

function getTagLabel(tagKey) {
  return tags[tagKey]?.label ?? tagKey;
}

function getItemSearchText(item) {
  return [
    item.id,
    item.title,
    item.description,
    getCategoryLabel(item.category),
    ...item.tags.map((tagKey) => getTagLabel(tagKey)),
  ]
    .join(' ')
    .toLowerCase();
}

function itemMatchesFilters(item, candidateState) {
  const matchesCategory = candidateState.category === 'all' || item.category === candidateState.category;
  const matchesTags = candidateState.tags.every((tag) => item.tags.includes(tag));
  const matchesQuery =
    !candidateState.query || getItemSearchText(item).includes(candidateState.query.toLowerCase());

  return matchesCategory && matchesTags && matchesQuery;
}

function getFilteredItems(candidateState = state) {
  return galleryItems.filter((item) => itemMatchesFilters(item, candidateState));
}

function sortItems(items, sortKey) {
  const nextItems = [...items];

  switch (sortKey) {
    case 'titleAsc':
      nextItems.sort((a, b) => collator.compare(a.title, b.title) || a.order - b.order);
      break;
    case 'titleDesc':
      nextItems.sort((a, b) => collator.compare(b.title, a.title) || a.order - b.order);
      break;
    case 'category':
      nextItems.sort(
        (a, b) =>
          collator.compare(getCategoryLabel(a.category), getCategoryLabel(b.category)) ||
          collator.compare(a.title, b.title) ||
          a.order - b.order,
      );
      break;
    case 'featured':
    default:
      nextItems.sort((a, b) => a.order - b.order);
      break;
  }

  return nextItems;
}

function renderTagBadges(tagList, { emptyText = '' } = {}) {
  if (!Array.isArray(tagList) || !tagList.length) {
    return emptyText
      ? `<span class="selected-chip selected-chip--empty">${escapeHtml(emptyText)}</span>`
      : '';
  }

  return tagList
    .map((tagKey) => `<span class="card__tag">#${escapeHtml(getTagLabel(tagKey))}</span>`)
    .join('');
}

function renderPreviewTagBadges(tagList) {
  elements.previewTags.innerHTML = renderTagBadges(tagList, {
    emptyText: 'Теги будут показаны здесь',
  });
}

function getCategoryCount(categoryKey) {
  return getFilteredItems({ ...state, category: categoryKey }).length;
}

function getTagCount(tagKey) {
  const prospectiveTags = new Set(state.tags);
  prospectiveTags.add(tagKey);

  return getFilteredItems({ ...state, tags: [...prospectiveTags].sort() }).length;
}

function renderCategoryFilters() {
  elements.categoryFilters.innerHTML = categoryKeys
    .map((categoryKey) => {
      const isChecked = state.category === categoryKey;
      const count = getCategoryCount(categoryKey);
      const label = categories[categoryKey];

      return `
        <label class="filter-label" style="--filter-accent: ${escapeHtml(label.accent)}">
          <input
            type="radio"
            name="category"
            value="${categoryKey}"
            ${isChecked ? 'checked' : ''}
          />
          <span class="filter-label__text">
            <span>${escapeHtml(label.label)}</span>
            <span class="filter-label__hint">${count} изображений</span>
          </span>
        </label>
      `;
    })
    .join('');
}

function renderTagFilters() {
  const orderedTagKeys = [...tagKeys].sort((a, b) => collator.compare(getTagLabel(a), getTagLabel(b)));

  elements.tagFilters.innerHTML = orderedTagKeys
    .map((tagKey) => {
      const isChecked = state.tags.includes(tagKey);
      const count = getTagCount(tagKey);

      return `
        <label class="filter-label">
          <input
            type="checkbox"
            name="tags"
            value="${tagKey}"
            ${isChecked ? 'checked' : ''}
          />
          <span class="filter-label__text">
            <span>${escapeHtml(getTagLabel(tagKey))}</span>
            <span class="filter-label__hint">${count} карточек</span>
          </span>
        </label>
      `;
    })
    .join('');
}

function renderSortOptions() {
  elements.sortSelect.innerHTML = sortKeys
    .map(
      (sortKey) =>
        `<option value="${sortKey}">${escapeHtml(sortOptions[sortKey].label)}</option>`,
    )
    .join('');

  elements.sortSelect.value = state.sort;
}

function renderSelectedFilters() {
  const chips = [];

  if (state.category !== 'all') {
    chips.push(`
      <span class="selected-chip">
        Категория: ${escapeHtml(getCategoryLabel(state.category))}
        <button
          class="selected-chip__remove"
          type="button"
          aria-label="Убрать фильтр по категории"
          data-remove-filter="category"
        >×</button>
      </span>
    `);
  }

  if (state.query) {
    chips.push(`
      <span class="selected-chip">
        Поиск: ${escapeHtml(state.query)}
        <button
          class="selected-chip__remove"
          type="button"
          aria-label="Очистить поисковый запрос"
          data-remove-filter="query"
        >×</button>
      </span>
    `);
  }

  [...state.tags]
    .sort((a, b) => collator.compare(getTagLabel(a), getTagLabel(b)))
    .forEach((tagKey) => {
      chips.push(`
        <span class="selected-chip">
          Тег: ${escapeHtml(getTagLabel(tagKey))}
          <button
            class="selected-chip__remove"
            type="button"
            aria-label="Убрать тег ${escapeHtml(getTagLabel(tagKey))}"
            data-remove-filter="tag"
            data-value="${tagKey}"
          >×</button>
        </span>
      `);
    });

  elements.selectedFilters.innerHTML =
    chips.join('') || '<span class="selected-chip selected-chip--empty">Фильтры не выбраны</span>';
}

function renderPreview(filteredItems) {
  const previewItem = filteredItems[0];

  if (!previewItem) {
    elements.previewImage.src = FALLBACK_IMAGE;
    elements.previewImage.alt = 'Резервное изображение для пустого состояния';
    elements.previewCategory.textContent = 'Нет совпадений';
    elements.previewTitle.textContent = 'Подборка не найдена';
    elements.previewDescription.textContent =
      'Сейчас выбранные фильтры не дают результатов. Измени категорию, убери часть тегов или очисти поиск — ссылка обновится автоматически.';
    renderPreviewTagBadges(state.tags);
    elements.openPreviewButton.disabled = true;
    elements.openPreviewButton.dataset.targetId = '';
    return;
  }

  elements.previewImage.src = previewItem.image;
  elements.previewImage.alt = previewItem.alt;
  elements.previewCategory.textContent = getCategoryLabel(previewItem.category);
  elements.previewTitle.textContent = previewItem.title;
  elements.previewDescription.textContent = previewItem.description;
  renderPreviewTagBadges(previewItem.tags);
  elements.openPreviewButton.disabled = false;
  elements.openPreviewButton.dataset.targetId = previewItem.id;
}

function renderGallery(filteredItems) {
  lastFilteredItems = filteredItems;

  if (!filteredItems.length) {
    elements.gallery.innerHTML = '';
    elements.gallery.hidden = true;
    elements.emptyState.hidden = false;
    return;
  }

  elements.gallery.innerHTML = filteredItems
    .map((item) => {
      const itemTags = renderTagBadges(item.tags);

      return `
        <article class="card" data-id="${item.id}">
          <figure class="card__figure">
            <img
              class="card__image"
              src="${item.image}"
              alt="${escapeHtml(item.alt)}"
              loading="lazy"
              decoding="async"
              width="1600"
              height="1067"
            />
          </figure>
          <div class="card__body">
            <div class="card__header">
              <div>
                <h3 class="card__title">${escapeHtml(item.title)}</h3>
                <p class="meta-row">ID: ${escapeHtml(item.id)}</p>
              </div>
              <span class="card__category">${escapeHtml(getCategoryLabel(item.category))}</span>
            </div>
            <p class="card__description">${escapeHtml(item.description)}</p>
            <div class="card__tags" aria-label="Теги изображения">
              ${itemTags}
            </div>
            <div class="card__footer">
              <p class="card__credit">Фото: ${escapeHtml(item.credit)}</p>
              <button class="button button--secondary" type="button" data-open-lightbox="${item.id}">
                Открыть
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  elements.gallery.hidden = false;
  elements.emptyState.hidden = true;
}

function updateDocumentTitle(filteredItems) {
  if (!getActiveFiltersCount()) {
    document.title = DEFAULT_TITLE;
    return;
  }

  const fragments = [];

  if (state.category !== 'all') {
    fragments.push(getCategoryLabel(state.category));
  }

  if (state.query) {
    fragments.push(`поиск: ${state.query}`);
  }

  document.title = `PixelNest — ${filteredItems.length} результатов${fragments.length ? ` · ${fragments.join(' · ')}` : ''}`;
}

function renderCounters(filteredItems) {
  elements.resultsCounter.textContent = `Найдено: ${filteredItems.length}`;
  elements.activeFiltersCounter.textContent = `Активных фильтров: ${getActiveFiltersCount()}`;
  elements.sortModeChip.textContent = `Сортировка: ${sortOptions[state.sort].label}`;
  elements.currentUrlField.value = buildShareUrl();
  updateDocumentTitle(filteredItems);
}

function renderLightbox() {
  if (activeLightboxItemId) {
    const syncedIndex = lastFilteredItems.findIndex((item) => item.id === activeLightboxItemId);

    if (syncedIndex >= 0) {
      activeLightboxIndex = syncedIndex;
    }
  }

  const item = lastFilteredItems[activeLightboxIndex];

  if (!item) {
    closeLightbox();
    return;
  }

  elements.lightboxImage.src = item.image;
  elements.lightboxImage.alt = item.alt;
  elements.lightboxCategory.textContent = getCategoryLabel(item.category);
  elements.lightboxTitle.textContent = item.title;
  elements.lightboxDescription.textContent = item.description;
  elements.lightboxMeta.textContent = `${activeLightboxIndex + 1} / ${lastFilteredItems.length} • ID: ${item.id} • ${item.credit}`;
  elements.lightboxTags.innerHTML = renderTagBadges(item.tags, { emptyText: 'Теги отсутствуют' });
  elements.lightboxPrev.disabled = lastFilteredItems.length < 2;
  elements.lightboxNext.disabled = lastFilteredItems.length < 2;
}

function openLightboxById(itemId) {
  const nextIndex = lastFilteredItems.findIndex((item) => item.id === itemId);

  if (nextIndex < 0) {
    return;
  }

  activeLightboxIndex = nextIndex;
  activeLightboxItemId = lastFilteredItems[nextIndex]?.id ?? '';
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  elements.lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  renderLightbox();
  elements.lightbox.querySelector('.lightbox__close')?.focus();
}

function closeLightbox() {
  if (elements.lightbox.hidden) {
    return;
  }

  elements.lightbox.hidden = true;
  document.body.style.overflow = '';
  activeLightboxIndex = -1;
  activeLightboxItemId = '';

  if (lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus();
  }
}

function goToLightboxOffset(offset) {
  if (lastFilteredItems.length < 2 || activeLightboxIndex < 0) {
    return;
  }

  activeLightboxIndex = (activeLightboxIndex + offset + lastFilteredItems.length) % lastFilteredItems.length;
  activeLightboxItemId = lastFilteredItems[activeLightboxIndex]?.id ?? '';
  renderLightbox();
}

function syncUi() {
  elements.searchInput.value = state.query;
  renderSortOptions();
  renderCategoryFilters();
  renderTagFilters();
  renderSelectedFilters();

  const filteredItems = sortItems(getFilteredItems(), state.sort);

  renderGallery(filteredItems);
  renderPreview(filteredItems);
  renderCounters(filteredItems);

  if (!elements.lightbox.hidden) {
    const activeItemStillVisible = lastFilteredItems.some((item) => item.id === activeLightboxItemId);

    if (!activeItemStillVisible) {
      closeLightbox();
    } else {
      renderLightbox();
    }
  }
}

function showToast(message, tone = 'default') {
  elements.toast.textContent = message;
  elements.toast.dataset.tone = tone;
  elements.toast.classList.add('is-visible');

  window.clearTimeout(toastTimeoutId);
  toastTimeoutId = window.setTimeout(() => {
    elements.toast.classList.remove('is-visible');
  }, 2600);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const input = document.createElement('input');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'absolute';
  input.style.left = '-9999px';
  document.body.append(input);
  input.select();
  input.setSelectionRange(0, input.value.length);

  const copied = document.execCommand('copy');
  input.remove();

  if (!copied) {
    throw new Error('copy failed');
  }

  return true;
}

async function copyCurrentUrl() {
  const url = buildShareUrl();

  try {
    await copyTextToClipboard(url);
    showToast('Текущая ссылка скопирована в буфер обмена.', 'success');
  } catch (error) {
    window.prompt('Скопируйте ссылку вручную:', url);
    showToast('Браузер заблокировал копирование. Показано окно со ссылкой.', 'warning');
  }
}

async function handleShare() {
  const url = buildShareUrl();
  const shareData = {
    title: 'PixelNest — галерея изображений',
    text: 'Открой галерею с уже применёнными фильтрами.',
    url,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      showToast('Системное окно шаринга открыто.', 'success');
      return;
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }
    }
  }

  await copyCurrentUrl();
}

function resetFilters() {
  setState({
    category: 'all',
    tags: [],
    sort: 'featured',
    query: '',
  });
  showToast('Фильтры, поиск и сортировка сброшены.');
}

function handleFilterFormChange(event) {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.name === 'category') {
    setState({ category: target.value });
    return;
  }

  if (target.name === 'tags') {
    const selectedTags = Array.from(
      elements.filtersForm.querySelectorAll('input[name="tags"]:checked'),
    ).map((input) => input.value);

    setState({ tags: selectedTags });
  }
}

function handleSearchInput(event) {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  setState({ query: target.value });
}

function handleSortChange(event) {
  const target = event.target;

  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  setState({ sort: target.value });
}

function handleSelectedFiltersClick(event) {
  const button = event.target.closest('[data-remove-filter]');

  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const filterType = button.dataset.removeFilter;

  if (filterType === 'category') {
    setState({ category: 'all' });
    return;
  }

  if (filterType === 'query') {
    setState({ query: '' });
    return;
  }

  if (filterType === 'tag' && button.dataset.value) {
    setState({ tags: state.tags.filter((tagKey) => tagKey !== button.dataset.value) });
  }
}

function handleGalleryClick(event) {
  const openButton = event.target.closest('[data-open-lightbox]');

  if (openButton instanceof HTMLElement && openButton.dataset.openLightbox) {
    openLightboxById(openButton.dataset.openLightbox);
  }
}

function handlePreviewOpen() {
  const itemId = elements.openPreviewButton.dataset.targetId;

  if (itemId) {
    openLightboxById(itemId);
  }
}

function handleLightboxClick(event) {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.matches('[data-lightbox-close]')) {
    closeLightbox();
  }
}

function handleGlobalKeydown(event) {
  const isTypingContext =
    event.target instanceof HTMLElement &&
    (event.target.matches('input, textarea, select') || event.target.isContentEditable);

  if (!elements.lightbox.hidden) {
    if (event.key === 'Escape') {
      closeLightbox();
      return;
    }

    if (event.key === 'ArrowLeft') {
      goToLightboxOffset(-1);
      return;
    }

    if (event.key === 'ArrowRight') {
      goToLightboxOffset(1);
      return;
    }
  }

  if (
    event.key === '/' &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !isTypingContext
  ) {
    event.preventDefault();
    elements.searchInput.focus();
    elements.searchInput.select();
  }
}

function handlePopState() {
  Object.assign(
    state,
    normalizeState(
      parseStateFromUrl({
        validCategoryKeys,
        validTagKeys,
        validSortKeys,
      }),
    ),
  );

  syncUi();
}

function handleCurrentUrlInteraction() {
  elements.currentUrlField.focus();
  elements.currentUrlField.select();
}

function handleImageError(event) {
  const target = event.target;

  if (!(target instanceof HTMLImageElement)) {
    return;
  }

  if (target.dataset.fallbackApplied === 'true') {
    return;
  }

  target.dataset.fallbackApplied = 'true';
  target.src = FALLBACK_IMAGE;
}

function init() {
  syncUi();
  writeStateToUrl(state);

  elements.filtersForm.addEventListener('change', handleFilterFormChange);
  elements.searchInput.addEventListener('input', handleSearchInput);
  elements.sortSelect.addEventListener('change', handleSortChange);
  elements.selectedFilters.addEventListener('click', handleSelectedFiltersClick);
  elements.gallery.addEventListener('click', handleGalleryClick);
  elements.shareButton.addEventListener('click', handleShare);
  elements.copyLinkButton.addEventListener('click', copyCurrentUrl);
  elements.resetButton.addEventListener('click', resetFilters);
  elements.openPreviewButton.addEventListener('click', handlePreviewOpen);
  elements.lightbox.addEventListener('click', handleLightboxClick);
  elements.lightboxPrev.addEventListener('click', () => goToLightboxOffset(-1));
  elements.lightboxNext.addEventListener('click', () => goToLightboxOffset(1));
  elements.currentUrlField.addEventListener('focus', handleCurrentUrlInteraction);
  elements.currentUrlField.addEventListener('click', handleCurrentUrlInteraction);
  elements.gallery.addEventListener('error', handleImageError, true);
  elements.previewImage.addEventListener('error', handleImageError);
  elements.lightboxImage.addEventListener('error', handleImageError);
  document.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('popstate', handlePopState);
}

init();
