import { useEffect, useState } from 'react'
import { CHARACTERS } from '../data/characters'
import Lightbox from './Lightbox'
import ConfirmModal from './ConfirmModal'
import { authFetch } from '../utils/api'

const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i
const VIDEO_EXTS = /\.(mp4|webm|mov|avi|mkv)$/i

function sourceLabel(scope, id) {
  if (scope === 'general') return 'Game Notes'
  const char = CHARACTERS.find(c => c.id === id)
  const name = char ? char.name : id
  if (scope === 'mains') return `${name} — My Mains`
  return `${name} — Character Notes`
}

function groupAttachments(files) {
  const groups = {}
  for (const f of files) {
    const key = `${f.scope}:${f.id ?? ''}`
    if (!groups[key]) groups[key] = { scope: f.scope, id: f.id, files: [] }
    groups[key].files.push(f)
  }
  return Object.values(groups)
}

export default function Gallery() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)
  const [confirmFile, setConfirmFile] = useState(null)

  async function handleDelete(f) {
    const url = f.scope === 'general'
      ? `/api/attachments/general/${encodeURIComponent(f.filename)}`
      : `/api/attachments/${f.scope}/${f.id}/${encodeURIComponent(f.filename)}`
    await authFetch(url, { method: 'DELETE' })
    setGroups(prev =>
      prev
        .map(g => ({ ...g, files: g.files.filter(x => x.url !== f.url) }))
        .filter(g => g.files.length > 0)
    )
    if (lightbox?.url === f.url) setLightbox(null)
  }

  useEffect(() => {
    authFetch('/api/attachments')
      .then(r => r.json())
      .then(files => {
        setGroups(groupAttachments(files))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <>
      {lightbox && <Lightbox url={lightbox.url} filename={lightbox.filename} onClose={() => setLightbox(null)} />}
      {confirmFile && <ConfirmModal message={`Delete "${confirmFile.filename}"?`} onConfirm={() => { handleDelete(confirmFile); setConfirmFile(null) }} onCancel={() => setConfirmFile(null)} />}
      <div className="max-w-4xl mx-auto p-4 space-y-8 pb-12">
        <h1 className="text-2xl font-bold text-white pt-2">Gallery</h1>

        {loading && <p className="text-gray-400 text-sm">Loading…</p>}

        {!loading && groups.length === 0 && (
          <p className="text-gray-400 text-sm">No attachments uploaded yet. Add images or videos from any character, mains, or game notes page.</p>
        )}

        {groups.map(group => (
          <section key={`${group.scope}:${group.id}`} className="space-y-3">
            <h2 className="text-base font-semibold text-[#e94560] border-b border-[#0f3460] pb-1">
              {sourceLabel(group.scope, group.id)}
            </h2>
            <div className="flex flex-wrap gap-3">
              {group.files.map(f => (
                <div key={f.url} className="relative group">
                  {IMAGE_EXTS.test(f.filename) ? (
                    <button onClick={() => setLightbox(f)} className="block">
                      <img
                        src={f.url}
                        alt={f.filename}
                        className="h-28 w-28 object-cover rounded-lg border border-[#0f3460] group-hover:border-[#e94560] transition-colors"
                      />
                    </button>
                  ) : VIDEO_EXTS.test(f.filename) ? (
                    <button onClick={() => setLightbox(f)} className="flex flex-col items-center justify-center h-28 w-28 rounded-lg border border-[#0f3460] bg-[#16213e] hover:border-[#e94560] transition-colors gap-1 px-1">
                      <span className="text-3xl">🎬</span>
                      <span className="text-xs text-gray-400 text-center break-all leading-tight line-clamp-2">{f.filename}</span>
                    </button>
                  ) : (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center h-28 w-28 rounded-lg border border-[#0f3460] bg-[#16213e] hover:border-[#e94560] transition-colors gap-1 px-1"
                    >
                      <span className="text-3xl">📄</span>
                      <span className="text-xs text-gray-400 text-center break-all leading-tight line-clamp-2">{f.filename}</span>
                    </a>
                  )}
                  <button
                    onClick={() => setConfirmFile(f)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#e94560] text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                    aria-label={`Delete ${f.filename}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
