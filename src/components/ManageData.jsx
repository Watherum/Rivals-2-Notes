import { useEffect, useRef, useState } from 'react'
import { exportNotes, importNotes } from '../hooks/useNotes'

export default function ManageData() {
  const importRef = useRef(null)
  const [importStatus, setImportStatus] = useState(null)

  const [usedBytes, setUsedBytes] = useState(null)
  const [limitGB, setLimitGB] = useState('')
  const [limitStatus, setLimitStatus] = useState(null)

  useEffect(() => {
    fetch('/api/attachments/size').then(r => r.json()).then(d => setUsedBytes(d.bytes)).catch(() => {})
    fetch('/api/settings').then(r => r.json()).then(d => {
      setLimitGB(d.attachmentLimitGB != null ? String(d.attachmentLimitGB) : '')
    }).catch(() => {})
  }, [])

  async function saveLimit() {
    const val = parseFloat(limitGB)
    const attachmentLimitGB = limitGB === '' || isNaN(val) || val <= 0 ? null : val
    try {
      await fetch('/api/settings', {
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

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 pb-12">
      <h1 className="text-2xl font-bold text-white pt-2">Manage Data</h1>

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
