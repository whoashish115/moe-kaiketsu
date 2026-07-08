# Moe Kaiketsu

![icon](icon128.png)

shows a hand‑picked (but deterministic) anime illustration right above every problem statement. Customise the source, tags, size, and even save your favourites.


## Features

| Area | What you can do |
|------|----------------|
| **Providers** | Choose from waifu.im, Safebooru, Danbooru, or Yande.re - each with its own style and tag catalogue. |
| **Tags** | Type any tags you like (e.g., `1girl smile outdoors`). The extension automatically enforces **safe‑rated** content - no NSFW images ever appear. |
| **Exclude tags** | For waifu.im and Safebooru, you can also add tags you *don’t* want to see. |
| **Orientation** | Filter by landscape or portrait (waifu.im only). |
| **Image size** | Choose Small, Medium, or Large - works across all providers. |
| **Favourites** | Save images you love, view them all in one page, and pick one as a banner. |
| **Enable/disable** | Toggle the widget on/off per tab. |
| **API keys (optional)** | If you hit rate limits, add your own account credentials for higher request caps - stored locally, never shared. |


## How image selection works

- Every Codeforces problem gets a **stable ID** from its URL.
- The extension fetches a batch of up to 30 images matching your current tags and filters.
- It then uses that ID to **deterministically pick one image** - so the same problem always shows the same picture (as long as your settings don’t change).
- The whole batch and the chosen index are **cached locally**. Revisiting a problem is instant - no repeated network calls.
- If the chosen image fails to load (dead link, CDN hiccup), the widget automatically tries the next image in the cache. Only if **every** image in the batch is dead will it show an error and clear the cache for a fresh fetch on next reload.
- If nothing loads at all, you’ll see a small grey box with a clear reason:
  - *“No image found”* - your tags returned zero results.
  - *“Rate limit hit”* - you’ve exceeded the provider’s anonymous limit (add an API key to fix).
  - *“Image unavailable”* - network issues or all images failed.


## Providers & settings explained

### waifu.im
- Works well with general tags like `waifu`, `maid`, `knight`.
- Supports **excluded tags** and **orientation** filters.
- API key field - enter your own key to raise the rate limit.

### Safebooru
- A huge, long‑standing booru with a focus on safe content.
- Supports **excluded tags** (using `-tag` syntax behind the scenes).
- Account fields - User ID + API key.

### Danbooru
- One of the largest anime image databases.
- Tags are very precise - try `1girl` or `solo` as a starting point.
- Account fields - Username + API key (HTTP Basic auth).

### Yande.re
- Known for high‑quality, often wallpaper‑ready images.
- Default tag is left empty so it returns results immediately - add your own tag to narrow it down.
- Account fields - Username + API key (best‑effort; falls back to anonymous if auth fails).

**Important:** All providers are forced to return only **safe‑rated** content. Any tag you type that tries to override this (e.g., `rating:explicit`) is automatically stripped out before the request is sent.


## Installation (unpacked)

1. Open your browser’s extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Enable **Developer mode** (toggle in the top‑right corner).
3. Click **Load unpacked** and select the folder containing this extension.
4. That’s it - visit any Codeforces problem page, e.g.  
   `https://codeforces.com/problemset/problem/4/A`  
   and the image will appear centred just above the problem statement.


## Usage (popup)

Click the extension icon in your browser toolbar to open the popup. There you can:

- Switch providers and edit tags freely.
- Add excluded tags (where supported).
- Change image size or orientation.
- Enable / disable the widget on the current tab.
- Manage your favourites - save the current image, browse saved ones, or set one as a banner.

All changes are saved automatically.


## Troubleshooting

| Issue | Likely fix |
|-------|------------|
| **No image appears** | Your tags might be too specific or not recognised by the provider. Try broader tags (e.g., just `1girl` for boorus, or `waifu` for waifu.im). |
| **“Rate limit hit”** | You’ve used up the anonymous quota. Open the popup, scroll to the Account section for your provider, and add your own API key / credentials. |
| **Image stays the same** | The pick is deterministic per problem. To change it, edit your tags or switch providers - the cache will update automatically. |
| **Image looks too small** | Change the size setting to **Large** - this uses each provider’s best available sample image (e.g., Danbooru now serves its high‑res `large_file_url`). |
| **Favourites page is empty** | You need to manually save images via the popup - they don’t auto‑save. |

For deeper issues (e.g., API errors, network logs), open `chrome://extensions`, find this extension, and click the **service worker** link - all backend logs are printed there.


## Privacy & storage

- All your settings, tags, API keys, cached images, and favourites are stored **locally** in your browser’s `chrome.storage.local`.
- Nothing is sent anywhere except:
  - Direct requests to the provider’s public API (with your key attached, if you added one).
- No analytics, no tracking, no external servers - everything stays on your machine.


## License

MIT - free to use, modify, and distribute.


## Author

Ashish Kumar

