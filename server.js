import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { spawn as spawnProcess } from 'child_process'
import { randomBytes } from 'crypto'
import multer from 'multer'
import AdmZip from 'adm-zip'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
const require = createRequire(import.meta.url)
const archiver = require('archiver')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || __dirname

let pkgVersion = '0.0.0'
try { pkgVersion = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version } catch {}
const CURRENT_VERSION = pkgVersion
const GITHUB_REPO = 'Watherum/Rivals-2-Notes'

function normalizeTag(tag) {
  return tag.replace(/^v/i, '').toLowerCase()
}

let updateState = { status: 'idle', progress: 0, error: null, latestVersion: null, downloadUrl: null, assetName: null, updatePath: null, phase: null, tarballUrl: null }
const NOTES_DIR = path.join(DATA_DIR, 'notes')
const ATTACHMENTS_DIR = path.join(DATA_DIR, 'attachments')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const JWT_SECRET_FILE = path.join(DATA_DIR, 'jwt-secret.txt')

if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR)
if (!fs.existsSync(ATTACHMENTS_DIR)) fs.mkdirSync(ATTACHMENTS_DIR)

function getJwtSecret() {
  if (fs.existsSync(JWT_SECRET_FILE)) return fs.readFileSync(JWT_SECRET_FILE, 'utf8').trim()
  const secret = randomBytes(64).toString('hex')
  fs.writeFileSync(JWT_SECRET_FILE, secret, 'utf8')
  return secret
}
const JWT_SECRET = getJwtSecret()

const SERVER_START = Date.now()

const app = express()
app.use(cors())
app.use(express.json())
app.use('/attachments', express.static(ATTACHMENTS_DIR))

// Serve built frontend in production
const DIST = path.join(__dirname, 'dist')
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
}

// --- Auth helpers ---
function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) } catch { return {} }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8')
}

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || null)
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

function requireAdmin(req, res, next) {
  const users = readUsers()
  if (!users[req.user.username]?.isAdmin) return res.status(403).json({ error: 'Forbidden' })
  next()
}

// --- Multer for attachment uploads ---
// Note: destination reads req.user.username which is set by requireAuth before multer runs
const attachmentStorage = multer.diskStorage({
  destination(req, file, cb) {
    const username = req.user.username
    const scope = req.body.scope || 'general'
    const id = req.body.id || ''
    const dir = id
      ? path.join(ATTACHMENTS_DIR, username, scope, id)
      : path.join(ATTACHMENTS_DIR, username, scope)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(req, file, cb) {
    cb(null, file.originalname)
  },
})
const uploadAttachment = multer({ storage: attachmentStorage })

// --- Settings helpers ---
function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) } catch { return {} }
}

function getAttachmentsDirSize(dir) {
  if (!dir) dir = ATTACHMENTS_DIR
  let total = 0
  if (!fs.existsSync(dir)) return total
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = fs.statSync(full)
    total += stat.isDirectory() ? getAttachmentsDirSize(full) : stat.size
  }
  return total
}

// --- User-scoped path helpers ---
function userNotesDir(username) {
  const dir = path.join(NOTES_DIR, username)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function userAttachmentsDir(username) {
  const dir = path.join(ATTACHMENTS_DIR, username)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

// --- Notes helpers ---
function keyToFile(key, username) {
  const base = userNotesDir(username)
  if (key === 'user_mains') return path.join(base, 'mains.json')
  if (key === 'player_list') return path.join(base, 'player-list.json')
  if (key === 'workshop_characters') return path.join(base, 'workshop-characters.json')
  if (key === 'mains_general') return path.join(base, 'mains-general.txt')
  if (key === 'game_general') return path.join(base, 'game-general.txt')
  if (key.startsWith('player_notes_')) return path.join(base, 'player-notes-' + key.slice(13) + '.txt')
  if (key.startsWith('main_notes_')) return path.join(base, 'main-' + key.slice(11) + '.txt')
  if (key.startsWith('notes_')) return path.join(base, key.slice(6) + '.txt')
  if (key.startsWith('matchup_')) return path.join(base, 'matchup-' + key.slice(8).replace('_vs_', '-vs-') + '.txt')
  return path.join(base, key + '.txt')
}

function fileToKey(filename) {
  if (filename === 'mains.json') return 'user_mains'
  if (filename === 'player-list.json') return 'player_list'
  if (filename === 'workshop-characters.json') return 'workshop_characters'
  if (filename === 'mains-general.txt') return 'mains_general'
  if (filename === 'game-general.txt') return 'game_general'
  const base = filename.replace(/\.(txt|json)$/, '')
  if (base.startsWith('player-notes-')) return 'player_notes_' + base.slice(13)
  if (base.startsWith('matchup-')) return 'matchup_' + base.slice(8).replace('-vs-', '_vs_')
  if (base.startsWith('main-')) return 'main_notes_' + base.slice(5)
  return 'notes_' + base
}

function readAllNotes(username) {
  const dir = userNotesDir(username)
  const notes = {}
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f)
    if (!fs.statSync(fp).isFile()) continue
    const key = fileToKey(f)
    const raw = fs.readFileSync(fp, 'utf8')
    try { notes[key] = JSON.parse(raw) } catch { notes[key] = raw }
  }
  return notes
}

