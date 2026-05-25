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
import multer from 'multer'
import AdmZip from 'adm-zip'
const require = createRequire(import.meta.url)
const archiver = require('archiver')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || __dirname

let pkgVersion = '0.0.0'
try { pkgVersion = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version } catch {}
const CURRENT_VERSION = pkgVersion
const GITHUB_REPO = 'Watherum/Rivals-2-Notes'

function isNewerVersion(current, latest) {
  const a = current.replace(/^v/, '').split('.').map(Number)
  const b = latest.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((b[i] || 0) > (a[i] || 0)) return true
    if ((b[i] || 0) < (a[i] || 0)) return false
  }
  return false
}

let updateState = { status: 'idle', progress: 0, error: null, latestVersion: null, downloadUrl: null }
const NOTES_DIR = path.join(DATA_DIR, 'notes')
const ATTACHMENTS_DIR = path.join(DATA_DIR, 'attachments')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR)
if (!fs.existsSync(ATTACHMENTS_DIR)) fs.mkdirSync(ATTACHMENTS_DIR)


const app = express()
app.use(cors())
app.use(express.json())
app.use('/attachments', express.static(ATTACHMENTS_DIR))

// Serve built frontend in production
const DIST = path.join(__dirname, 'dist')
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
}

// --- Multer for attachment uploads ---
const attachmentStorage = multer.diskStorage({
  destination(req, file, cb) {
    const scope = req.body.scope || 'general'
    const id = req.body.id || ''
    const dir = id
      ? path.join(ATTACHMENTS_DIR, scope, id)
      : path.join(ATTACHMENTS_DIR, scope)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(req, file, cb) {
    cb(null, file.originalname)
  },
})
const uploadAttachment = multer({ storage: attachmentStorage })

// Multer for import (single backup file)
const importStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(__dirname, 'tmp-import'))
  },
  filename(req, file, cb) {
    cb(null, file.originalname)
  },
})
const uploadImport = multer({ storage: importStorage })

// --- Settings helpers ---
function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) } catch { return {} }
}

function getAttachmentsDirSize(dir = ATTACHMENTS_DIR) {
  let total = 0
  if (!fs.existsSync(dir)) return total
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = fs.statSync(full)
    total += stat.isDirectory() ? getAttachmentsDirSize(full) : stat.size
  }
  return total
}

// --- Notes helpers ---
function keyToFile(key) {
  if (key === 'user_mains') return path.join(NOTES_DIR, 'mains.json')
  if (key === 'mains_general') return path.join(NOTES_DIR, 'mains-general.txt')
  if (key === 'game_general') return path.join(NOTES_DIR, 'game-general.txt')
  if (key.startsWith('main_notes_')) return path.join(NOTES_DIR, 'main-' + key.slice(11) + '.txt')
  if (key.startsWith('notes_')) return path.join(NOTES_DIR, key.slice(6) + '.txt')
  if (key.startsWith('matchup_')) return path.join(NOTES_DIR, 'matchup-' + key.slice(8).replace('_vs_', '-vs-') + '.txt')
  return path.join(NOTES_DIR, key + '.txt')
}

function fileToKey(filename) {
  if (filename === 'mains.json') return 'user_mains'
  if (filename === 'mains-general.txt') return 'mains_general'
  if (filename === 'game-general.txt') return 'game_general'
  const base = filename.replace(/\.(txt|json)$/, '')
  if (base.startsWith('matchup-')) return 'matchup_' + base.slice(8).replace('-vs-', '_vs_')
  if (base.startsWith('main-')) return 'main_notes_' + base.slice(5)
  return 'notes_' + base
}

function readAllNotes() {
  const notes = {}
  for (const f of fs.readdirSync(NOTES_DIR)) {
    const fp = path.join(NOTES_DIR, f)
    const key = fileToKey(f)
    const raw = fs.readFileSync(fp, 'utf8')
    try { notes[key] = JSON.parse(raw) } catch { notes[key] = raw }
  }
  return notes
}

function writeNotes(notes) {
  let count = 0
  for (const [key, value] of Object.entries(notes)) {
    const fp = keyToFile(key)
    const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    fs.writeFileSync(fp, content, 'utf8')
    count++
  }
  return count
}

// --- Notes endpoints ---
app.get('/api/notes', (req, res) => {
  res.json(readAllNotes())
})

app.put('/api/notes/:key', (req, res) => {
  const { key } = req.params
  const { value } = req.body
  const fp = keyToFile(key)
  const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  fs.writeFileSync(fp, content, 'utf8')
  res.json({ ok: true })
})

app.delete('/api/notes/:key', (req, res) => {
  const fp = keyToFile(req.params.key)
  if (fs.existsSync(fp)) fs.unlinkSync(fp)
  res.json({ ok: true })
})

// --- Settings endpoints ---
app.get('/api/settings', (req, res) => {
  res.json(readSettings())
})

app.put('/api/settings', (req, res) => {
  const current = readSettings()
  const updated = { ...current, ...req.body }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8')
  res.json({ ok: true })
})

// --- Attachment endpoints ---

// GET /api/attachments/size — current attachments directory total size in bytes
app.get('/api/attachments/size', (req, res) => {
  res.json({ bytes: getAttachmentsDirSize() })
})

