import { useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useWorkshopCharacters, useWorkshopCharacterNote } from '../hooks/useNotes'
import { authFetch } from '../utils/api'
import MarkdownEditor from './MarkdownEditor'
import AttachmentSection from './AttachmentSection'
import ConfirmModal from './ConfirmModal'

export default function WorkshopCharacterPage() {
  const { characterId } = useParams()
  const navigate = useNavigate()
  const [characters, setCharacters] = useWorkshopCharacters()
  const [note, setNote, loaded] = useWorkshopCharacterNote(characterId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [modUrlInput, setModUrlInput] = useState(null)
  const [replacingImage, setReplacingImage] = useState(false)
  const imageInputRef = useRef(null)

  const character = Array.isArray(characters)
    ? characters.find(c => c.id === characterId)
    : null

  if (!character) {
    return (
      <div className="p-6 text-white">
        <p>Workshop character not found.</p>
        <Link to="/" className="text-[#e94560] underline">Back to roster</Link>
      </div>
    )
  }

  const displayModUrl = modUrlInput ?? character.modUrl ?? ''

  function saveModUrl() {
    if (modUrlInput === null) return
    const updated = characters.map(c =>
      c.id === characterId ? { ...c, modUrl: modUrlInput.trim() } : c
    )
    setCharacters(updated)
    setModUrlInput(null)
  }

  async function handleReplaceImage(e) {
    const file = e.target.files[0]
    if (!file) return
    setReplacingImage(true)

    try {
      // Delete the old image file to avoid orphans
      if (character.imageUrl) {
        const oldFilename = character.imageUrl.split('/').pop().split('?')[0]
        authFetch(`/api/attachments/workshop/${characterId}/${encodeURIComponent(oldFilename)}`, {
          method: 'DELETE',
        }).catch(() => {})
      }

      const form = new FormData()
      form.append('scope', 'workshop')
      form.append('id', characterId)
      form.append('files', file)

      const res = await authFetch('/api/attachments/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      const rawUrl = data.files?.[0]?.url
      if (!rawUrl) throw new Error('No image URL returned')
      const imageUrl = `${rawUrl}?v=${Date.now()}`

      setCharacters(characters.map(c =>
        c.id === characterId ? { ...c, imageUrl } : c
      ))
    } catch (err) {
      console.warn('Image replace failed:', err)
    }

    setReplacingImage(false)
    e.target.value = ''
  }

  async function handleDelete() {
    const updated = characters.filter(c => c.id !== characterId)
    setCharacters(updated)
    authFetch(`/api/notes/${encodeURIComponent(`notes_workshop_${characterId}`)}`, {
      method: 'DELETE',
    }).catch(() => {})
    navigate('/')
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 pb-12">
      {confirmDelete && (
        <ConfirmModal
          message={`Delete "${character.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      <div className="flex items-center justify-between pt-2">
        <Link
          to="/"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e94560] text-[#e94560] text-sm hover:bg-[#e94560] hover:text-white transition-colors"
        >
          ← Roster
        </Link>
        <h1 className="text-2xl font-bold text-white">{character.name}</h1>
        <button
          onClick={() => setConfirmDelete(true)}
          className="px-3 py-1.5 rounded-lg border border-gray-600 text-gray-400 text-sm hover:border-[#e94560] hover:text-[#e94560] transition-colors"
        >
          Delete
        </button>
      </div>

      <div className="flex justify-center">
        <div
          className="relative group cursor-pointer"
          onClick={() => imageInputRef.current?.click()}
        >
          {character.imageUrl ? (
            <img
              src={character.imageUrl}
              alt={character.name}
              className="max-h-64 rounded-xl object-contain border border-[#0f3460]"
            />
          ) : (
            <div className="w-32 h-40 rounded-xl border-2 border-dashed border-[#0f3460] flex items-center justify-center text-gray-500 text-sm">
              No image
            </div>
          )}
          <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-sm font-medium">
              {replacingImage ? 'Uploading…' : 'Replace Image'}
            </span>
          </div>
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleReplaceImage}
        />
      </div>

      <section>
        <MarkdownEditor
          value={note}
          onChange={setNote}
          placeholder={loaded ? `Notes on fighting ${character.name} — weaknesses, punishes, what to watch for...` : 'Loading...'}
          disabled={!loaded}
          className="h-[60vh]"
        />
        <AttachmentSection scope="workshop" id={characterId} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-400">Mod Link</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-[#0f1b35] border border-[#0f3460] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#e94560]"
            placeholder="https://..."
            value={displayModUrl}
            onChange={e => setModUrlInput(e.target.value)}
            onBlur={saveModUrl}
            onKeyDown={e => { if (e.key === 'Enter') { e.target.blur() } }}
          />
          {displayModUrl && (
            <a
              href={displayModUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg border border-[#e94560] text-[#e94560] text-sm hover:bg-[#e94560] hover:text-white transition-colors whitespace-nowrap"
            >
              Open Mod
            </a>
          )}
        </div>
      </section>
    </div>
  )
}