function mergePlayerList(existing, incoming) {
  const a = Array.isArray(existing) ? existing : []
  const b = Array.isArray(incoming) ? incoming : []

  const idRemap = {}
  const result = a.map(p => ({ ...p, charIds: [...(p.charIds || [])] }))
  const existingByName = new Map(result.map(p => [p.name.toLowerCase(), p]))
  const existingById = new Set(result.map(p => p.id))

  for (const incomingPlayer of b) {
    const nameKey = incomingPlayer.name.toLowerCase()

    if (existingById.has(incomingPlayer.id)) {
      continue
    }

    if (existingByName.has(nameKey)) {
      const existingPlayer = existingByName.get(nameKey)
      idRemap[incomingPlayer.id] = existingPlayer.id
      existingPlayer.charIds = [...new Set([...existingPlayer.charIds, ...(incomingPlayer.charIds || [])])]
    } else {
      const copy = { ...incomingPlayer, charIds: [...(incomingPlayer.charIds || [])] }
      result.push(copy)
      existingByName.set(nameKey, copy)
      existingById.add(incomingPlayer.id)
    }
  }

  return { mergedList: result, idRemap }
}

function mergeNoteValue(existing, incoming, key) {
  if (key === 'user_mains') {
    const a = Array.isArray(existing) ? existing : []
    const b = Array.isArray(incoming) ? incoming : []
    return [...new Set([...a, ...b])]
  }
  if (key === 'workshop_characters') {
    const a = Array.isArray(existing) ? existing : []
    const b = Array.isArray(incoming) ? incoming : []
    const ids = new Set(a.map(c => c.id))
    return [...a, ...b.filter(c => !ids.has(c.id))]
  }
  // String notes: append with separator if both have content
  const existingStr = typeof existing === 'string' ? existing.trim() : ''
  const incomingStr = typeof incoming === 'string' ? incoming.trim() : ''
  if (existingStr && incomingStr) return existingStr + '\n\n---\n\n' + incomingStr
  return incomingStr || existingStr
}

function writeNotes(notes, username, append = false) {
  let count = 0
  let idRemap = {}

  if ('player_list' in notes) {
    const fp = keyToFile('player_list', username)
    let merged = notes.player_list
    if (append && fs.existsSync(fp)) {
      const raw = fs.readFileSync(fp, 'utf8')
      let existing = []
      try { existing = JSON.parse(raw) } catch { existing = [] }
      const { mergedList, idRemap: remap } = mergePlayerList(existing, notes.player_list)
      merged = mergedList
      idRemap = remap
    }
    fs.writeFileSync(fp, JSON.stringify(merged, null, 2), 'utf8')
    count++
  }

  for (const [key, value] of Object.entries(notes)) {
    if (key === 'player_list') continue

    let resolvedKey = key
    if (key.startsWith('player_notes_')) {
      for (const [incomingId, existingId] of Object.entries(idRemap)) {
        if (key === `player_notes_${incomingId}` || key.startsWith(`player_notes_${incomingId}__`)) {
          resolvedKey = key.replace(`player_notes_${incomingId}`, `player_notes_${existingId}`)
          break
        }
      }
    }

    const fp = keyToFile(resolvedKey, username)
    let merged = value
    if (append && fs.existsSync(fp)) {
      const raw = fs.readFileSync(fp, 'utf8')
      let existing
      try { existing = JSON.parse(raw) } catch { existing = raw }
      merged = mergeNoteValue(existing, value, resolvedKey)
    }
    const content = typeof merged === 'string' ? merged : JSON.stringify(merged, null, 2)
    fs.writeFileSync(fp, content, 'utf8')
    count++
  }
  return count
}

// --- Attachment URL/dir helpers ---
function attachmentUrl(username, scope, id, filename) {
  if (id) return `/attachments/${username}/${scope}/${id}/${filename}`
  return `/attachments/${username}/${scope}/${filename}`
}

function attachmentDir(username, scope, id) {
  if (id) return path.join(ATTACHMENTS_DIR, username, scope, id)
  return path.join(ATTACHMENTS_DIR, username, scope)
}

// --- Auth routes ---
app.post('/api/auth/signup', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
  if (!/^[a-zA-Z0-9_-]{2,32}$/.test(username))
    return res.status(400).json({ error: 'Username must be 2–32 characters (letters, numbers, hyphens, underscores)' })

  const users = readUsers()
  if (users[username]) return res.status(409).json({ error: 'Username already taken' })

  const passwordHash = await bcrypt.hash(password, 12)
  users[username] = { passwordHash, createdAt: new Date().toISOString() }
  writeUsers(users)

  userNotesDir(username)
  userAttachmentsDir(username)

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '90d' })
  res.json({ ok: true, token, username })
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {}
  const users = readUsers()
  const user = users[username]
  if (!user) return res.status(401).json({ error: 'Invalid username or password' })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' })

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '90d' })
  res.json({ ok: true, token, username })
})

app.get('/api/version', (req, res) => res.json({ v: CURRENT_VERSION }))

app.get('/api/auth/me', requireAuth, (req, res) => {
  const users = readUsers()
  const { avatarUrl = null, isAdmin = false } = users[req.user.username] || {}
  res.json({ username: req.user.username, avatarUrl, isAdmin: !!isAdmin })
})

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(ATTACHMENTS_DIR, req.user.username, 'avatar')
      fs.mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
      cb(null, 'avatar' + ext)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    cb(null, /^image\//.test(file.mimetype))
  },
})