// POST /api/attachments/upload — multer reads scope+id from body fields before storage
app.post('/api/attachments/upload', (req, res, next) => {
  uploadAttachment.array('files')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message })

    const { attachmentLimitGB } = readSettings()
    if (attachmentLimitGB) {
      const limitBytes = attachmentLimitGB * 1024 ** 3
      const totalBytes = getAttachmentsDirSize()
      if (totalBytes > limitBytes) {
        for (const f of req.files || []) fs.existsSync(f.path) && fs.unlinkSync(f.path)
        const usedGB = (totalBytes / 1024 ** 3).toFixed(2)
        return res.status(413).json({
          error: `Attachment storage limit reached (${usedGB} GB used of ${attachmentLimitGB} GB limit). Delete some attachments to free up space.`,
        })
      }
    }

    const files = (req.files || []).map(f => ({
      filename: f.originalname,
      url: attachmentUrl(req.body.scope, req.body.id, f.originalname),
    }))
    res.json({ ok: true, files })
  })
})

function attachmentUrl(scope, id, filename) {
  if (id) return `/attachments/${scope}/${id}/${filename}`
  return `/attachments/${scope}/${filename}`
}

function attachmentDir(scope, id) {
  if (id) return path.join(ATTACHMENTS_DIR, scope, id)
  return path.join(ATTACHMENTS_DIR, scope)
}

// GET /api/attachments — list ALL attachments across every scope/id
app.get('/api/attachments', (req, res) => {
  const results = []
  if (!fs.existsSync(ATTACHMENTS_DIR)) return res.json(results)

  for (const scope of fs.readdirSync(ATTACHMENTS_DIR)) {
    const scopeDir = path.join(ATTACHMENTS_DIR, scope)
    if (!fs.statSync(scopeDir).isDirectory()) continue

    if (scope === 'general') {
      for (const file of fs.readdirSync(scopeDir)) {
        if (fs.statSync(path.join(scopeDir, file)).isFile()) {
          results.push({ filename: file, url: `/attachments/general/${file}`, scope: 'general', id: null })
        }
      }
    } else {
      for (const id of fs.readdirSync(scopeDir)) {
        const idDir = path.join(scopeDir, id)
        if (!fs.statSync(idDir).isDirectory()) continue
        for (const file of fs.readdirSync(idDir)) {
          if (fs.statSync(path.join(idDir, file)).isFile()) {
            results.push({ filename: file, url: `/attachments/${scope}/${id}/${file}`, scope, id })
          }
        }
      }
    }
  }
  res.json(results)
})

// GET /api/attachments/general — list files for general scope
app.get('/api/attachments/general', (req, res) => {
  const dir = attachmentDir('general', '')
  if (!fs.existsSync(dir)) return res.json([])
  const files = fs.readdirSync(dir).map(f => ({
    filename: f,
    url: `/attachments/general/${f}`,
  }))
  res.json(files)
})

// GET /api/attachments/:scope/:id — list files for scoped+id folder
app.get('/api/attachments/:scope/:id', (req, res) => {
  const { scope, id } = req.params
  const dir = attachmentDir(scope, id)
  if (!fs.existsSync(dir)) return res.json([])
  const files = fs.readdirSync(dir).map(f => ({
    filename: f,
    url: attachmentUrl(scope, id, f),
  }))
  res.json(files)
})

// DELETE /api/attachments/general/:filename
app.delete('/api/attachments/general/:filename', (req, res) => {
  const fp = path.join(attachmentDir('general', ''), req.params.filename)
  if (fs.existsSync(fp)) fs.unlinkSync(fp)
  res.json({ ok: true })
})

// DELETE /api/attachments/:scope/:id/:filename
app.delete('/api/attachments/:scope/:id/:filename', (req, res) => {
  const { scope, id, filename } = req.params
  const fp = path.join(attachmentDir(scope, id), filename)
  if (fs.existsSync(fp)) fs.unlinkSync(fp)
  res.json({ ok: true })
})

// --- Export as zip ---
app.get('/api/export', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="roa2-notes-backup.zip"')
  res.setHeader('Content-Type', 'application/zip')

  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.pipe(res)

  // Add notes JSON
  const notes = readAllNotes()
  archive.append(JSON.stringify(notes, null, 2), { name: 'notes-export.json' })

  // Add all attachments preserving folder structure
  if (fs.existsSync(ATTACHMENTS_DIR)) {
    archive.directory(ATTACHMENTS_DIR, 'attachments')
  }

  archive.finalize()
})

// --- Import from json or zip ---
app.post('/api/import', (req, res) => {
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
            notesCount = writeNotes(notes)
          } else if (entryName.startsWith('attachments/')) {
            const relPath = entryName.slice('attachments/'.length)
            const destPath = path.join(ATTACHMENTS_DIR, relPath)
            fs.mkdirSync(path.dirname(destPath), { recursive: true })
            fs.writeFileSync(destPath, entry.getData())
            attachmentsCount++
          }
        }
      } else {
        // JSON import
        const raw = fs.readFileSync(filePath, 'utf8')
        const notes = JSON.parse(raw)
        notesCount = writeNotes(notes)
      }

      fs.unlinkSync(filePath)
      res.json({ ok: true, notes: notesCount, attachments: attachmentsCount })
    } catch (e) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      res.status(400).json({ error: e.message })
    }
  })
})

// --- Update endpoints ---

app.get('/api/update/check', async (req, res) => {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { 'User-Agent': 'RoA2-Notes-App' },
    })
    if (!response.ok) return res.json({ error: 'Could not reach GitHub. Try again later.' })

    const release = await response.json()
    if (!release.tag_name) return res.json({ error: 'No releases found on GitHub.' })

    const latestVersion = release.tag_name.replace(/^v/, '')
    const hasUpdate = isNewerVersion(CURRENT_VERSION, latestVersion)
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
