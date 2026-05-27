# RoA2 Notes

A note-taking app for Rivals of Aether 2. Track notes on every character, your mains, and general game knowledge — with rich text formatting, image and video attachments, and multi-account support. Everything is saved as plain files on your computer.

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

All data (`notes/`, `attachments/`, `users.json`) is stored in the same folder as the `.exe`, so you can move the exe anywhere and your data travels with it.

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

### Accessing Your Notes Anywhere (Port Forwarding)

If you want to access your notes from outside your home network — from your phone on mobile data, a friend's house, or anywhere with internet — you can set up port forwarding on your router.

1. Run the app in production mode (`npm run start`) on your PC so it's serving on port `3001`
2. Find your PC's local IP address (e.g. `192.168.1.x`) — shown in the terminal or via `ipconfig` on Windows
3. Log in to your router's admin page (usually `192.168.1.1` or `192.168.0.1` in your browser) and forward **external port 3001** to your PC's local IP on **internal port 3001**
4. Find your public IP at a site like [whatismyip.com](https://www.whatismyip.com) and open `http://[your-public-IP]:3001` from any device

For step-by-step instructions specific to your router model, search **"how to port forward [your router brand/model]"** — the steps vary by manufacturer.

> **Security note:** Port forwarding exposes the app to the internet. Each person accessing it remotely should have their own account. Only do this on a trusted network, and close the port when you're not using it remotely.

### Building the .exe

```
npm run electron:build
```

Outputs `dist/RoA2 Notes <version>.exe`. Move it wherever you want and double-click to run.

> If port 3001 is already in use, the server will automatically try the next available port.

---

## Accounts

The app requires an account to use. On first launch you'll be taken to the sign-up screen.

- **Sign up** — choose a username (2–32 characters: letters, numbers, `-`, `_`) and a password. Enter the password twice to confirm.
- **Sign in** — enter your username and password. Your session is remembered in the browser, so you won't need to sign in again unless you clear browser storage or sign out manually.
- **Sign out** — click **Sign out** in the top navigation bar.
- **Change password** — go to **Manage Data → Change Password**. Enter your current password and your new password twice to confirm.
- **Profile photo** — go to **Manage Data → Profile Photo** to upload a photo (any image format, up to 5 MB). Your photo appears as a circle next to your username in the navigation bar. You can replace or remove it at any time.

Each account's notes and attachments are completely separate. Users can only see and access their own data. Accounts are stored in `users.json` alongside the rest of the app's data.

### Admin Accounts

Admins can manage other users from the **Admin** page (visible in the nav bar for admin accounts only):

- **Set storage limits** — set or clear the attachment storage quota for any user
- **Reset password** — set a new password for any user (useful if they've forgotten theirs). The user can then log in with the new password and change it themselves via Manage Data → Change Password
- **Delete users** — permanently removes a user's account, notes, and all attachments
- **Check for Updates** — check GitHub for a new version. On Windows (packaged `.exe`): downloads the new exe to the same folder; an **Open Folder** button reveals it in Explorer and **Exit App** closes the current version so you can run the new one. On Mac/Linux (source install): downloads the release tarball, extracts it, runs `npm install` and `npm run build` automatically, then **Restart App** relaunches with the new version

To grant admin access, open `users.json` and add `"isAdmin": true` to the user's entry:

```json
{
  "yourUsername": {
    "passwordHash": "...",
    "createdAt": "...",
    "isAdmin": true
  }
}
```

Then sign out and back in — the Admin link will appear in the nav bar.

> **Port forwarding note:** If you expose the app to the internet via port forwarding, each person accessing it needs their own account. See the port forwarding section below.

---

## Features

### Roster
The home screen shows all 16 characters with their portraits in alphabetical order. Click any character to open their notes page.

### Character Notes
Each character page has:
- A notes area for anything about **fighting that character** — weaknesses, punishes, what to watch out for
- An **attachments section** — upload images or video clips relevant to that character
- **Frame Data** button — opens the character's data page on dragdown.wiki
- **Full Wiki Page** button — opens the character's full wiki page
- **Player notes** — if any players in your Player Notes list main this character, their note cards appear at the bottom of the page for quick reference

Notes auto-save 500ms after you stop typing.

### Player Notes
Track notes on specific opponents. Each player entry has:
- A **name** field (editable at any time)
- A **character selector** — pick any number of characters they play; each selected character gets its own separate notes area. If no characters are selected, a single general notes area is shown instead
- Notes auto-save 500ms after you stop typing

When adding a new player, the character selector is visible immediately but stays **grayed out** until a player name is entered — ensuring every entry has a name before any characters are assigned.

Player cards are **collapsible** — click the arrow on the left of the header to expand or collapse. Within a card, each individual character notes section is also collapsible via its own header toggle. On wider screens, cards are shown in a multi-column grid to make use of the extra space.

A **search bar** at the top of the page lets you filter players by name in real time.

Players whose character selections include a given character will appear on that character's notes page under "Players who main [character]", showing the notes specific to that character matchup.

Players are listed on the Player Notes page and can be deleted from there.

### My Mains
Select your main characters from a collapsible grid (with stock icons). Each selected main gets its own notes section for goals, habits to build, and things to work on — **separate from the roster notes** — plus its own attachment section. Quick links to the wiki page and frame data are included in each panel.

### Game Notes
A single full-page notes area for anything game-wide — general strategy, tournament prep, observations, etc. Supports attachments. Saved to `notes/game-general.txt`.

### Rich Text Formatting
All notes areas include a formatting toolbar with:
- **B** — bold
- *I* — italic
- ~~S~~ — strikethrough
- **H1 / H2 / H3** — headings
- **•** — bullet list
- **1.** — numbered list
- **[ ]** — checklist (GitHub Flavored Markdown task list)
- **—** — horizontal rule
- **[url]** — insert a link
- **[img]** — insert an image (by URL)
- **↵** — insert a hard line break

Click a button while text is selected to wrap it, or click with no selection to insert a placeholder. Toggle **Preview** to render the formatted note. Notes are stored as Markdown (with GFM support for strikethrough and task lists), so existing plain-text notes are fully compatible.

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
- **Profile Photo** — upload or remove your profile photo. Appears as a circle next to your username in the nav bar. Accepts any image format, up to 5 MB.
- **Export** — downloads your notes and attachments as a single `roa2-notes-backup.zip` file
- **GitHub Backup** — backs up your notes to a private GitHub Gist using a Personal Access Token. See [GitHub Backup](#github-backup) below.
- **Import** — restores notes and attachments from a `.zip` backup, or notes only from a legacy `.json` backup. Imported notes are **appended** to existing ones (joined with a `---` separator); mains are merged without duplicates; players are matched by name and merged — same-name players have their character lists combined and notes merged rather than creating duplicates
- **Change Password** — update your password after confirming your current one. New password must be at least 6 characters.
- **Attachment Storage** — set a personal size limit (in GB) for your attachments. Uploads that would exceed your limit are rejected. Each user sets their own limit independently. Leave blank for no limit.

### Admin Panel
Admin-only page accessible from the nav bar. Includes all user management tools plus:
- **Reset Password** — set a new temporary password for any user (for forgotten passwords). The user logs in with it and changes it via Manage Data → Change Password.
- **Check for Updates** — check GitHub for the latest version. On Windows (packaged `.exe`): downloads the new exe to the same folder, then shows **Open Folder** to reveal it in Explorer and **Exit App** to close the current version — run the new file to finish updating. On Mac/Linux (source install): downloads the release tarball, extracts it, runs `npm install` and `npm run build` automatically (with live phase progress), then **Restart App** relaunches with the new version. On unrecognised installs: links to the GitHub release page.
- **Search users** — filter the user list by username in real time using the search bar above the table

---

## Where Data Is Saved

### Accounts
Account credentials are stored in `users.json` in the app's data directory. Passwords are hashed with bcrypt and never stored in plain text.

### Notes
Stored as plain text files under `notes/{username}/`:

| File | Contents |
|---|---|
| `notes/alice/zetterburn.txt` | Alice's notes on fighting Zetterburn |
| `notes/alice/main-zetterburn.txt` | Alice's Zetterburn mains notes |
| `notes/alice/game-general.txt` | Alice's game-wide notes |
| `notes/alice/mains.json` | Alice's selected main characters |
| `notes/alice/player-list.json` | Alice's player entries (name, id, characters) |
| `notes/alice/player-notes-{id}.txt` | Alice's general notes on a specific player |
| `notes/alice/player-notes-{id}-{charId}.txt` | Alice's notes on a specific player's character |

Each account's files are fully separated by subfolder. Files placed directly in `notes/` with no username subfolder are ignored.

### Attachments
Stored under `attachments/{username}/`, organized by source:

| Folder | Contents |
|---|---|
| `attachments/alice/character/{characterId}/` | Images/videos uploaded on a character's notes page |
| `attachments/alice/mains/{characterId}/` | Images/videos uploaded on a main's panel |
| `attachments/alice/general/` | Images/videos uploaded on the Game Notes page |
| `attachments/alice/avatar/` | Profile photo |

---

## Backup & Restore

### Export
Go to **Manage Data → Download Backup**. This creates a `roa2-notes-backup.zip` containing only your own notes and attachments:
- `notes-export.json` — all your text notes
- `attachments/` — all your uploaded images and videos

### Import
Go to **Manage Data → Choose Backup File** and select either:
- A `.zip` file (restores notes + attachments)
- A legacy `.json` file (restores notes only)

Imported notes are appended to any existing content using a `---` separator, so nothing is lost. Mains are merged without duplicates. Players are merged by **name** — if an imported player has the same name as an existing one, their character lists are combined and per-character notes are merged rather than creating a duplicate entry. Genuinely new players are added alongside existing ones.

### GitHub Backup

Back up your notes to a private GitHub Gist for cloud storage and automatic version history. Attachments are not included — only text notes.

#### Setup

1. Go to [github.com](https://github.com) → your profile picture → **Settings**
2. Scroll down and click **Developer settings**
3. Go to **Personal access tokens → Tokens (classic)**
4. Click **Generate new token (classic)**
5. Give it a name (e.g. `RoA2 Notes Backup`) and check only the **`gist`** scope
6. Click **Generate token** — copy it immediately, you won't see it again

#### Using it

1. Go to **Manage Data → GitHub Backup**
2. Paste your token into the input field and click **Save Token**
3. Click **Backup to GitHub** — your notes are uploaded to a new private gist on your account
4. A **view on GitHub** link appears in the UI pointing to the gist

Subsequent backups update the same gist rather than creating a new one, so GitHub automatically keeps a full revision history of every backup you've made.

To stop using the feature, click **Remove Token** — this clears the stored token and the link to the existing gist.

#### Importing from GitHub

Once a backup exists, an **Import from GitHub** button appears alongside the backup button. Clicking it fetches your latest Gist and merges the notes into your current data using the same rules as zip import — text notes are appended with a `---` separator, mains are merged without duplicates, and players are matched by **name**: same-name players have their character lists combined and notes merged rather than creating duplicates. The page reloads automatically once the import completes.

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