app.post('/api/auth/avatar', requireAuth, (req, res) => {
  avatarUpload.single('avatar')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' })

    const username = req.user.username
    const avatarDir = path.join(ATTACHMENTS_DIR, username, 'avatar')

    // Remove old avatar files with different extensions
    for (const f of fs.readdirSync(avatarDir)) {
      if (f !== req.file.filename) fs.unlinkSync(path.join(avatarDir, f))
    }

    const avatarUrl = `/attachments/${username}/avatar/${req.file.filename}?v=${Date.now()}`
    const users = readUsers()
    if (users[username]) { users[username].avatarUrl = avatarUrl; writeUsers(users) }
    res.json({ ok: true, avatarUrl })
  })
})

app.delete('/api/auth/avatar', requireAuth, (req, res) => {
  const username = req.user.username
  const avatarDir = path.join(ATTACHMENTS_DIR, username, 'avatar')
  if (fs.existsSync(avatarDir)) {
    for (const f of fs.readdirSync(avatarDir)) fs.unlinkSync(path.join(avatarDir, f))
  }
  const users = readUsers()
  if (users[username]) { delete users[username].avatarUrl; writeUsers(users) }
  res.json({ ok: true })
})

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both current and new password are required' })
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })

  const users = readUsers()
  const user = users[req.user.username]
  if (!user) return res.status(404).json({ error: 'User not found' })

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })

  users[req.user.username].passwordHash = await bcrypt.hash(newPassword, 12)
  writeUsers(users)
  res.json({ ok: true })
})

app.delete('/api/auth/data', requireAuth, (req, res) => {
  const { username } = req.user
  fs.rmSync(userNotesDir(username), { recursive: true, force: true })
  fs.rmSync(userAttachmentsDir(username), { recursive: true, force: true })
  res.json({ ok: true })
})

app.delete('/api/auth/account', requireAuth, (req, res) => {
  const { username } = req.user
  const users = readUsers()
  delete users[username]
  writeUsers(users)
  fs.rmSync(userNotesDir(username), { recursive: true, force: true })
  fs.rmSync(userAttachmentsDir(username), { recursive: true, force: true })
  res.json({ ok: true })
})

// --- Notes endpoints ---
app.get('/api/notes', requireAuth, (req, res) => {
  res.json(readAllNotes(req.user.username))
})

app.put('/api/notes/:key', requireAuth, (req, res) => {
  const { key } = req.params
  const { value } = req.body
  const fp = keyToFile(key, req.user.username)
  const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  fs.writeFileSync(fp, content, 'utf8')
  res.json({ ok: true })
})

app.delete('/api/notes/:key', requireAuth, (req, res) => {
  const fp = keyToFile(req.params.key, req.user.username)
  if (fs.existsSync(fp)) fs.unlinkSync(fp)
  res.json({ ok: true })
})

// --- Settings endpoints (per-user) ---
app.get('/api/settings', requireAuth, (req, res) => {
  const users = readUsers()
  const { attachmentLimitGB = null, githubPat, githubGistId = null, githubGistUrl = null, githubRepoName = null, githubRepoUrl = null } = users[req.user.username] || {}
  res.json({ attachmentLimitGB, githubPatSet: !!githubPat, githubGistId, githubGistUrl, githubRepoName, githubRepoUrl })
})

app.put('/api/settings', requireAuth, (req, res) => {
  const users = readUsers()
  if (!users[req.user.username]) return res.status(404).json({ error: 'User not found' })
  if ('attachmentLimitGB' in req.body) {
    users[req.user.username].attachmentLimitGB = req.body.attachmentLimitGB
  }
  if ('githubPat' in req.body) {
    if (req.body.githubPat) {
      users[req.user.username].githubPat = req.body.githubPat
    } else {
      delete users[req.user.username].githubPat
      delete users[req.user.username].githubGistId
      delete users[req.user.username].githubGistUrl
      delete users[req.user.username].githubRepoName
      delete users[req.user.username].githubRepoUrl
    }
  }
  writeUsers(users)
  res.json({ ok: true })
})

// --- Attachment endpoints ---

app.get('/api/attachments/size', requireAuth, (req, res) => {
  res.json({ bytes: getAttachmentsDirSize(userAttachmentsDir(req.user.username)) })
})

app.post('/api/attachments/upload', requireAuth, (req, res) => {
  uploadAttachment.array('files')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message })

    const { attachmentLimitGB } = readUsers()[req.user.username] || {}
    if (attachmentLimitGB) {
      const limitBytes = attachmentLimitGB * 1024 ** 3
      const totalBytes = getAttachmentsDirSize(userAttachmentsDir(req.user.username))
      if (totalBytes > limitBytes) {
        for (const f of req.files || []) fs.existsSync(f.path) && fs.unlinkSync(f.path)
        const usedGB = (totalBytes / 1024 ** 3).toFixed(2)
        return res.status(413).json({
          error: `Attachment storage limit reached (${usedGB} GB used of ${attachmentLimitGB} GB limit). Delete some attachments to free up space.`,
        })
      }
    }

    const username = req.user.username
    const files = (req.files || []).map(f => ({
      filename: f.originalname,
      url: attachmentUrl(username, req.body.scope, req.body.id, f.originalname),
    }))
    res.json({ ok: true, files })
  })
})

