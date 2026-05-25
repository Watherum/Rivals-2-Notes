# RoA2 Notes

A personal note-taking app for Rivals of Aether 2. Track notes on every character, your mains, and general game knowledge — with support for image and video attachments. Everything is saved as plain files on your computer.

---

## Requirements

- [Node.js](https://nodejs.org/) (v18 or later)

---

## Setup

Run this once after cloning or downloading the project:

```
npm install
```

---

## Running the App

### Portable .exe (recommended for day-to-day use)

Download `RoA2 Notes.exe` and place it in any folder. Double-click to launch — no terminal needed. The app starts a local server in the background and opens in your browser automatically. A system tray icon lets you reopen the app or quit it.

All data (`notes/`, `attachments/`, `settings.json`) is stored in the same folder as the `.exe`, so you can move the exe anywhere and your data travels with it.

> If you want to share data with a terminal-based setup, place the exe in your project root.

### Development

```
npm run dev
```

Starts the backend server and the Vite dev server together. Open `http://localhost:5173` in your browser. To access from other devices on the same network (e.g. your phone), use the **Network** URL printed in the terminal.

### Production (terminal)

```
npm run start
```

Builds the frontend and starts the Express server serving everything on a single port. Open `http://localhost:3001` in your browser.

To access from your phone on the same WiFi, find your PC's local IP address and open `http://[your-PC-IP]:3001`.

### Building the .exe

```
npm run electron:build
```

Outputs `dist/RoA2 Notes <version>.exe`. Move it wherever you want and double-click to run.

> If port 3001 is already in use, the server will automatically try the next available port.

---

## Features

### Roster
The home screen shows all 16 characters with their portraits. Click any character to open their notes page.

### Character Notes
Each character page has:
- A notes area for anything about **fighting that character** — weaknesses, punishes, what to watch out for
- An **attachments section** — upload images or video clips relevant to that character
- **Frame Data** button — opens the character's data page on dragdown.wiki
- **Full Wiki Page** button — opens the character's full wiki page

Notes auto-save 500ms after you stop typing.

### My Mains
Select your main characters from a collapsible grid (with stock icons). Each selected main gets its own notes section for goals, habits to build, and things to work on — **separate from the roster notes** — plus its own attachment section. Quick links to the wiki page and frame data are included in each panel.

### Game Notes
A single full-page notes area for anything game-wide — general strategy, tournament prep, observations, etc. Supports attachments. Saved to `notes/game-general.txt`.

### Gallery
A master gallery showing every uploaded attachment across all pages, grouped by source (e.g. "Zetterburn — Character Notes", "Orcane — My Mains", "Game Notes"). Click any image to open it in a lightbox; click any video to play it inline. Attachments can also be deleted from here.

### Resources
Quick links to useful external sites:
- **Dragdown Wiki** — RoA2 wiki on dragdown.wiki
- **Rivals 2 VODs** — match VOD browser
- **Rivals 2 Discords** — community and character Discord servers
- **Rivals Play Network** — find local and online tournaments
- **Rivals 2 Nolt Board** — submit and vote on feedback
- **Watherum's Discord** — community Discord

### Manage Data
- **Export** — downloads all notes and attachments as a single `roa2-notes-backup.zip` file
- **Import** — restores notes and attachments from a `.zip` backup, or notes only from a legacy `.json` backup
- **Attachment Storage** — set a maximum size limit (in GB) for the attachments directory. Uploads that would exceed the limit are rejected. Leave blank for no limit.

---

## Where Data Is Saved

### Notes
Stored as plain text files in the `notes/` folder:

| File | Contents |
|---|---|
| `notes/zetterburn.txt` | Notes on fighting Zetterburn |
| `notes/main-zetterburn.txt` | Your Zetterburn mains notes |
| `notes/game-general.txt` | Game-wide notes |
| `notes/mains.json` | Your selected main characters |

You can open, edit, or back these files up directly.

### Attachments
Stored in the `attachments/` folder, organized by source:

| Folder | Contents |
|---|---|
| `attachments/character/{characterId}/` | Images/videos uploaded on a character's notes page |
| `attachments/mains/{characterId}/` | Images/videos uploaded on a main's panel |
| `attachments/general/` | Images/videos uploaded on the Game Notes page |

---

## Backup & Restore

### Export
Go to **Manage Data → Download Backup**. This creates a `roa2-notes-backup.zip` containing:
- `notes-export.json` — all your text notes
- `attachments/` — all uploaded images and videos

### Import
Go to **Manage Data → Choose Backup File** and select either:
- A `.zip` file (restores notes + attachments)
- A legacy `.json` file (restores notes only)

Existing data with matching keys will be overwritten.

---

## Installing as a Desktop / Mobile App (PWA)

The app can be installed to your home screen or taskbar so it opens like a native app.

**Desktop (Chrome / Edge):**
1. Run `npm run start`
2. Open `http://localhost:3001`
3. Click the install icon in the browser address bar

**Mobile:**
1. Open the app URL on your phone's browser
2. Tap **Share → Add to Home Screen** (iOS) or the install option in the browser menu (Android)

> Note: The PWA service worker only activates on production builds. During `npm run dev` the install prompt won't appear.

---

## Adding New Characters

Edit `src/data/characters.js` and add an entry to the `CHARACTERS` array:

```js
{ id: 'newchar', name: 'New Char', wikiSlug: 'New_Char', portraitUrl: '/portraits/newchar.png', stockUrl: '/stocks/newchar.png' }
```

- `id` — lowercase, no spaces; used as the filename for saved notes and the attachment folder name
- `wikiSlug` — matches the character's URL slug on dragdown.wiki
- `portraitUrl` — place a portrait image in `public/portraits/` and reference it here, or set to `null`
- `stockUrl` — place a stock icon in `public/stocks/` and reference it here, or set to `null`
