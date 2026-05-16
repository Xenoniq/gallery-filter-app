function sanitizeQuery(rawQuery) {
  return String(rawQuery ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
}

export function parseStateFromUrl({ validCategoryKeys, validTagKeys, validSortKeys }) {
  const params = new URLSearchParams(window.location.search);

  const rawCategory = params.get('category');
  const category = rawCategory && validCategoryKeys.has(rawCategory) ? rawCategory : 'all';

  const rawTags = params.get('tags') ?? '';
  const tags = [
    ...new Set(
      rawTags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => validTagKeys.has(tag)),
    ),
  ].sort();

  const rawSort = params.get('sort');
  const sort = rawSort && validSortKeys.has(rawSort) ? rawSort : 'featured';

  const query = sanitizeQuery(params.get('q') ?? '');

  return { category, tags, sort, query };
}

export function writeStateToUrl({ category, tags, sort, query }) {
  const params = new URLSearchParams();

  if (category && category !== 'all') {
    params.set('category', category);
  }

  if (Array.isArray(tags) && tags.length) {
    params.set('tags', [...tags].sort().join(','));
  }

  if (sort && sort !== 'featured') {
    params.set('sort', sort);
  }

  const normalizedQuery = sanitizeQuery(query);
  if (normalizedQuery) {
    params.set('q', normalizedQuery);
  }

  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

export function buildShareUrl() {
  return window.location.href;
}