app.get('/api/attachments', requireAuth, (req, res) => {
  const username = req.user.username
  const userDir = userAttachmentsDir(username)
  const results = []
  if (!fs.existsSync(userDir)) return res.json(results)

  for (const scope of fs.readdirSync(userDir)) {
    const scopeDir = path.join(userDir, scope)
    if (!fs.statSync(scopeDir).isDirectory()) continue

    if (scope === 'general') {
      for (const file of fs.readdirSync(scopeDir)) {
        if (fs.statSync(path.join(scopeDir, file)).isFile()) {
          results.push({ filename: file, url: attachmentUrl(username, 'general', null, file), scope: 'general', id: null })
        }
      }
    } else {
      for (const id of fs.readdirSync(scopeDir)) {
        const idDir = path.join(scopeDir, id)
        if (!fs.statSync(idDir).isDirectory()) continue
        for (const file of fs.readdirSync(idDir)) {
          if (fs.statSync(path.join(idDir, file)).isFile()) {
            results.push({ filename: file, url: attachmentUrl(username, scope, id, file), scope, id })
          }
        }
      }
    }
  }
  res.json(results)
})

app.get('/api/attachments/general', requireAuth, (req, res) => {
  const dir = attachmentDir(req.user.username, 'general', '')
  if (!fs.existsSync(dir)) return res.json([])
  const username = req.user.username
  const files = fs.readdirSync(dir).map(f => ({
    filename: f,
    url: attachmentUrl(username, 'general', null, f),
  }))
  res.json(files)
})

app.get('/api/attachments/:scope/:id', requireAuth, (req, res) => {
  const { scope, id } = req.params
  const username = req.user.username
  const dir = attachmentDir(username, scope, id)
  if (!fs.existsSync(dir)) return res.json([])
  const files = fs.readdirSync(dir).map(f => ({
    filename: f,
    url: attachmentUrl(username, scope, id, f),
  }))
  res.json(files)
})

app.delete('/api/attachments/general/:filename', requireAuth, (req, res) => {
  const fp = path.join(attachmentDir(req.user.username, 'general', ''), req.params.filename)
  if (fs.existsSync(fp)) fs.unlinkSync(fp)
  res.json({ ok: true })
})

app.delete('/api/attachments/:scope/:id/:filename', requireAuth, (req, res) => {
  const { scope, id, filename } = req.params
  const fp = path.join(attachmentDir(req.user.username, scope, id), filename)
  if (fs.existsSync(fp)) fs.unlinkSync(fp)
  res.json({ ok: true })
})

// --- Export as zip ---
app.get('/api/export', requireAuth, (req, res) => {
  const username = req.user.username
  res.setHeader('Content-Disposition', 'attachment; filename="roa2-notes-backup.zip"')
  res.setHeader('Content-Type', 'application/zip')

  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.pipe(res)

  const notes = readAllNotes(username)
  archive.append(JSON.stringify(notes, null, 2), { name: 'notes-export.json' })

  const userAttDir = userAttachmentsDir(username)
  if (fs.existsSync(userAttDir)) {
    archive.directory(userAttDir, 'attachments')
  }

  archive.finalize()
})

// --- Import from json or zip ---
app.post('/api/import', requireAuth, (req, res) => {
  const username = req.user.username
  const tmpDir = path.join(__dirname, 'tmp-import')
  fs.mkdirSync(tmpDir, { recursive: true })

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tmpDir),
    filename: (req, file, cb) => cb(null, file.originalname),
  })
  const upload = multer({ storage }).single('backup')

  upload(req, res, err => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const filePath = req.file.path
    const fileName = req.file.originalname

    try {
      let notesCount = 0
      let attachmentsCount = 0

      if (fileName.endsWith('.zip')) {
        const zip = new AdmZip(filePath)
        const entries = zip.getEntries()

        for (const entry of entries) {
          if (entry.isDirectory) continue
          const entryName = entry.entryName

          if (entryName === 'notes-export.json') {
            const notes = JSON.parse(entry.getData().toString('utf8'))
            notesCount = writeNotes(notes, username, true)
          } else if (entryName.startsWith('attachments/')) {
            const relPath = entryName.slice('attachments/'.length)
            const destPath = path.join(userAttachmentsDir(username), relPath)
            fs.mkdirSync(path.dirname(destPath), { recursive: true })
            fs.writeFileSync(destPath, entry.getData())
            attachmentsCount++
          }
        }
      } else {
        const raw = fs.readFileSync(filePath, 'utf8')
        const notes = JSON.parse(raw)
        notesCount = writeNotes(notes, username, true)
      }

      fs.unlinkSync(filePath)
      res.json({ ok: true, notes: notesCount, attachments: attachmentsCount })
    } catch (e) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      res.status(400).json({ error: e.message })
    }
  })
})

