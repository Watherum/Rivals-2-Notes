import { useEffect, useRef, useState } from 'react'
import { exportNotes, importNotes } from '../hooks/useNotes'
import { authFetch } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

export default function ManageData() {
  const { user, updateAvatar } = useAuth()
  const avatarRef = useRef(null)
  const [avatarStatus, setAvatarStatus] = useState(null)
  const [avatarLoading, setAvatarLoading] = useState(false)

  const importRef = useRef(null)
  const [importStatus, setImportStatus] = useState(null)

  const [usedBytes, setUsedBytes] = useState(null)
  const [limitGB, setLimitGB] = useState('')
  const [limitStatus, setLimitStatus] = useState(null)

  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwStatus, setPwStatus] = useState(null)
  const [pwLoading, setPwLoading] = useState(false)

  const [updatePhase, setUpdatePhase] = useState('idle')
  const [updateInfo, setUpdateInfo] = useState(null)
  const [updateError, setUpdateError] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const pollRef = useRef(null)

  useEffect(() => {
    authFetch('/api/attachments/size').then(r => r.json()).then(d => setUsedBytes(d.bytes)).catch(() => {})
    authFetch('/api/settings').then(r => r.json()).then(d => {
      setLimitGB(d.attachmentLimitGB != null ? String(d.attachmentLimitGB) : '')
    }).catch(() => {})
    fetch('/api/update/status').then(r => r.json()).then(data => {
      if (data.status === 'downloading') {
        setUpdatePhase('downloading')
        setDownloadProgress(data.progress)
        startPolling()
      } else if (data.status === 'ready') {
        setUpdatePhase('ready')
        setDownloadProgress(100)
      }
    }).catch(() => {})
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch('/api/update/status')
        const data = await r.json()
        setDownloadProgress(data.progress)
        if (data.status === 'ready') {
          clearInterval(pollRef.current)
          setUpdatePhase('ready')
        } else if (data.status === 'error') {
          clearInterval(pollRef.current)
          setUpdateError(data.error || 'Download failed.')
          setUpdatePhase('error')
        }
      } catch {}
    }, 1500)
  }

  async function checkForUpdates() {
    setUpdatePhase('checking')
    setUpdateError(null)
    try {
      const r = await fetch('/api/update/check')
      const data = await r.json()
      if (data.error) { setUpdateError(data.error); setUpdatePhase('error'); return }
      setUpdateInfo(data)
      setUpdatePhase(data.hasUpdate ? 'update_available' : 'up_to_date')
    } catch {
      setUpdateError('Could not reach the update server.')
      setUpdatePhase('error')
    }
  }

  async function downloadUpdate() {
    setUpdatePhase('downloading')
    setDownloadProgress(0)
    try {
      await fetch('/api/update/download', { method: 'POST' })
      startPolling()
    } catch {
      setUpdateError('Failed to start download.')
      setUpdatePhase('error')
    }
  }

  async function restartAndUpdate() {
    await fetch('/api/update/restart', { method: 'POST' })
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setAvatarStatus(null)
    setAvatarLoading(true)
    try {
      const form = new FormData()
      form.append('avatar', file)
      const r = await authFetch('/api/auth/avatar', { method: 'POST', body: form })
      const data = await r.json()
      if (!r.ok) return setAvatarStatus({ ok: false, message: data.error || 'Upload failed.' })
      updateAvatar(data.avatarUrl)
      setAvatarStatus({ ok: true, message: 'Profile photo updated.' })
    } catch {
      setAvatarStatus({ ok: false, message: 'Upload failed.' })
    } finally {
      setAvatarLoading(false)
      e.target.value = ''
    }
  }

  async function handleAvatarRemove() {
    setAvatarStatus(null)
    setAvatarLoading(true)
    try {
      const r = await authFetch('/api/auth/avatar', { method: 'DELETE' })
      if (!r.ok) return setAvatarStatus({ ok: false, message: 'Failed to remove photo.' })
      updateAvatar(null)
      setAvatarStatus({ ok: true, message: 'Profile photo removed.' })
    } catch {
      setAvatarStatus({ ok: false, message: 'Failed to remove photo.' })
    } finally {
      setAvatarLoading(false)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    setPwStatus(null)
    if (pwNew !== pwConfirm) return setPwStatus({ ok: false, message: 'New passwords do not match.' })
    if (pwNew.length < 6) return setPwStatus({ ok: false, message: 'New password must be at least 6 characters.' })
    setPwLoading(true)
    try {
      const r = await authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      })
      const data = await r.json()
      if (!r.ok) return setPwStatus({ ok: false, message: data.error || 'Failed to change password.' })
      setPwStatus({ ok: true, message: 'Password changed successfully.' })
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
    } catch {
      setPwStatus({ ok: false, message: 'Failed to change password.' })
    } finally {
      setPwLoading(false)
    }
  }

  async function saveLimit() {
    const val = parseFloat(limitGB)
    const attachmentLimitGB = limitGB === '' || isNaN(val) || val <= 0 ? null : val
    try {
      await authFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachmentLimitGB }),
      })
      setLimitStatus({ ok: true, message: attachmentLimitGB ? `Limit set to ${attachmentLimitGB} GB.` : 'Limit removed.' })
    } catch {
      setLimitStatus({ ok: false, message: 'Failed to save limit.' })
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const result = await importNotes(file)
      const parts = [`${result.notes} notes`]
      if (result.attachments) parts.push(`${result.attachments} attachments`)
      setImportStatus({ ok: true, message: `Successfully imported ${parts.join(' and ')}. Reload the page to see them.` })
    } catch {
      setImportStatus({ ok: false, message: 'Import failed — make sure the file is a valid RoA2 Notes backup (.json or .zip).' })
    }
    e.target.value = ''
  }

  const btnClass = 'px-4 py-2 rounded-lg border border-[#e94560] text-[#e94560] text-sm font-medium hover:bg-[#e94560] hover:text-white transition-colors'

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 pb-12">
      <h1 className="text-2xl font-bold text-white pt-2">Manage Data</h1>

      <section className="bg-[#16213e] rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">Profile Photo</h2>
        <div className="flex items-center gap-4">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover border-2 border-[#0f3460]" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#0f3460] flex items-center justify-center text-white text-xl font-bold select-none">
              {user?.username?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => avatarRef.current.click()}
              disabled={avatarLoading}
              className="px-4 py-2 rounded-lg border border-[#e94560] text-[#e94560] text-sm font-medium hover:bg-[#e94560] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {avatarLoading ? 'Uploading…' : user?.avatarUrl ? 'Change Photo' : 'Upload Photo'}
            </button>
            {user?.avatarUrl && (
              <button
                onClick={handleAvatarRemove}
                disabled={avatarLoading}
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-400 text-sm font-medium hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remove Photo
              </button>
            )}
          </div>
        </div>
        <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        {avatarStatus && (
          <p className={`text-sm ${avatarStatus.ok ? 'text-green-400' : 'text-red-400'}`}>{avatarStatus.message}</p>
        )}
      </section>

      <section className="bg-[#16213e] rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">Check for Updates</h2>
        <p className="text-sm text-gray-400">Check GitHub for the latest version of RoA2 Notes. If an update is found, it will be downloaded automatically and you'll be prompted to restart.</p>

        {updateInfo && (
          <p className="text-sm text-gray-400">
            Current version: <span className="text-white font-medium">v{updateInfo.currentVersion}</span>
          </p>
        )}

        {updatePhase === 'idle' && (
          <button onClick={checkForUpdates} className={btnClass}>Check for Updates</button>
        )}

        {updatePhase === 'checking' && (
          <p className="text-sm text-gray-400">Checking for updates…</p>
        )}

        {updatePhase === 'up_to_date' && (
          <div className="space-y-2">
            <p className="text-sm text-green-400">You're on the latest version (v{updateInfo?.currentVersion}).</p>
            <button onClick={checkForUpdates} className={btnClass}>Check Again</button>
          </div>
        )}

        {updatePhase === 'update_available' && updateInfo && (
          <div className="space-y-2">
            <p className="text-sm text-yellow-300">Update available: <span className="font-medium">v{updateInfo.latestVersion}</span></p>
            {updateInfo.isPackaged ? (
              <button onClick={downloadUpdate} className={btnClass}>Download & Install</button>
            ) : (
              <a href={updateInfo.releaseUrl} target="_blank" rel="noreferrer" className={`${btnClass} inline-block`}>
                Download from GitHub
              </a>
            )}
          </div>
        )}

        {updatePhase === 'downloading' && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Downloading update… {downloadProgress}%</p>
            <div className="w-full bg-[#0f3460] rounded-full h-2">
              <div className="bg-[#e94560] h-2 rounded-full transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
            </div>
          </div>
        )}

        {updatePhase === 'ready' && (
          <div className="space-y-2">
            <p className="text-sm text-green-400">Update downloaded. The app will restart to apply it.</p>
            <button onClick={restartAndUpdate} className={btnClass}>Restart & Update</button>
          </div>
        )}

        {updatePhase === 'error' && (
          <div className="space-y-2">
            <p className="text-sm text-red-400">{updateError || 'Something went wrong.'}</p>
            <button onClick={() => { setUpdatePhase('idle'); setUpdateError(null) }} className={btnClass}>Try Again</button>
          </div>
        )}
      </section>

      <section className="bg-[#16213e] rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">Export Notes</h2>
        <p className="text-sm text-gray-400">Download all your notes and attachments as a zip backup file. Use this to transfer data between devices or keep a backup.</p>
        <button
          onClick={exportNotes}
          className="px-4 py-2 rounded-lg border border-[#e94560] text-[#e94560] text-sm font-medium hover:bg-[#e94560] hover:text-white transition-colors"
        >
          Download Backup (.zip)
        </button>
      </section>

      <section className="bg-[#16213e] rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">Import Notes</h2>
        <p className="text-sm text-gray-400">Restore notes and attachments from a previously exported backup. Accepts a <code className="text-gray-300">.zip</code> (notes + attachments) or a legacy <code className="text-gray-300">.json</code> file. Existing data with matching keys will be overwritten.</p>
        <button
          onClick={() => importRef.current.click()}
          className="px-4 py-2 rounded-lg border border-[#e94560] text-[#e94560] text-sm font-medium hover:bg-[#e94560] hover:text-white transition-colors"
        >
          Choose Backup File
        </button>
        <input ref={importRef} type="file" accept=".json,.zip" onChange={handleImport} className="hidden" />
        {importStatus && (
          <p className={`text-sm mt-2 ${importStatus.ok ? 'text-green-400' : 'text-red-400'}`}>
            {importStatus.message}
          </p>
        )}
      </section>
      <section className="bg-[#16213e] rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div className="space-y-2">
            <input
              type="password"
              placeholder="Current password"
              value={pwCurrent}
              onChange={e => { setPwCurrent(e.target.value); setPwStatus(null) }}
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-lg bg-[#0f3460] text-white text-sm border border-[#0f3460] focus:border-[#e94560] focus:outline-none placeholder-gray-500"
            />
            <input
              type="password"
              placeholder="New password"
              value={pwNew}
              onChange={e => { setPwNew(e.target.value); setPwStatus(null) }}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg bg-[#0f3460] text-white text-sm border border-[#0f3460] focus:border-[#e94560] focus:outline-none placeholder-gray-500"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={pwConfirm}
              onChange={e => { setPwConfirm(e.target.value); setPwStatus(null) }}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg bg-[#0f3460] text-white text-sm border border-[#0f3460] focus:border-[#e94560] focus:outline-none placeholder-gray-500"
            />
          </div>
          <button
            type="submit"
            disabled={pwLoading || !pwCurrent || !pwNew || !pwConfirm}
            className="px-4 py-2 rounded-lg border border-[#e94560] text-[#e94560] text-sm font-medium hover:bg-[#e94560] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pwLoading ? 'Saving…' : 'Change Password'}
          </button>
          {pwStatus && (
            <p className={`text-sm ${pwStatus.ok ? 'text-green-400' : 'text-red-400'}`}>{pwStatus.message}</p>
          )}
        </form>
      </section>

      <section className="bg-[#16213e] rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">Attachment Storage</h2>
        <p className="text-sm text-gray-400">
          Set a maximum size for the attachments directory. Uploads that would exceed the limit are rejected.
          Leave blank or set to 0 for no limit.
        </p>
        {usedBytes != null && (
          <p className="text-sm text-gray-300">
            Currently using: <span className="text-white font-medium">{formatBytes(usedBytes)}</span>
            {limitGB && parseFloat(limitGB) > 0 && (
              <span className="text-gray-400"> / {limitGB} GB</span>
            )}
          </p>
        )}
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="No limit"
            value={limitGB}
            onChange={e => { setLimitGB(e.target.value); setLimitStatus(null) }}
            className="w-32 px-3 py-1.5 rounded-lg bg-[#0f3460] text-white text-sm border border-[#0f3460] focus:border-[#e94560] focus:outline-none"
          />
          <span className="text-sm text-gray-400">GB</span>
          <button
            onClick={saveLimit}
            className="px-4 py-1.5 rounded-lg border border-[#e94560] text-[#e94560] text-sm font-medium hover:bg-[#e94560] hover:text-white transition-colors"
          >
            Save
          </button>
        </div>
        {limitStatus && (
          <p className={`text-sm ${limitStatus.ok ? 'text-green-400' : 'text-red-400'}`}>{limitStatus.message}</p>
        )}
      </section>
    </div>
  )
}
