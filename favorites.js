const $ = (s) => document.querySelector(s);

let favorites = [];
let bannerFavorite = null;

function load() {
  chrome.storage.local.get(['moeKaiketsuSettings'], (res) => {
    const settings = res.moeKaiketsuSettings || {};
    favorites = settings.favorites || [];
    bannerFavorite = settings.bannerFavorite || null;
    if (bannerFavorite && !favorites.some(f => f.id === bannerFavorite.id && f.source === bannerFavorite.source)) {
      bannerFavorite = null;
    }
    populateSourceFilter();
    renderBanner();
    render();
  });
}

function save(cb) {
  chrome.storage.local.get(['moeKaiketsuSettings'], (res) => {
    const settings = res.moeKaiketsuSettings || {};
    settings.favorites = favorites;
    settings.bannerFavorite = bannerFavorite;
    chrome.storage.local.set({ moeKaiketsuSettings: settings }, cb);
  });
}

function populateSourceFilter() {
  const select = $('#source-filter');
  const current = select.value;
  const sources = Array.from(new Set(favorites.map(f => f.source))).sort();
  select.innerHTML = '<option value="">All sources</option>';
  sources.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });
  if (sources.includes(current)) select.value = current;
}

function matchesFilters(fav) {
  const query = $('#search-input').value.trim().toLowerCase();
  const source = $('#source-filter').value;
  if (source && fav.source !== source) return false;
  if (query) {
    const haystack = `${fav.problemTitle || ''} ${fav.problemId || ''}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

function isBanner(fav) {
  return !!bannerFavorite && bannerFavorite.id === fav.id && bannerFavorite.source === fav.source;
}

function renderBanner() {
  const banner = $('#banner');
  if (!bannerFavorite) {
    banner.classList.add('hidden');
    return;
  }
  $('#banner-img').src = bannerFavorite.previewUrl || bannerFavorite.url;
  $('#banner-title').textContent = bannerFavorite.problemTitle || bannerFavorite.problemId || '';
  banner.classList.remove('hidden');
}

function setBanner(fav) {
  bannerFavorite = isBanner(fav) ? null : {
    id: fav.id,
    source: fav.source,
    url: fav.url,
    previewUrl: fav.previewUrl,
    problemTitle: fav.problemTitle,
    problemId: fav.problemId
  };
  save(() => {
    renderBanner();
    render();
  });
}

function render() {
  const grid = $('#grid');
  const empty = $('#empty-state');
  $('#count-badge').textContent = favorites.length;

  const visible = favorites.filter(matchesFilters);
  grid.innerHTML = '';

  if (!favorites.length) {
    empty.textContent = 'No favorites yet. Tap the star on any image on a problem page to save it here.';
    empty.classList.remove('hidden');
    return;
  }
  if (!visible.length) {
    empty.textContent = 'No favorites match your search or filter.';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  visible.forEach((fav) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.title = 'Open image + ' + (fav.problemTitle || fav.problemId || 'problem');

    const img = document.createElement('img');
    img.src = fav.previewUrl || fav.url;
    img.alt = fav.problemTitle || fav.problemId || 'favorite image';
    card.appendChild(img);

    const sourceTag = document.createElement('div');
    sourceTag.className = 'source-tag';
    sourceTag.textContent = fav.source || '';
    card.appendChild(sourceTag);

    const topActions = document.createElement('div');
    topActions.className = 'top-actions';

    const flagBtn = document.createElement('button');
    flagBtn.className = 'icon-btn flag-btn' + (isBanner(fav) ? ' active' : '');
    flagBtn.textContent = isBanner(fav) ? '⚑' : '⚐';
    flagBtn.title = isBanner(fav) ? 'Remove as banner' : 'Set as banner';
    flagBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setBanner(fav);
    });
    topActions.appendChild(flagBtn);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'icon-btn remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove from favorites';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasBanner = isBanner(fav);
      favorites = favorites.filter(f => !(f.id === fav.id && f.source === fav.source));
      if (wasBanner) bannerFavorite = null;
      save(() => {
        populateSourceFilter();
        renderBanner();
        render();
      });
    });
    topActions.appendChild(removeBtn);

    card.appendChild(topActions);

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = fav.problemTitle || fav.problemId || '';
    card.appendChild(label);

    card.addEventListener('click', () => {
      if (fav.url) chrome.tabs.create({ url: fav.url });
      if (fav.problemUrl) chrome.tabs.create({ url: fav.problemUrl });
    });

    grid.appendChild(card);
  });
}

$('#search-input').addEventListener('input', render);
$('#source-filter').addEventListener('change', render);

$('#clear-all-btn').addEventListener('click', () => {
  if (!favorites.length) return;
  if (!confirm('Remove all ' + favorites.length + ' favorites? This cannot be undone.')) return;
  favorites = [];
  bannerFavorite = null;
  save(() => {
    populateSourceFilter();
    renderBanner();
    render();
  });
});

$('#banner-clear-btn').addEventListener('click', () => {
  bannerFavorite = null;
  save(() => renderBanner());
});

load();