// --- GitHub Gist backup ---
app.post('/api/github-backup', requireAuth, async (req, res) => {
  const username = req.user.username
  const users = readUsers()
  const { githubPat, githubGistId } = users[username] || {}

  if (!githubPat) return res.status(400).json({ error: 'No GitHub token configured. Add one in Manage Data.' })

  const notes = readAllNotes(username)
  const gistPayload = {
    description: 'RoA2 Notes Backup',
    public: false,
    files: { 'roa2-notes-backup.json': { content: JSON.stringify(notes, null, 2) } },
  }

  try {
    const headers = {
      Authorization: `Bearer ${githubPat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'RoA2-Notes-App',
    }

    const url = githubGistId ? `https://api.github.com/gists/${githubGistId}` : 'https://api.github.com/gists'
    const method = githubGistId ? 'PATCH' : 'POST'
    const ghRes = await fetch(url, { method, headers, body: JSON.stringify(gistPayload) })
    const ghData = await ghRes.json()

    if (!ghRes.ok) return res.status(ghRes.status).json({ error: ghData.message || 'GitHub API error' })

    const freshUsers = readUsers()
    freshUsers[username].githubGistId = ghData.id
    freshUsers[username].githubGistUrl = ghData.html_url
    writeUsers(freshUsers)

    res.json({ ok: true, gistId: ghData.id, gistUrl: ghData.html_url })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- GitHub Gist import ---
app.post('/api/github-import', requireAuth, async (req, res) => {
  const username = req.user.username
  const users = readUsers()
  const { githubPat, githubGistId } = users[username] || {}

  if (!githubPat) return res.status(400).json({ error: 'No GitHub token configured. Add one in Manage Data.' })

  try {
    const headers = {
      Authorization: `Bearer ${githubPat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'RoA2-Notes-App',
    }

    let resolvedGistId = githubGistId
    if (!resolvedGistId) {
      // Search the user's gists for a backup created by this app
      let page = 1
      let found = null
      while (!found) {
        const listRes = await fetch(`https://api.github.com/gists?per_page=100&page=${page}`, { headers })
        if (!listRes.ok) {
          const listData = await listRes.json()
          return res.status(listRes.status).json({ error: listData.message || 'Failed to list gists.' })
        }
        const gists = await listRes.json()
        if (gists.length === 0) break
        found = gists.find(g => g.files?.['roa2-notes-backup.json'])
        if (found || gists.length < 100) break
        page++
      }
      if (!found) return res.status(404).json({ error: 'No RoA2 Notes backup found in your GitHub Gists. Create a backup first.' })
      resolvedGistId = found.id
      const freshUsers = readUsers()
      freshUsers[username].githubGistId = found.id
      freshUsers[username].githubGistUrl = found.html_url
      writeUsers(freshUsers)
    }

    const ghRes = await fetch(`https://api.github.com/gists/${resolvedGistId}`, { headers })
    const ghData = await ghRes.json()
    if (!ghRes.ok) return res.status(ghRes.status).json({ error: ghData.message || 'GitHub API error' })

    const fileEntry = ghData.files?.['roa2-notes-backup.json']
    if (!fileEntry) return res.status(400).json({ error: 'Backup file not found in Gist.' })

    let content = fileEntry.content
    if (fileEntry.truncated) {
      const rawRes = await fetch(fileEntry.raw_url, { headers })
      content = await rawRes.text()
    }

    const notes = JSON.parse(content)
    const count = writeNotes(notes, username, true)
    res.json({ ok: true, notes: count, gistUrl: ghData.html_url })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- GitHub Repository backup helpers ---
function githubApiHeaders(pat) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'RoA2-Notes-App',
  }
}

async function getGithubLogin(pat) {
  const res = await fetch('https://api.github.com/user', { headers: githubApiHeaders(pat) })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Could not verify GitHub token. Make sure it has the repo scope.')
  }
  const data = await res.json()
  return data.login
}

function enumerateUserFiles(username) {
  const files = []
  const notes = readAllNotes(username)
  files.push({ repoPath: 'notes-export.json', content: JSON.stringify(notes, null, 2), encoding: 'utf-8' })
  const attDir = userAttachmentsDir(username)
  function walk(dir, relBase) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      const rel = relBase ? `${relBase}/${entry}` : entry
      const stat = fs.statSync(full)
      if (stat.isDirectory()) walk(full, rel)
      else files.push({ repoPath: `attachments/${rel}`, localPath: full, size: stat.size, encoding: 'binary' })
    }
  }
  if (fs.existsSync(attDir)) walk(attDir, '')
  return files
}

// --- GitHub Repository backup ---
app.post('/api/github-repo-backup', requireAuth, async (req, res) => {
  const username = req.user.username
  const users = readUsers()
  const { githubPat } = users[username] || {}
  if (!githubPat) return res.status(400).json({ error: 'No GitHub token configured. Add one in Manage Data.' })

  const REPO_NAME = 'roa2-notes-backup'
  const SKIP_BYTES = 99 * 1024 * 1024

  try {
    const headers = githubApiHeaders(githubPat)
    const owner = await getGithubLogin(githubPat)
    const repoApiBase = `https://api.github.com/repos/${owner}/${REPO_NAME}`

    // Ensure repo exists
    const repoRes = await fetch(repoApiBase, { headers })
    if (repoRes.status === 404) {
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST', headers,
        body: JSON.stringify({ name: REPO_NAME, private: true, auto_init: true, description: 'RoA2 Notes Backup' }),
      })
      if (!createRes.ok) {
        const d = await createRes.json()
        return res.status(createRes.status).json({ error: d.message || 'Failed to create backup repository.' })
      }
    } else if (!repoRes.ok) {
      const d = await repoRes.json()
      return res.status(repoRes.status).json({ error: d.message || 'Failed to access backup repository.' })
    }

    // Get HEAD commit SHA
    const refRes = await fetch(`${repoApiBase}/git/ref/heads/main`, { headers })
    if (!refRes.ok) {
      const d = await refRes.json()
      return res.status(refRes.status).json({ error: d.message || 'Failed to read repository HEAD.' })
    }
    const headCommitSha = (await refRes.json()).object.sha

    // Enumerate and upload files as blobs
    const files = enumerateUserFiles(username)
    const skipped = []
    const treeEntries = []

    for (const f of files) {
      try {
        let blobBody
        if (f.encoding === 'binary') {
          if (f.size > SKIP_BYTES) {
            skipped.push({ path: f.repoPath, reason: `File too large for GitHub (${(f.size / 1_000_000).toFixed(1)} MB — limit is 100 MB)` })
            continue
          }
          blobBody = JSON.stringify({ content: fs.readFileSync(f.localPath).toString('base64'), encoding: 'base64' })
        } else {
          blobBody = JSON.stringify({ content: f.content, encoding: 'utf-8' })
        }

        const blobRes = await fetch(`${repoApiBase}/git/blobs`, { method: 'POST', headers, body: blobBody })
        if (!blobRes.ok) {
          const d = await blobRes.json()
          if (blobRes.status === 403 || blobRes.status === 429) return res.status(429).json({ error: 'GitHub rate limit reached. Try again later.' })
          skipped.push({ path: f.repoPath, reason: d.message || 'Upload failed' })
          continue
        }
        const blobData = await blobRes.json()
        treeEntries.push({ path: f.repoPath, mode: '100644', type: 'blob', sha: blobData.sha })
      } catch (fileErr) {
        skipped.push({ path: f.repoPath, reason: fileErr.message })
      }
    }

    if (treeEntries.length === 0) return res.status(400).json({ error: 'No files could be uploaded. All files were skipped or failed.' })

    // Create full-snapshot tree (no base_tree — clean state each backup)
    const treeRes = await fetch(`${repoApiBase}/git/trees`, {
      method: 'POST', headers, body: JSON.stringify({ tree: treeEntries }),
    })
    if (!treeRes.ok) {
      const d = await treeRes.json()
      return res.status(treeRes.status).json({ error: d.message || 'Failed to create repository tree.' })
    }
    const newTreeSha = (await treeRes.json()).sha

    // Create commit
    const commitRes = await fetch(`${repoApiBase}/git/commits`, {
      method: 'POST', headers,
      body: JSON.stringify({
        message: `RoA2 Notes backup — ${new Date().toISOString()}`,
        tree: newTreeSha,
        parents: [headCommitSha],
      }),
    })
    if (!commitRes.ok) {
      const d = await commitRes.json()
      return res.status(commitRes.status).json({ error: d.message || 'Failed to create commit.' })
    }
    const newCommitSha = (await commitRes.json()).sha

    // Update branch ref
    const updateRefRes = await fetch(`${repoApiBase}/git/refs/heads/main`, {
      method: 'PATCH', headers, body: JSON.stringify({ sha: newCommitSha, force: true }),
    })
    if (!updateRefRes.ok) {
      const d = await updateRefRes.json()
      return res.status(updateRefRes.status).json({ error: d.message || 'Failed to update repository branch.' })
    }

    const repoUrl = `https://github.com/${owner}/${REPO_NAME}`
    const freshUsers = readUsers()
    freshUsers[username].githubRepoName = REPO_NAME
    freshUsers[username].githubRepoUrl = repoUrl
    writeUsers(freshUsers)

    res.json({ ok: true, repoUrl, repoName: REPO_NAME, fileCount: treeEntries.length, skipped })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- GitHub Repository import ---
app.post('/api/github-repo-import', requireAuth, async (req, res) => {
  const username = req.user.username
  const users = readUsers()
  const { githubPat, githubRepoName } = users[username] || {}
  if (!githubPat) return res.status(400).json({ error: 'No GitHub token configured. Add one in Manage Data.' })

  const REPO_NAME = githubRepoName || 'roa2-notes-backup'

  try {
    const headers = githubApiHeaders(githubPat)
    const owner = await getGithubLogin(githubPat)
    const repoApiBase = `https://api.github.com/repos/${owner}/${REPO_NAME}`

    // Get full recursive tree
    const treeRes = await fetch(`${repoApiBase}/git/trees/main?recursive=1`, { headers })
    if (treeRes.status === 404) return res.status(404).json({ error: `Repository "${REPO_NAME}" not found. Run a Repository Backup first.` })
    if (!treeRes.ok) {
      const d = await treeRes.json()
      return res.status(treeRes.status).json({ error: d.message || 'Failed to read repository.' })
    }
    const blobs = (await treeRes.json()).tree.filter(e => e.type === 'blob' && (e.path === 'notes-export.json' || e.path.startsWith('attachments/')))

    let notesCount = 0
    let attachmentsCount = 0

    for (const blob of blobs) {
      const blobRes = await fetch(`${repoApiBase}/git/blobs/${blob.sha}`, { headers })
      if (!blobRes.ok) continue
      const blobData = await blobRes.json()
      const buf = Buffer.from(blobData.content.replace(/\n/g, ''), 'base64')

      if (blob.path === 'notes-export.json') {
        const notes = JSON.parse(buf.toString('utf8'))
        notesCount = writeNotes(notes, username, true)
      } else {
        const relPath = blob.path.slice('attachments/'.length)
        const destPath = path.join(userAttachmentsDir(username), relPath)
        fs.mkdirSync(path.dirname(destPath), { recursive: true })
        fs.writeFileSync(destPath, buf)
        attachmentsCount++
      }
    }

    // Persist repo name for cross-device restore
    if (!users[username].githubRepoName) {
      const freshUsers = readUsers()
      freshUsers[username].githubRepoName = REPO_NAME
      freshUsers[username].githubRepoUrl = `https://github.com/${owner}/${REPO_NAME}`
      writeUsers(freshUsers)
    }

    res.json({ ok: true, notes: notesCount, attachments: attachmentsCount })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Update helpers ---

function copyDirSync(src, dest, skipSet) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skipSet?.has(entry.name)) continue
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true })
      copyDirSync(srcPath, destPath, null)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function runNpmCommand(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess('npm', args, { cwd, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env } })
    let stderr = ''
    child.stderr.on('data', d => { stderr += d.toString() })
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`npm ${args.join(' ')} failed: ${stderr.slice(-500)}`)))
    child.on('error', err => reject(new Error(`Failed to spawn npm: ${err.message}`)))
  })
}

