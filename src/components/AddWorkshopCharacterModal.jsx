import { useEffect, useRef, useState } from 'react'
import { authFetch } from '../utils/api'

export default function AddWorkshopCharacterModal({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [modUrl, setModUrl] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function handleImage(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !imageFile) return
    setUploading(true)
    setError(null)

    try {
      const id = Date.now().toString()

      const form = new FormData()
      form.append('scope', 'workshop')
      form.append('id', id)
      form.append('files', imageFile)

      const res = await authFetch('/api/attachments/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      const rawUrl = data.files?.[0]?.url
      if (!rawUrl) throw new Error('No image URL returned')
      const imageUrl = `${rawUrl}?v=${Date.now()}`

      onAdd({
        id,
        name: name.trim(),
        imageUrl,
        modUrl: modUrl.trim(),
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      setError(err.message)
      setUploading(false)
    }
  }

  const canSubmit = name.trim() && imageFile && !uploading

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onCancel}
    >
      <div
        className="bg-[#16213e] border border-[#0f3460] rounded-xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-white font-semibold text-lg">Add Workshop Character</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Name *</label>
            <input
              className="w-full bg-[#0f1b35] border border-[#0f3460] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#e94560]"
              placeholder="Character name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-400">Portrait Image *</label>
            <div
              className="border-2 border-dashed border-[#0f3460] rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-[#e94560] transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {preview ? (
                <img src={preview} alt="preview" className="max-h-32 rounded object-contain" />
              ) : (
                <span className="text-gray-500 text-sm">Click to choose image</span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImage}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-400">Mod URL (optional)</label>
            <input
              className="w-full bg-[#0f1b35] border border-[#0f3460] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#e94560]"
              placeholder="https://..."
              value={modUrl}
              onChange={e => setModUrl(e.target.value)}
            />
          </div>

          {error && <p className="text-[#e94560] text-xs">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white border border-[#0f3460] hover:border-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#e94560] text-white hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
