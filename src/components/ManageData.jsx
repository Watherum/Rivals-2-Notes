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

  const [githubPat, setGithubPat] = useState('')
  const [githubPatSet, setGithubPatSet] = useState(false)
  const [githubGistUrl, setGithubGistUrl] = useState(null)
  const [githubStatus, setGithubStatus] = useState(null)
  const [githubLoading, setGithubLoading] = useState(false)
  const [githubImportLoading, setGithubImportLoading] = useState(false)
  const [showPat, setShowPat] = useState(false)

  useEffect(() => {
    authFetch('/api/attachments/size').then(r => r.json()).then(d => setUsedBytes(d.bytes)).catch(() => {})
    authFetch('/api/settings').then(r => r.json()).then(d => {
      setLimitGB(d.attachmentLimitGB != null ? String(d.attachmentLimitGB) : '')
      setGithubPatSet(!!d.githubPatSet)
      setGithubGistUrl(d.githubGistUrl || null)
    }).catch(() => {})
  }, [])

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

  async function saveGithubToken() {
    setGithubStatus(null)
    const pat = githubPat.trim()
    try {
      const r = await authFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubPat: pat }),
      })
      if (!r.ok) {
        const d = await r.json()
        return setGithubStatus({ ok: false, message: d.error || 'Failed to save token.' })
      }
      setGithubPatSet(true)
      setGithubPat('')
      setShowPat(false)
      setGithubStatus({ ok: true, message: 'Token saved.' })
    } catch {
      setGithubStatus({ ok: false, message: 'Failed to save token.' })
    }
  }

  async function removeGithubToken() {
    setGithubStatus(null)
    try {
      const r = await authFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubPat: '' }),
      })
      if (!r.ok) {
        const d = await r.json()
        return setGithubStatus({ ok: false, message: d.error || 'Failed to remove token.' })
      }
      setGithubPatSet(false)
      setGithubGistUrl(null)
      setGithubPat('')
      setGithubStatus({ ok: true, message: 'Token removed.' })
    } catch {
      setGithubStatus({ ok: false, message: 'Failed to remove token.' })
    }
  }

  async function backupToGithub() {
    setGithubStatus(null)
    setGithubLoading(true)
    try {
      const r = await authFetch('/api/github-backup', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) return setGithubStatus({ ok: false, message: d.error || 'Backup failed.' })
      setGithubGistUrl(d.gistUrl)
      setGithubStatus({ ok: true, message: 'Backup complete!', gistUrl: d.gistUrl })
    } catch {
      setGithubStatus({ ok: false, message: 'Backup failed.' })
    } finally {
      setGithubLoading(false)
    }
  }

  async function importFromGithub() {
    setGithubStatus(null)
    setGithubImportLoading(true)
    try {
      const r = await authFetch('/api/github-import', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) return setGithubStatus({ ok: false, message: d.error || 'Import failed.' })
      setGithubStatus({ ok: true, message: `Import complete! ${d.notes} notes merged. Reloading…` })
      setTimeout(() => window.location.reload(), 1000)
    } catch {
      setGithubStatus({ ok: false, message: 'Import failed.' })
    } finally {
      setGithubImportLoading(false)
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
        <h2 className="text-lg font-semibold text-white">GitHub Backup</h2>
        <p className="text-sm text-gray-400">Back up your notes to a private GitHub Gist. Attachments are not included.</p>

        <details className="text-sm">
          <summary className="cursor-pointer text-[#e94560] hover:opacity-80 transition-opacity select-none">How to get a GitHub token</summary>
          <ol className="mt-2 space-y-1 text-gray-400 list-decimal list-inside pl-2">
            <li>Go to <strong className="text-gray-300">github.com</strong> → your profile picture → <strong className="text-gray-300">Settings</strong></li>
            <li>Scroll down and click <strong className="text-gray-300">Developer settings</strong></li>
            <li>Go to <strong className="text-gray-300">Personal access tokens</strong> → <strong className="text-gray-300">Tokens (classic)</strong></li>
            <li>Click <strong className="text-gray-300">Generate new token (classic)</strong></li>
            <li>Give it a name like <em className="text-gray-300">RoA2 Notes Backup</em> and check only the <code className="bg-[#0f3460] px-1 rounded text-gray-200">gist</code> scope</li>
            <li>Click <strong className="text-gray-300">Generate token</strong> — copy it immediately, you won&apos;t see it again</li>
          </ol>
        </details>

        <div className="space-y-2">
          {githubPatSet && (
            <p className="text-xs text-gray-400">A token is already saved. Enter a new one to replace it.</p>
          )}
          <div className="flex items-center gap-2">
            <input
              type={showPat ? 'text' : 'password'}
              placeholder={githubPatSet ? 'Enter new token to replace…' : 'ghp_…'}
              value={githubPat}
              onChange={e => { setGithubPat(e.target.value); setGithubStatus(null) }}
              className="flex-1 px-3 py-2 rounded-lg bg-[#0f3460] text-white text-sm border border-[#0f3460] focus:border-[#e94560] focus:outline-none placeholder-gray-500 font-mono"
            />
            <button
              onClick={() => setShowPat(v => !v)}
              className="px-3 py-2 rounded-lg bg-[#0f3460] text-gray-400 text-xs hover:text-white transition-colors whitespace-nowrap"
            >
              {showPat ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={saveGithubToken}
              disabled={!githubPat.trim()}
              className="px-4 py-2 rounded-lg border border-[#e94560] text-[#e94560] text-sm font-medium hover:bg-[#e94560] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Token
            </button>
            {githubPatSet && (
              <button
                onClick={removeGithubToken}
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-400 text-sm font-medium hover:border-red-500 hover:text-red-400 transition-colors"
              >
                Remove Token
              </button>
            )}
            <button
              onClick={backupToGithub}
              disabled={!githubPatSet || githubLoading}
              className="px-4 py-2 rounded-lg border border-[#e94560] text-[#e94560] text-sm font-medium hover:bg-[#e94560] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {githubLoading ? 'Backing up…' : 'Backup to GitHub'}
            </button>
            <button
              onClick={importFromGithub}
              disabled={!githubPatSet || !githubGistUrl || githubImportLoading}
              className="px-4 py-2 rounded-lg border border-[#e94560] text-[#e94560] text-sm font-medium hover:bg-[#e94560] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {githubImportLoading ? 'Importing…' : 'Import from GitHub'}
            </button>
          </div>
        </div>

        {githubGistUrl && !githubStatus?.gistUrl && (
          <p className="text-sm text-gray-400">
            Last backup: <a href={githubGistUrl} target="_blank" rel="noopener noreferrer" className="text-[#e94560] hover:underline">view on GitHub</a>
          </p>
        )}
        {githubStatus && (
          <p className={`text-sm ${githubStatus.ok ? 'text-green-400' : 'text-red-400'}`}>
            {githubStatus.message}
            {githubStatus.gistUrl && (
              <> — <a href={githubStatus.gistUrl} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">view on GitHub</a></>
            )}
          </p>
        )}
      </section>

      <section className="bg-[#16213e] rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">Import Notes</h2>
        <p className="text-sm text-gray-400">Restore notes and attachments from a previously exported backup. Accepts a <code className="text-gray-300">.zip</code> (notes + attachments) or a legacy <code className="text-gray-300">.json</code> file. Imported notes are appended to existing ones; mains and player lists are merged.</p>
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
