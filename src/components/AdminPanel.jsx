import { useState, useEffect, useCallback, useRef } from 'react'
import { authFetch } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function UserRow({ u, currentUsername, onLimitSaved, onDeleted }) {
  const [limitInput, setLimitInput] = useState(u.attachmentLimitGB != null ? String(u.attachmentLimitGB) : '')
  const [limitStatus, setLimitStatus] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetPw, setResetPw] = useState('')
  const [resetStatus, setResetStatus] = useState(null)

  async function saveLimit() {
    setBusy(true)
    setLimitStatus(null)
    try {
      const limitGB = limitInput.trim() === '' || parseFloat(limitInput) <= 0 ? null : parseFloat(limitInput)
      const res = await authFetch(`/api/admin/users/${encodeURIComponent(u.username)}/limit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limitGB }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setLimitStatus({ ok: true, message: 'Saved' })
      onLimitSaved(u.username, limitGB)
    } catch (e) {
      setLimitStatus({ ok: false, message: e.message })
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    setBusy(true)
    setResetStatus(null)
    try {
      const res = await authFetch(`/api/admin/users/${encodeURIComponent(u.username)}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResetStatus({ ok: true, message: 'Password reset.' })
      setResetting(false)
      setResetPw('')
    } catch (e) {
      setResetStatus({ ok: false, message: e.message })
    } finally {
      setBusy(false)
    }
  }

  async function deleteUser() {
    setBusy(true)
    try {
      const res = await authFetch(`/api/admin/users/${encodeURIComponent(u.username)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      onDeleted(u.username)
    } catch (e) {
      setLimitStatus({ ok: false, message: e.message })
      setBusy(false)
      setConfirming(false)
    }
  }

  const isSelf = u.username === currentUsername

  return (
    <tr className="border-b border-[#0f3460] last:border-0">
      <td className="py-3 pr-4 text-sm text-white">
        {u.username}
        {isSelf && <span className="ml-2 text-xs text-[#e94560] font-medium">(you)</span>}
        {u.isAdmin && !isSelf && <span className="ml-2 text-xs text-yellow-400 font-medium">(admin)</span>}
      </td>
      <td className="py-3 pr-4 text-sm text-gray-400 whitespace-nowrap">
        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
      </td>
      <td className="py-3 pr-4 text-sm text-gray-300 whitespace-nowrap">
        {formatBytes(u.usedBytes)}
        {u.attachmentLimitGB != null && (
          <span className="text-gray-500"> / {u.attachmentLimitGB} GB</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="No limit"
            value={limitInput}
            onChange={e => { setLimitInput(e.target.value); setLimitStatus(null) }}
            className="w-28 px-3 py-1 rounded-lg bg-[#0f3460] text-white text-sm border border-[#0f3460] focus:border-[#e94560] focus:outline-none"
          />
          <span className="text-xs text-gray-500">GB</span>
          <button
            onClick={saveLimit}
            disabled={busy}
            className="px-3 py-1 rounded-lg border border-[#e94560] text-[#e94560] text-xs font-medium hover:bg-[#e94560] hover:text-white transition-colors disabled:opacity-50"
          >
            Save
          </button>
          {limitStatus && (
            <span className={`text-xs ${limitStatus.ok ? 'text-green-400' : 'text-red-400'}`}>
              {limitStatus.message}
            </span>
          )}
        </div>
      </td>
      <td className="py-3 pr-4">
        {isSelf ? (
          <span className="text-xs text-gray-600">—</span>
        ) : resetting ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <input
                type="password"
                placeholder="New password"
                value={resetPw}
                onChange={e => { setResetPw(e.target.value); setResetStatus(null) }}
                className="w-36 px-3 py-1 rounded-lg bg-[#0f3460] text-white text-sm border border-[#0f3460] focus:border-[#e94560] focus:outline-none placeholder-gray-500"
              />
              <button
                onClick={resetPassword}
                disabled={busy || resetPw.length < 6}
                className="px-3 py-1 rounded-lg bg-[#e94560] text-white text-xs font-medium hover:bg-[#c73652] transition-colors disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => { setResetting(false); setResetPw(''); setResetStatus(null) }}
                disabled={busy}
                className="px-3 py-1 rounded-lg border border-gray-600 text-gray-400 text-xs hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            {resetStatus && (
              <span className={`text-xs ${resetStatus.ok ? 'text-green-400' : 'text-red-400'}`}>{resetStatus.message}</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <button
              onClick={() => { setResetting(true); setResetStatus(null) }}
              className="px-3 py-1 rounded-lg border border-gray-600 text-gray-400 text-xs font-medium hover:border-[#e94560] hover:text-[#e94560] transition-colors w-fit"
            >
              Reset PW
            </button>
            {resetStatus?.ok && (
              <span className="text-xs text-green-400">{resetStatus.message}</span>
            )}
          </div>
        )}
      </td>
      <td className="py-3">
        {isSelf ? (
          <span className="text-xs text-gray-600">—</span>
        ) : confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Delete {u.username}?</span>
            <button
              onClick={deleteUser}
              disabled={busy}
              className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="px-3 py-1 rounded-lg border border-gray-600 text-gray-400 text-xs hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="px-3 py-1 rounded-lg border border-red-700 text-red-400 text-xs font-medium hover:bg-red-700 hover:text-white transition-colors"
          >
            Delete
          </button>
        )}
      </td>
    </tr>
  )
}

export default function AdminPanel() {
  const { user } = useAuth()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  const [updatePhase, setUpdatePhase] = useState('idle')
  const [updateInfo, setUpdateInfo] = useState(null)
  const [updateError, setUpdateError] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [updateAssetName, setUpdateAssetName] = useState(null)
  const [updatePhaseLabel, setUpdatePhaseLabel] = useState(null)
  const pollRef = useRef(null)

  function getPhaseLabel(phase) {
    const labels = { downloading: 'Downloading update...', extracting: 'Extracting files...', installing: 'Running npm install...', building: 'Building app...' }
    return labels[phase] || 'Updating...'
  }

  const loadUsers = useCallback(async () => {
    setError(null)
    try {
      const res = await authFetch('/api/admin/users')
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load users')
      setUsers(await res.json())
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    loadUsers()
    fetch('/api/update/status').then(r => r.json()).then(data => {
      if (data.status === 'downloading') {
        setUpdatePhase('downloading')
        setDownloadProgress(data.progress)
        if (data.phase) setUpdatePhaseLabel(getPhaseLabel(data.phase))
        startPolling()
      } else if (data.status === 'ready') {
        setUpdatePhase('ready')
        setDownloadProgress(100)
        if (data.assetName) setUpdateAssetName(data.assetName)
      }
    }).catch(() => {})
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadUsers])

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch('/api/update/status')
        const data = await r.json()
        setDownloadProgress(data.progress)
        if (data.phase) setUpdatePhaseLabel(getPhaseLabel(data.phase))
        if (data.status === 'ready') {
          clearInterval(pollRef.current)
          setUpdatePhase('ready')
          setUpdatePhaseLabel(null)
          if (data.assetName) setUpdateAssetName(data.assetName)
        } else if (data.status === 'error') {
          clearInterval(pollRef.current)
          setUpdateError(data.error || 'Download failed.')
          setUpdatePhase('error')
          setUpdatePhaseLabel(null)
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

  async function openUpdateFolder() {
    await fetch('/api/update/open-folder', { method: 'POST' })
  }

  async function exitAndUpdate() {
    await fetch('/api/update/restart', { method: 'POST' })
  }

  const btnClass = 'px-4 py-2 rounded-lg border border-[#e94560] text-[#e94560] text-sm font-medium hover:bg-[#e94560] hover:text-white transition-colors'

  function handleLimitSaved(username, limitGB) {
    setUsers(prev => prev.map(u => u.username === username ? { ...u, attachmentLimitGB: limitGB } : u))
  }

  function handleDeleted(username) {
    setUsers(prev => prev.filter(u => u.username !== username))
  }

  const filteredUsers = users
    ? users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()))
    : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">Admin Panel</h1>

      <section className="bg-[#16213e] rounded-lg p-5 space-y-2">
        <h2 className="text-lg font-semibold text-white">Promote a User to Admin</h2>
        <p className="text-sm text-gray-400">
          To grant admin access to a user, set <code className="bg-[#0f3460] px-1 rounded text-gray-200">isAdmin: true</code> for their entry in <code className="bg-[#0f3460] px-1 rounded text-gray-200">users.json</code>.
        </p>
      </section>

      <section className="bg-[#16213e] rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">Check for Updates</h2>
        <p className="text-sm text-gray-400">
          {updateInfo?.isPackaged === false
            ? 'Check GitHub for the latest version of RoA2 Notes. If an update is found, source files will be updated and rebuilt automatically — restart the server to apply.'
            : 'Check GitHub for the latest version of RoA2 Notes. If an update is found, it will be downloaded to the same folder as the current exe — then close this app and run the new file to update.'}
        </p>

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
            {updateInfo.isPackaged || updateInfo.tarballUrl ? (
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
            <p className="text-sm text-gray-400">
              {updatePhaseLabel ? `${updatePhaseLabel} (${downloadProgress}%)` : `Downloading update… ${downloadProgress}%`}
            </p>
            <div className="w-full bg-[#0f3460] rounded-full h-2">
              <div className="bg-[#e94560] h-2 rounded-full transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
            </div>
          </div>
        )}

        {updatePhase === 'ready' && (
          <div className="space-y-3">
            <div>
              <p className="text-sm text-green-400">
                {updateInfo?.isPackaged
                  ? `Update downloaded${updateAssetName ? `: ${updateAssetName}` : '.'}`
                  : 'Update installed successfully.'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {updateInfo?.isPackaged
                  ? 'Close this app and run the new file from the same folder to complete the update.'
                  : 'Restart the app to use the new version.'}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {updateInfo?.isPackaged && (
                <button onClick={openUpdateFolder} className={btnClass}>Open Folder</button>
              )}
              <button onClick={exitAndUpdate} className={btnClass}>
                {updateInfo?.isPackaged ? 'Exit App' : 'Restart App'}
              </button>
            </div>
          </div>
        )}

        {updatePhase === 'error' && (
          <div className="space-y-2">
            <p className="text-sm text-red-400">{updateError || 'Something went wrong.'}</p>
            <button onClick={() => { setUpdatePhase('idle'); setUpdateError(null) }} className={btnClass}>Try Again</button>
          </div>
        )}
      </section>

      <section className="bg-[#16213e] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">User Management</h2>
          <button
            onClick={loadUsers}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>

        <input
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-xs px-3 py-2 rounded-lg bg-[#0f3460] text-white text-sm border border-[#0f3460] focus:border-[#e94560] focus:outline-none placeholder-gray-500"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        {users === null && !error && (
          <p className="text-sm text-gray-400">Loading…</p>
        )}

        {users !== null && users.length === 0 && (
          <p className="text-sm text-gray-400">No users found.</p>
        )}

        {users !== null && users.length > 0 && filteredUsers.length === 0 && (
          <p className="text-sm text-gray-400">No users match "{search}".</p>
        )}

        {filteredUsers !== null && filteredUsers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#0f3460]">
                  <th className="pb-2 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Username</th>
                  <th className="pb-2 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                  <th className="pb-2 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Storage Used</th>
                  <th className="pb-2 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Limit</th>
                  <th className="pb-2 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Reset PW</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <UserRow
                    key={u.username}
                    u={u}
                    currentUsername={user?.username}
                    onLimitSaved={handleLimitSaved}
                    onDeleted={handleDeleted}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
