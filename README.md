# Tabby

An open source tab manager for Chrome (and Firefox). Tabby replaces your new tab page with your saved tabs, organised into spaces and collections. Drag an open tab onto a collection to save it.

Local first. No account. Your data stays in your browser until you choose to sync it.

## Features

- Spaces, each holding collections of saved tabs
- Drag open tabs from the right panel into any collection, or drag cards between collections
- Save the whole window as a collection in one click
- Notes on each saved tab
- Search across every space (press `/`)
- Open a collection in tabs or in a new window
- Export a backup, import it back (merges rather than overwrites)
- Import from a Toby JSON export

## Development

```bash
bun install
bun run dev        # opens Chrome with the extension loaded and hot reload
bun run build      # production build in .output/chrome-mv3
bun run zip        # zip for the Chrome Web Store
```

To load a build by hand: open `chrome://extensions`, turn on Developer mode, click "Load unpacked" and choose `.output/chrome-mv3`.

## Stack

- [WXT](https://wxt.dev) (Manifest V3, Vite)
- React 19, Tailwind 4, lucide icons, dnd-kit
- [TinyBase](https://tinybase.org) `MergeableStore`, persisted to `chrome.storage.local`

### Why a MergeableStore

Every cell carries a timestamp from the first write, so sync between devices can be added later by attaching a TinyBase synchronizer (for example a WebSocket to a Cloudflare Durable Object) with no migration of existing data. `chrome.storage.onChanged` also keeps several open new tab pages in step with each other.

## Data model

| table         | cells                                        |
| ------------- | -------------------------------------------- |
| `spaces`      | name, color, order                           |
| `collections` | spaceId, name, order, collapsed              |
| `links`       | collectionId, url, title, note, order        |

Values: `device` (minted once per browser, for sync later), `activeSpace`.

## License

MIT