async function runUnixUpdate() {
  const appRoot = __dirname
  const tmpDir = path.join(os.tmpdir(), `roa2-update-${Date.now()}`)
  const tarballPath = path.join(tmpDir, 'update.tar.gz')
  try {
    updateState.phase = 'downloading'
    updateState.progress = 0
    fs.mkdirSync(tmpDir, { recursive: true })

    const dlRes = await fetch(updateState.tarballUrl, { headers: { 'User-Agent': 'RoA2-Notes-App' } })
    if (!dlRes.ok) throw new Error(`Download failed (HTTP ${dlRes.status})`)
    const total = parseInt(dlRes.headers.get('content-length') || '0', 10)
    let downloaded = 0
    const nodeStream = Readable.fromWeb(dlRes.body)
    nodeStream.on('data', chunk => {
      downloaded += chunk.length
      if (total > 0) updateState.progress = Math.round((downloaded / total) * 40)
    })
    await pipeline(nodeStream, fs.createWriteStream(tarballPath))
    updateState.progress = 40

    updateState.phase = 'extracting'
    const extractDir = path.join(tmpDir, 'extracted')
    fs.mkdirSync(extractDir, { recursive: true })
    await new Promise((resolve, reject) => {
      const tar = spawnProcess('tar', ['-xzf', tarballPath, '-C', extractDir], { stdio: 'pipe' })
      tar.on('close', code => code === 0 ? resolve() : reject(new Error(`tar exited with code ${code}`)))
      tar.on('error', reject)
    })
    updateState.progress = 55

    // GitHub tarballs extract to a single nested dir (e.g. Watherum-Rivals-2-Notes-{sha}/)
    const entries = fs.readdirSync(extractDir)
    const sourceDir = entries.length === 1 && fs.statSync(path.join(extractDir, entries[0])).isDirectory()
      ? path.join(extractDir, entries[0]) : extractDir

    copyDirSync(sourceDir, appRoot, new Set(['node_modules', 'data', '.env', 'dist', '.git']))
    updateState.progress = 65

    updateState.phase = 'installing'
    await runNpmCommand(['install'], appRoot)
    updateState.progress = 80

    updateState.phase = 'building'
    await runNpmCommand(['run', 'build'], appRoot)
    updateState.progress = 100

    updateState.status = 'ready'
    updateState.phase = null
  } catch (e) {
    updateState.status = 'error'
    updateState.error = e.message
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}

// --- Update endpoints (unauthenticated — system level) ---

app.get('/api/update/check', async (req, res) => {
  try {
    const headers = { 'User-Agent': 'RoA2-Notes-App' }

    // Fetch latest release and all releases in parallel
    const [latestRes, allRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, { headers }),
      fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`, { headers }),
    ])
    if (!latestRes.ok) return res.json({ error: 'Could not reach GitHub. Try again later.' })

    const release = await latestRes.json()
    if (!release.tag_name) return res.json({ error: 'No releases found on GitHub.' })

    // Find current version's release by matching tag (case-insensitive) to get its publish date
    let currentReleaseDate = null
    if (allRes.ok) {
      const allReleases = await allRes.json()
      const currentRelease = allReleases.find(r => normalizeTag(r.tag_name) === normalizeTag(CURRENT_VERSION))
      if (currentRelease) currentReleaseDate = new Date(currentRelease.published_at)
    }

    const latestVersion = release.tag_name.replace(/^v/i, '')
    const latestDate = new Date(release.published_at)

    // Primary: compare publish dates (format-agnostic). Fallback: different tag means update.
    const isSameTag = normalizeTag(release.tag_name) === normalizeTag(CURRENT_VERSION)
    const hasUpdate = !isSameTag && (currentReleaseDate ? latestDate > currentReleaseDate : true)

    const exeAsset = (release.assets || []).find(a => a.name.endsWith('.exe'))
    const downloadUrl = exeAsset?.browser_download_url || null

    if (hasUpdate) {
      updateState.latestVersion = latestVersion
      if (process.platform === 'win32' && process.env.PORTABLE_EXECUTABLE_FILE && exeAsset) {
        updateState.downloadUrl = downloadUrl
        updateState.assetName = exeAsset.name
        updateState.tarballUrl = null
      } else {
        updateState.tarballUrl = release.tarball_url || null
        updateState.downloadUrl = null
        updateState.assetName = null
      }
    }

    res.json({
      currentVersion: CURRENT_VERSION,
      latestVersion,
      hasUpdate,
      downloadUrl,
      releaseUrl: release.html_url,
      isPackaged: !!process.env.PORTABLE_EXECUTABLE_FILE,
      tarballUrl: updateState.tarballUrl,
    })
  } catch {
    res.json({ error: 'Network error. Check your connection and try again.' })
  }
})

app.get('/api/update/status', (req, res) => {
  res.json(updateState)
})

app.post('/api/update/download', async (req, res) => {
  const isPackagedExe = process.platform === 'win32' && !!process.env.PORTABLE_EXECUTABLE_FILE

  if (isPackagedExe) {
    if (!updateState.downloadUrl) {
      return res.status(400).json({ error: 'No update available. Check for updates first.' })
    }
    if (updateState.status === 'downloading') {
      return res.json({ status: 'downloading' })
    }

    updateState.status = 'downloading'
    updateState.progress = 0
    updateState.error = null
    res.json({ status: 'downloading' })

    ;(async () => {
      try {
        const exeDir = process.env.PORTABLE_EXECUTABLE_DIR
        const updatePath = path.join(exeDir, updateState.assetName)
        updateState.updatePath = updatePath

        const dlResponse = await fetch(updateState.downloadUrl)
        if (!dlResponse.ok) throw new Error(`Download failed (HTTP ${dlResponse.status})`)

        const totalBytes = parseInt(dlResponse.headers.get('content-length') || '0', 10)
        let downloadedBytes = 0

        const writeStream = fs.createWriteStream(updatePath)
        const nodeStream = Readable.fromWeb(dlResponse.body)

        nodeStream.on('data', chunk => {
          downloadedBytes += chunk.length
          if (totalBytes > 0) {
            updateState.progress = Math.round((downloadedBytes / totalBytes) * 100)
          }
        })

        await pipeline(nodeStream, writeStream)

        updateState.status = 'ready'
        updateState.progress = 100
      } catch (e) {
        updateState.status = 'error'
        updateState.error = e.message
      }
    })()
  } else {
    // Source mode: Unix or Windows npm run start
    if (!updateState.tarballUrl) {
      return res.status(400).json({ error: 'No update available. Check for updates first.' })
    }
    if (updateState.status === 'downloading') {
      return res.json({ status: 'downloading' })
    }

    updateState.status = 'downloading'
    updateState.phase = 'downloading'
    updateState.progress = 0
    updateState.error = null
    res.json({ status: 'downloading' })

    runUnixUpdate()
  }
})

app.post('/api/update/restart', (req, res) => {
  if (updateState.status !== 'ready') {
    return res.status(400).json({ error: 'Update not ready.' })
  }
  res.json({ ok: true })
  setTimeout(() => process.exit(0), 500)
})

app.post('/api/update/open-folder', (req, res) => {
  if (process.platform !== 'win32') return res.status(400).json({ error: 'Not supported on this platform.' })
  if (!updateState.updatePath) return res.status(400).json({ error: 'No update path available.' })
  spawnProcess('explorer.exe', ['/select,', updateState.updatePath], { detached: true, stdio: 'ignore' }).unref()
  res.json({ ok: true })
})

// --- Admin routes ---
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const users = readUsers()
  const list = Object.entries(users).map(([username, u]) => ({
    username,
    createdAt: u.createdAt || null,
    isAdmin: !!u.isAdmin,
    attachmentLimitGB: u.attachmentLimitGB ?? null,
    usedBytes: getAttachmentsDirSize(userAttachmentsDir(username)),
  }))
  res.json(list)
})

app.put('/api/admin/users/:username/limit', requireAuth, requireAdmin, (req, res) => {
  const { username } = req.params
  const users = readUsers()
  if (!users[username]) return res.status(404).json({ error: 'User not found' })
  const limitGB = req.body.limitGB ?? null
  users[username].attachmentLimitGB = (limitGB && parseFloat(limitGB) > 0) ? parseFloat(limitGB) : null
  writeUsers(users)
  res.json({ ok: true })
})

app.post('/api/admin/users/:username/reset-password', requireAuth, requireAdmin, async (req, res) => {
  const { username } = req.params
  const { newPassword } = req.body || {}
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  const users = readUsers()
  if (!users[username]) return res.status(404).json({ error: 'User not found' })
  users[username].passwordHash = await bcrypt.hash(newPassword, 12)
  writeUsers(users)
  res.json({ ok: true })
})

app.delete('/api/admin/users/:username', requireAuth, requireAdmin, (req, res) => {
  const { username } = req.params
  if (username === req.user.username) return res.status(400).json({ error: 'Cannot delete your own account' })
  const users = readUsers()
  if (!users[username]) return res.status(404).json({ error: 'User not found' })
  const notesDir = path.join(NOTES_DIR, username)
  const attDir = path.join(ATTACHMENTS_DIR, username)
  if (fs.existsSync(notesDir)) fs.rmSync(notesDir, { recursive: true, force: true })
  if (fs.existsSync(attDir)) fs.rmSync(attDir, { recursive: true, force: true })
  delete users[username]
  writeUsers(users)
  res.json({ ok: true })
})

// SPA fallback for production
app.get('/{*path}', (req, res) => {
  const index = path.join(DIST, 'index.html')
  if (fs.existsSync(index)) res.sendFile(index)
  else res.status(404).send('Run "npm run build" first')
})

function listen(port) {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`RoA2 Notes server running at http://localhost:${port}`)
  })
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying ${port + 1}...`)
      server.close()
      listen(port + 1)
    } else {
      throw err
    }
  })
}

listen(Number(process.env.PORT) || 3001)
