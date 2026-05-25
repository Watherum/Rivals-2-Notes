import { useEffect, useRef, useState } from 'react'
import Lightbox from './Lightbox'
import ConfirmModal from './ConfirmModal'
import { authFetch } from '../utils/api'

const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i
const VIDEO_EXTS = /\.(mp4|webm|mov|avi|mkv)$/i

function apiUrl(scope, id) {
  if (scope === 'general') return '/api/attachments/general'
  return `/api/attachments/${scope}/${id}`
}

function deleteUrl(scope, id, filename) {
  if (scope === 'general') return `/api/attachments/general/${encodeURIComponent(filename)}`
  return `/api/attachments/${scope}/${id}/${encodeURIComponent(filename)}`
}

export default function AttachmentSection({ scope, id }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const [confirmFile, setConfirmFile] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    authFetch(apiUrl(scope, id))
      .then(r => r.json())
      .then(setFiles)
      .catch(() => {})
  }, [scope, id])

  async function handleUpload(e) {
    const selected = [...e.target.files]
    if (!selected.length) return
    setUploading(true)
    setUploadError(null)
    const form = new FormData()
    form.append('scope', scope)
    if (id) form.append('id', id)
    selected.forEach(f => form.append('files', f))

    try {
      const res = await authFetch('/api/attachments/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error || 'Upload failed.')
      } else if (data.files) {
        setFiles(prev => [...prev, ...data.files])
      }
    } catch {
      setUploadError('Upload failed — server unreachable.')
    }
    setUploading(false)
    e.target.value = ''
  }

  async function confirmDelete() {
    const filename = confirmFile
    setConfirmFile(null)
    await authFetch(deleteUrl(scope, id, filename), { method: 'DELETE' })
    setFiles(prev => prev.filter(f => f.filename !== filename))
  }

  return (
    <>
    {lightbox && <Lightbox url={lightbox.url} filename={lightbox.filename} onClose={() => setLightbox(null)} />}
    {confirmFile && <ConfirmModal message={`Delete "${confirmFile}"?`} onConfirm={confirmDelete} onCancel={() => setConfirmFile(null)} />}
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400 font-medium">Attachments</span>
        <button
          onClick={() => inputRef.current.click()}
          disabled={uploading}
          className="px-3 py-1 rounded border border-[#e94560] text-[#e94560] text-xs font-medium hover:bg-[#e94560] hover:text-white transition-colors disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : '+ Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
      </div>
      {uploadError && (
        <p className="text-xs text-red-400">{uploadError}</p>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {files.map(f => (
            <div key={f.filename} className="relative group">
              {IMAGE_EXTS.test(f.filename) ? (
                <button onClick={() => setLightbox(f)} className="block">
                  <img
                    src={f.url}
                    alt={f.filename}
                    className="h-24 w-24 object-cover rounded-lg border border-[#0f3460] group-hover:border-[#e94560] transition-colors"
                  />
                </button>
              ) : VIDEO_EXTS.test(f.filename) ? (
                <button onClick={() => setLightbox(f)} className="flex flex-col items-center justify-center h-24 w-24 rounded-lg border border-[#0f3460] bg-[#0f3460] hover:border-[#e94560] transition-colors gap-1 px-1">
                  <span className="text-2xl">🎬</span>
                  <span className="text-xs text-gray-400 text-center break-all leading-tight line-clamp-2">{f.filename}</span>
                </button>
              ) : (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center h-24 w-24 rounded-lg border border-[#0f3460] bg-[#0f3460] hover:border-[#e94560] transition-colors gap-1 px-1"
                >
                  <span className="text-2xl">📄</span>
                  <span className="text-xs text-gray-400 text-center break-all leading-tight line-clamp-2">{f.filename}</span>
                </a>
              )}
              <button
                onClick={() => setConfirmFile(f.filename)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#e94560] text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                aria-label={`Delete ${f.filename}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  )
}
