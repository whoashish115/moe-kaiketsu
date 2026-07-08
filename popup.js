const $ = (s) => document.querySelector(s);

let settings = { provider: 'waifu', tags: '', exclude: '', orientation: '', size: 'medium', favorites: [], credentials: {} };
let providerList = [];

function pushToActiveTab(resync) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_CHANGED', settings, resync }, () => void chrome.runtime.lastError);
    }
  });
}

function populateProviders(cb) {
  chrome.runtime.sendMessage({ type: 'GET_PROVIDERS' }, (res) => {
    const select = $('#provider-select');
    select.innerHTML = '';
    providerList = (res && res.ok && res.providers && res.providers.length)
      ? res.providers
      : [{ key: 'waifu', label: 'waifu.im', defaultTags: 'waifu', tagSuggestions: [], maxTags: 4, supportsExclude: true, supportsOrientation: true, authFields: [] }];
    providerList.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.key;
      opt.textContent = p.label;
      select.appendChild(opt);
    });
    if (cb) cb();
  });
}

function currentProvider() {
  return providerList.find(p => p.key === settings.provider) || providerList[0];
}

function applyProviderUI(resetTagsIfEmpty) {
  const provider = currentProvider();
  if (!provider) return;

  const datalist = $('#tag-suggestions');
  datalist.innerHTML = '';
  (provider.tagSuggestions || []).forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    datalist.appendChild(opt);
  });

  $('#tag-cap-hint').textContent = provider.maxTags
    ? `(up to ${provider.maxTags} tag${provider.maxTags === 1 ? '' : 's'}, this source's own API limit)`
    : '';

  $('#exclude-field').style.display = provider.supportsExclude ? '' : 'none';
  $('#orientation-field').style.display = provider.supportsOrientation ? '' : 'none';

  if (resetTagsIfEmpty && !settings.tags) {
    settings.tags = provider.defaultTags || '';
    $('#tag-input').value = settings.tags;
  }

  renderCredentialFields();
}

function renderCredentialFields() {
  const provider = currentProvider();
  const container = $('#credentials-container');
  container.innerHTML = '';
  if (!provider) return;

  const fields = provider.authFields || [];
  if (!fields.length) {
    const none = document.createElement('p');
    none.className = 'hint';
    none.style.margin = '0';
    none.textContent = 'This source has no account/API key option.';
    container.appendChild(none);
    return;
  }

  settings.credentials = settings.credentials || {};
  const providerCreds = settings.credentials[provider.key] || {};

  fields.forEach((f) => {
    const label = document.createElement('label');
    label.className = 'field';

    const span = document.createElement('span');
    span.textContent = f.label;
    label.appendChild(span);

    const input = document.createElement('input');
    input.type = f.secret ? 'password' : 'text';
    input.placeholder = f.placeholder || '';
    input.value = providerCreds[f.key] || '';
    input.autocomplete = 'off';
    input.addEventListener('change', (e) => {
      settings.credentials = settings.credentials || {};
      settings.credentials[provider.key] = settings.credentials[provider.key] || {};
      settings.credentials[provider.key][f.key] = e.target.value;
      chrome.storage.local.set({ moeKaiketsuSettings: settings });
    });
    label.appendChild(input);
    container.appendChild(label);
  });
}

function updateFavCount() {
  $('#fav-count').textContent = (settings.favorites || []).length;
}

populateProviders(() => {
  chrome.storage.local.get(['moeKaiketsuEnabled', 'moeKaiketsuSettings'], (res) => {
    $('#enable-toggle').checked = res.moeKaiketsuEnabled !== false;
    if (res.moeKaiketsuSettings) settings = Object.assign(settings, res.moeKaiketsuSettings);
    settings.credentials = settings.credentials || {};

    $('#provider-select').value = settings.provider || 'waifu';
    applyProviderUI(false);

    if (!settings.tags) {
      const provider = currentProvider();
      settings.tags = (provider && provider.defaultTags) || '';
    }

    $('#tag-input').value = settings.tags || '';
    $('#exclude-input').value = settings.exclude || '';
    $('#orientation-select').value = settings.orientation || '';
    $('#size-select').value = settings.size;
    updateFavCount();
  });
});

$('#enable-toggle').addEventListener('change', (e) => {
  const enabled = e.target.checked;
  chrome.storage.local.set({ moeKaiketsuEnabled: enabled });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_WIDGET', enabled }, () => void chrome.runtime.lastError);
    }
  });
});

$('#provider-select').addEventListener('change', (e) => {
  settings.provider = e.target.value;
  applyProviderUI(true);
  chrome.storage.local.set({ moeKaiketsuSettings: settings });
  pushToActiveTab(true);
});

$('#tag-input').addEventListener('change', (e) => {
  settings.tags = e.target.value;
  chrome.storage.local.set({ moeKaiketsuSettings: settings });
  pushToActiveTab(true);
});

$('#exclude-input').addEventListener('change', (e) => {
  settings.exclude = e.target.value;
  chrome.storage.local.set({ moeKaiketsuSettings: settings });
  pushToActiveTab(true);
});

$('#orientation-select').addEventListener('change', (e) => {
  settings.orientation = e.target.value;
  chrome.storage.local.set({ moeKaiketsuSettings: settings });
  pushToActiveTab(true);
});

$('#size-select').addEventListener('change', (e) => {
  settings.size = e.target.value;
  chrome.storage.local.set({ moeKaiketsuSettings: settings });
  pushToActiveTab(false);
});

$('#view-fav-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('favorites.html') });
});

$('#clear-fav-btn').addEventListener('click', () => {
  settings.favorites = [];
  chrome.storage.local.set({ moeKaiketsuSettings: settings }, updateFavCount);
});
