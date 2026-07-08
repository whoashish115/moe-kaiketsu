
async function safeJson(res, label) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${label}: non-JSON response (status ${res.status}), ${text.slice(0, 120)}`);
  }
}

function parseTags(raw, maxTags) {
  if (!raw) return [];
  const seen = new Set();
  const out = [];
  for (const t of raw.split(/[\s,]+/)) {
    const trimmed = t.trim();
    if (!trimmed) continue;
    if (/^-?rating:/i.test(trimmed)) continue;
    const clean = trimmed.replace(/[^a-zA-Z0-9_\-():]/g, '');
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    out.push(clean);
    if (out.length >= maxTags) break;
  }
  return out;
}

function b64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

const BOORU_TAG_SUGGESTIONS = [
  '1girl', 'solo', 'long_hair', 'short_hair', 'smile', 'blush',
  'school_uniform', 'looking_at_viewer', 'outdoors', 'flowers',
  'twintails', 'ponytail', 'cat_ears', 'ribbon', 'hat', 'glasses',
  'sitting', 'standing', 'sky', 'city', 'night', 'winter', 'summer',
  'dress', 'skirt', 'jacket', 'headphones', 'book', 'food', 'animal_ears'
];

const WAIFU_TAG_SUGGESTIONS = [
  'waifu', 'maid', 'uniform', 'selfies',
  'marin-kitagawa', 'mori-calliope', 'raiden-shogun', 'kamisato-ayaka'
];

const PROVIDERS = {
  waifu: {
    label: 'waifu.im',
    defaultTags: 'waifu',
    tagSuggestions: WAIFU_TAG_SUGGESTIONS,
    maxTags: 4,
    supportsExclude: true,
    supportsOrientation: true,
    authFields: [
      { key: 'apiKey', label: 'API key', placeholder: 'waifu.im token (optional)', secret: true }
    ],
    async fetch(query, limit, creds) {
      const included = parseTags(query.tags, 4);
      const excluded = parseTags(query.exclude, 4);
      const params = new URLSearchParams();
      params.set('IsNsfw', 'False');
      included.forEach(t => params.append('IncludedTags', t));
      excluded.forEach(t => params.append('ExcludedTags', t));
      if (query.orientation) params.set('Orientation', query.orientation);
      params.set('PageSize', String(limit));
      params.set('Page', '1');
      const headers = {};
      if (creds && creds.apiKey) headers['Authorization'] = `Bearer ${creds.apiKey}`;
      const res = await fetch(`https://api.waifu.im/images?${params}`, { headers });
      if (!res.ok) throw new Error('waifu.im request failed: ' + res.status);
      const data = await safeJson(res, 'waifu.im');
      const list = Array.isArray(data.items) ? data.items
        : Array.isArray(data.images) ? data.images
        : Array.isArray(data) ? data
        : [];
      return list
        .filter(p => p && (p.isNsfw === false || p.is_nsfw === false) && !!p.url)
        .map(p => ({
          id: String(p.id ?? p.image_id),
          source: 'waifu',
          url: p.url,
          previewUrl: p.url,
          width: p.width,
          height: p.height
        }));
    }
  },

  safebooru: {
    label: 'Safebooru',
    defaultTags: '1girl',
    tagSuggestions: BOORU_TAG_SUGGESTIONS,
    maxTags: 6,
    supportsExclude: true,
    authFields: [
      { key: 'userId', label: 'User ID', placeholder: 'Safebooru user id (optional)' },
      { key: 'apiKey', label: 'API key', placeholder: 'Safebooru API key (optional)', secret: true }
    ],
    async fetch(query, limit, creds) {
      const included = parseTags(query.tags, 6);
      const excluded = parseTags(query.exclude, 6).map(t => `-${t}`);
      const tags = [...included, ...excluded].join(' ');
      const params = new URLSearchParams();
      params.set('page', 'dapi');
      params.set('s', 'post');
      params.set('q', 'index');
      params.set('json', '1');
      if (tags) params.set('tags', tags);
      params.set('limit', String(limit));
      if (creds && creds.userId) params.set('user_id', creds.userId);
      if (creds && creds.apiKey) params.set('api_key', creds.apiKey);
      const res = await fetch(`https://safebooru.org/index.php?${params}`);
      if (!res.ok) throw new Error('Safebooru request failed: ' + res.status);
      const data = await safeJson(res, 'Safebooru');
      const list = Array.isArray(data) ? data : [];
      return list
        .filter(p => p && p.directory && p.image)
        .map(p => {
          const url = `https://safebooru.org/images/${p.directory}/${p.image}`;
          return {
            id: String(p.id),
            source: 'safebooru',
            url,
            previewUrl: url,
            width: p.width,
            height: p.height
          };
        });
    }
  },

  danbooru: {
    label: 'Danbooru',
    defaultTags: '1girl',
    tagSuggestions: BOORU_TAG_SUGGESTIONS,
    maxTags: 1,
    supportsExclude: false,
    authFields: [
      { key: 'username', label: 'Username', placeholder: 'Danbooru username (optional)' },
      { key: 'apiKey', label: 'API key', placeholder: 'Danbooru API key (optional)', secret: true }
    ],
    async fetch(query, limit, creds) {
      const userTags = parseTags(query.tags, 1);
      const tagString = [...userTags, 'rating:general'].join(' ');
      const params = new URLSearchParams();
      params.set('tags', tagString);
      params.set('limit', String(limit));
      const headers = {};
      if (creds && creds.username && creds.apiKey) {
        headers['Authorization'] = 'Basic ' + b64(`${creds.username}:${creds.apiKey}`);
      }
      const res = await fetch(`https://danbooru.donmai.us/posts.json?${params}`, { headers });
      if (!res.ok) throw new Error('Danbooru request failed: ' + res.status);
      const list = await safeJson(res, 'Danbooru');
      if (!Array.isArray(list)) throw new Error('Danbooru: unexpected response shape');
      const isGeneral = (r) => r === 'g' || r === 'general';
      return list
        .filter(p => p && isGeneral(p.rating) && (p.large_file_url || p.file_url) && !p.is_deleted && !p.is_banned)
        .map(p => ({
          id: String(p.id),
          source: 'danbooru',
          url: p.file_url || p.large_file_url,
          previewUrl: p.large_file_url || p.file_url,
          width: p.image_width,
          height: p.image_height
        }));
    }
  },

  yandere: {
    label: 'Yande.re',
    defaultTags: '',
    tagSuggestions: BOORU_TAG_SUGGESTIONS,
    maxTags: 1,
    supportsExclude: false,
    authFields: [
      { key: 'username', label: 'Username', placeholder: 'Yande.re username (optional)' },
      { key: 'apiKey', label: 'API key', placeholder: 'Yande.re API key (optional)', secret: true }
    ],
    async fetch(query, limit, creds) {
      const userTags = parseTags(query.tags, 1);
      const tagString = [...userTags, 'rating:safe'].join(' ');
      const params = new URLSearchParams();
      params.set('tags', tagString);
      params.set('limit', String(limit));
      const headers = {};
      if (creds && creds.username && creds.apiKey) {
        headers['Authorization'] = 'Basic ' + b64(`${creds.username}:${creds.apiKey}`);
      }
      const res = await fetch(`https://yande.re/post.json?${params}`, { headers });
      if (!res.ok) throw new Error('Yande.re request failed: ' + res.status);
      const list = await safeJson(res, 'Yande.re');
      if (!Array.isArray(list)) throw new Error('Yande.re: unexpected response shape (possible bot-check page)');
      const isSafe = (r) => r === 's' || r === 'safe';
      return list
        .filter(p => p && isSafe(p.rating) && p.file_url)
        .map(p => ({
          id: String(p.id),
          source: 'yandere',
          url: p.file_url,
          previewUrl: p.sample_url || p.file_url,
          width: p.width,
          height: p.height
        }));
    }
  }
};

