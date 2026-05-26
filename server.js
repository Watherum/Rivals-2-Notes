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

let updateState = { status: 'idle', progress: 0, error: null, latestVersion: null, downloadUrl: null }
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

function mergeNoteValue(existing, incoming, key) {
  if (key === 'user_mains') {
    const a = Array.isArray(existing) ? existing : []
    const b = Array.isArray(incoming) ? incoming : []
    return [...new Set([...a, ...b])]
  }
  if (key === 'player_list') {
    const a = Array.isArray(existing) ? existing : []
    const b = Array.isArray(incoming) ? incoming : []
    const existingIds = new Set(a.map(p => p.id))
    return [...a, ...b.filter(p => !existingIds.has(p.id))]
  }
  // String notes: append with separator if both have content
  const existingStr = typeof existing === 'string' ? existing.trim() : ''
  const incomingStr = typeof incoming === 'string' ? incoming.trim() : ''
  if (existingStr && incomingStr) return existingStr + '\n\n---\n\n' + incomingStr
  return incomingStr || existingStr
}

function writeNotes(notes, username, append = false) {
  let count = 0
  for (const [key, value] of Object.entries(notes)) {
    const fp = keyToFile(key, username)
    let merged = value
    if (append && fs.existsSync(fp)) {
      const raw = fs.readFileSync(fp, 'utf8')
      let existing
      try { existing = JSON.parse(raw) } catch { existing = raw }
      merged = mergeNoteValue(existing, value, key)
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
  const { attachmentLimitGB = null } = users[req.user.username] || {}
  res.json({ attachmentLimitGB })
})

app.put('/api/settings', requireAuth, (req, res) => {
  const users = readUsers()
  if (!users[req.user.username]) return res.status(404).json({ error: 'User not found' })
  if ('attachmentLimitGB' in req.body) {
    users[req.user.username].attachmentLimitGB = req.body.attachmentLimitGB
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

    if (hasUpdate && downloadUrl) {
      updateState.latestVersion = latestVersion
      updateState.downloadUrl = downloadUrl
    }

    res.json({
      currentVersion: CURRENT_VERSION,
      latestVersion,
      hasUpdate,
      downloadUrl,
      releaseUrl: release.html_url,
      isPackaged: !!process.env.PORTABLE_EXECUTABLE_FILE,
    })
  } catch {
    res.json({ error: 'Network error. Check your connection and try again.' })
  }
})

app.get('/api/update/status', (req, res) => {
  res.json(updateState)
})

app.post('/api/update/download', async (req, res) => {
  if (!process.env.PORTABLE_EXECUTABLE_FILE) {
    return res.status(400).json({ error: 'Auto-download is only available in the packaged app.' })
  }
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
      const updatePath = path.join(exeDir, 'RoA2 Notes-update.exe')

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
})

app.post('/api/update/restart', (req, res) => {
  if (!process.env.PORTABLE_EXECUTABLE_FILE) {
    return res.status(400).json({ error: 'Restart is only available in the packaged app.' })
  }
  if (updateState.status !== 'ready') {
    return res.status(400).json({ error: 'Update not ready.' })
  }

  const exeDir = process.env.PORTABLE_EXECUTABLE_DIR
  const currentExe = process.env.PORTABLE_EXECUTABLE_FILE
  const updateExe = path.join(exeDir, 'RoA2 Notes-update.exe')
  const scriptPath = path.join(os.tmpdir(), `roa2-update-${Date.now()}.cmd`)

  const script = [
    '@echo off',
    'timeout /t 2 /nobreak > nul',
    `move /Y "${updateExe}" "${currentExe}"`,
    `start "" "${currentExe}"`,
    'del "%~f0"',
  ].join('\r\n')

  fs.writeFileSync(scriptPath, script, 'utf8')

  spawnProcess('cmd.exe', ['/c', scriptPath], { detached: true, stdio: 'ignore' }).unref()

  res.json({ ok: true })
  setTimeout(() => process.exit(0), 500)
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
