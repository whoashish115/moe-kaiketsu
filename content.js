
(function () {
  const DEFAULT_SETTINGS = {
    provider: 'waifu',
    tags: '',
    exclude: '',
    orientation: '',
    size: 'medium',
    favorites: []
  };

  const SIZE_PX = { small: 220, medium: 340, large: 480 };

  let settings = Object.assign({}, DEFAULT_SETTINGS);
  let enabled = true;
  let hostEl = null;
  let shadow = null;

  function getProblemId() {
    const m = location.pathname.match(/^\/problemset\/problem\/(\d+)\/(\w+)\/?$/i);
    if (!m) return null;
    return `problemset/${m[1]}/${m[2]}`;
  }

  function isEligiblePage() {
    return /^\/problemset\/problem\/\d+\/\w+\/?$/i.test(location.pathname);
  }

  function findInsertionPoint() {
    return document.querySelector('.problem-statement')
      || document.querySelector('#pageContent .roundbox')
      || document.querySelector('#pageContent');
  }

  function hashToIndex(str, mod) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return mod > 0 ? h % mod : 0;
  }

  function cacheKey(problemId) {
    return [
      'moeKaiketsuCache',
      problemId,
      settings.provider,
      (settings.tags || '').trim(),
      (settings.exclude || '').trim(),
      (settings.orientation || '').trim()
    ].join('|');
  }

  function getFromCache(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (res) => resolve(res[key] || null));
    });
  }

  function saveToCache(key, value) {
    chrome.storage.local.set({ [key]: value });
  }

  function clearCache(key) {
    chrome.storage.local.remove(key);
  }

  function isFavorited(img) {
    return (settings.favorites || []).some(f => f.id === img.id && f.source === img.source);
  }

  function toggleFavorite(img, problemId, starBtn) {
    const already = isFavorited(img);
    if (already) {
      settings.favorites = settings.favorites.filter(f => !(f.id === img.id && f.source === img.source));
    } else {
      settings.favorites = (settings.favorites || []).concat([{
        id: img.id,
        source: img.source,
        url: img.url,
        previewUrl: img.previewUrl,
        problemId,
        problemUrl: location.href,
        problemTitle: document.title.replace(/\s*-\s*Codeforces\s*$/i, '').trim()
      }]);
    }
    chrome.storage.local.set({ moeKaiketsuSettings: settings });
    starBtn.textContent = isFavorited(img) ? '★' : '☆';
  }

  function classifyError(e) {
    if (e && e.code === 'EMPTY_POOL') return 'No image found';
    const msg = String((e && e.message) || e || '');
    if (/\b429\b/.test(msg) || /rate.?limit/i.test(msg)) return 'Rate limit hit';
    return 'Image unavailable';
  }

  function baseStyle() {
    return `
      .wrap { display: flex; justify-content: center; margin: 14px 0; }
      .frame {
        position: relative;
        max-width: ${SIZE_PX[settings.size] || SIZE_PX.medium}px;
        max-height: ${SIZE_PX[settings.size] || SIZE_PX.medium}px;
        border-radius: 10px;
        overflow: hidden;
        background: transparent;
      }
      img { display: block; width: 100%; height: 100%; object-fit: contain; }
      .star {
        position: absolute; top: 6px; right: 6px;
        width: 26px; height: 26px; border: none; border-radius: 6px;
        background: rgba(0,0,0,.55); color: #fff; font-size: 15px;
        cursor: pointer; line-height: 1;
      }
      .star:hover { background: rgba(0,0,0,.75); }
      .error-box {
        min-width: 200px;
        max-width: ${SIZE_PX[settings.size] || SIZE_PX.medium}px;
        color: #9a9a9a;
        font-size: 12px;
        text-align: center;
        font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
      }
    `;
  }

  function renderImage(entry, problemId, key, triesCount) {
    if (!hostEl) return;
    triesCount = triesCount || 0;
    shadow.innerHTML = '';

    const style = document.createElement('style');
    style.textContent = baseStyle();
    shadow.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    const frame = document.createElement('div');
    frame.className = 'frame';

    const current = entry.pool[entry.index];

    const el = document.createElement('img');
    el.src = current.previewUrl || current.url;
    el.alt = 'anime image';
    el.addEventListener('error', () => {
      const nextTries = triesCount + 1;
      if (nextTries >= entry.pool.length) {
        clearCache(key);
        renderErrorBox('Image unavailable');
        return;
      }
      entry.index = (entry.index + 1) % entry.pool.length;
      saveToCache(key, entry);
      renderImage(entry, problemId, key, nextTries);
    });
    frame.appendChild(el);

    const star = document.createElement('button');
    star.className = 'star';
    star.textContent = isFavorited(current) ? '★' : '☆';
    star.title = 'Favorite this image';
    star.addEventListener('click', () => toggleFavorite(current, problemId, star));
    frame.appendChild(star);

    wrap.appendChild(frame);
    shadow.appendChild(wrap);
    hostEl.style.display = '';
  }

  function renderErrorBox(message) {
    if (!hostEl) return;
    shadow.innerHTML = '';

    const style = document.createElement('style');
    style.textContent = baseStyle();
    shadow.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    const box = document.createElement('div');
    box.className = 'error-box';
    box.textContent = message;
    wrap.appendChild(box);
    shadow.appendChild(wrap);
    hostEl.style.display = '';
  }

  function ensureHost() {
    if (hostEl) return hostEl;
    const target = findInsertionPoint();
    if (!target || !target.parentNode) return null;
    hostEl = document.createElement('div');
    hostEl.id = 'moe-kaiketsu-host';
    target.parentNode.insertBefore(hostEl, target);
    shadow = hostEl.attachShadow({ mode: 'open' });
    return hostEl;
  }

  function fetchPool() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'FETCH_POOL',
        provider: settings.provider,
        query: { tags: settings.tags, exclude: settings.exclude, orientation: settings.orientation },
        limit: 30
      }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!res || !res.ok) return reject(new Error((res && res.error) || 'fetch failed'));
        resolve(res.pool || []);
      });
    });
  }

  async function resolveImage(problemId, key) {
    const cached = await getFromCache(key);
    if (cached && Array.isArray(cached.pool) && cached.pool.length) return cached;

    const pool = await fetchPool();
    if (!pool.length) {
      const err = new Error('No results for the current tags');
      err.code = 'EMPTY_POOL';
      throw err;
    }
    const index = hashToIndex(problemId, pool.length);
    const entry = { pool, index };
    saveToCache(key, entry);
    return entry;
  }

  async function run() {
    if (!enabled) return;
    const problemId = getProblemId();
    if (!problemId) return;
    const host = ensureHost();
    if (!host) return;
    const key = cacheKey(problemId);
    try {
      const entry = await resolveImage(problemId, key);
      renderImage(entry, problemId, key, 0);
    } catch (e) {
      renderErrorBox(classifyError(e));
      console.warn('[MoeKaiketsu]', e.message || e);
    }
  }

  function teardown() {
    if (hostEl && hostEl.parentNode) hostEl.parentNode.removeChild(hostEl);
    hostEl = null;
    shadow = null;
  }

  function init() {
    chrome.storage.local.get(['moeKaiketsuEnabled', 'moeKaiketsuSettings'], (res) => {
      enabled = res.moeKaiketsuEnabled !== false;
      if (res.moeKaiketsuSettings) settings = Object.assign({}, DEFAULT_SETTINGS, res.moeKaiketsuSettings);
      if (enabled) run();
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE_WIDGET') {
      enabled = !!msg.enabled;
      if (enabled) run();
      else teardown();
    }
    if (msg.type === 'SETTINGS_CHANGED') {
      settings = Object.assign({}, DEFAULT_SETTINGS, msg.settings);
      if (msg.resync) {
        teardown();
        run();
      } else if (hostEl && shadow) {
        const problemId = getProblemId();
        const key = cacheKey(problemId);
        getFromCache(key).then((cached) => {
          if (cached && Array.isArray(cached.pool) && cached.pool.length) {
            renderImage(cached, problemId, key, 0);
          } else {
            run();
          }
        });
      }
    }
  });

  init();
})();