async function fetchPool(providerKey, query, limit, creds) {
  const provider = PROVIDERS[providerKey] || PROVIDERS.waifu;
  const capped = Math.min(limit || 30, 30);
  return provider.fetch(query || {}, capped, creds || {});
}

function getStoredCredentials(providerKey) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['moeKaiketsuSettings'], (res) => {
      const settings = res.moeKaiketsuSettings || {};
      const creds = (settings.credentials && settings.credentials[providerKey]) || {};
      resolve(creds);
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'FETCH_POOL') {
    getStoredCredentials(msg.provider)
      .then((creds) => fetchPool(msg.provider, msg.query, msg.limit, creds))
      .then(pool => sendResponse({ ok: true, pool }))
      .catch(err => {
        console.error('[MoeKaiketsu]', err);
        sendResponse({ ok: false, error: String(err.message || err) });
      });
    return true;
  }
  if (msg.type === 'GET_PROVIDERS') {
    sendResponse({
      ok: true,
      providers: Object.keys(PROVIDERS).map(key => ({
        key,
        label: PROVIDERS[key].label,
        defaultTags: PROVIDERS[key].defaultTags,
        tagSuggestions: PROVIDERS[key].tagSuggestions,
        maxTags: PROVIDERS[key].maxTags,
        supportsExclude: !!PROVIDERS[key].supportsExclude,
        supportsOrientation: !!PROVIDERS[key].supportsOrientation,
        authFields: PROVIDERS[key].authFields || []
      }))
    });
    return true;
  }
});
