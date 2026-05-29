import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CHARACTERS } from '../data/characters'
import { useWorkshopCharacters } from '../hooks/useNotes'
import AddWorkshopCharacterModal from './AddWorkshopCharacterModal'

const CHAR_COLORS = [
  'bg-orange-900', 'bg-blue-900', 'bg-sky-900', 'bg-stone-700',
  'bg-gray-700', 'bg-green-900', 'bg-purple-900', 'bg-cyan-900',
  'bg-pink-900', 'bg-teal-900', 'bg-yellow-900', 'bg-indigo-900',
  'bg-red-900', 'bg-violet-900', 'bg-emerald-900', 'bg-amber-900',
]

export default function CharacterGrid() {
  const [workshopChars, setWorkshopChars] = useWorkshopCharacters()
  const [showAddModal, setShowAddModal] = useState(false)

  function handleAdd(newChar) {
    setWorkshopChars([...(Array.isArray(workshopChars) ? workshopChars : []), newChar])
    setShowAddModal(false)
  }

  const workshop = Array.isArray(workshopChars) ? workshopChars : []

  const [officialOpen, setOfficialOpen] = useState(true)
  const [workshopOpen, setWorkshopOpen] = useState(true)

  return (
    <div className="p-4 space-y-4">
      {showAddModal && (
        <AddWorkshopCharacterModal
          onAdd={handleAdd}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      <section className="space-y-3">
        <button
          onClick={() => setOfficialOpen(o => !o)}
          className="flex items-center gap-2 w-full text-left"
        >
          <span className="text-sm font-semibold text-gray-300">Official Characters</span>
          <span className="text-gray-500 text-xs">{officialOpen ? '▲' : '▼'}</span>
        </button>
        {officialOpen && (
          <>
            <p className="text-sm text-gray-400 text-center">Click a character to write notes on how to fight them.</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {CHARACTERS.map((char, i) => (
                <Link
                  key={char.id}
                  to={`/character/${char.id}`}
                  className="flex flex-col items-center rounded-lg bg-[#16213e] hover:bg-[#0f3460] transition-colors overflow-hidden"
                >
                  {char.portraitUrl ? (
                    <img
                      src={char.portraitUrl}
                      alt={char.name}
                      className="w-full h-auto"
                    />
                  ) : (
                    <div className={`w-full aspect-[3/4] ${CHAR_COLORS[i % CHAR_COLORS.length]} flex items-center justify-center text-3xl font-bold text-white`}>
                      {char.name[0]}
                    </div>
                  )}
                  <span className="text-xs text-white text-center leading-tight py-2 px-1">
                    {char.name}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setWorkshopOpen(o => !o)}
            className="flex items-center gap-2 text-left"
          >
            <span className="text-sm font-semibold text-gray-300">Workshop Characters</span>
            <span className="text-gray-500 text-xs">{workshopOpen ? '▲' : '▼'}</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1 rounded-lg border border-[#e94560] text-[#e94560] text-xs hover:bg-[#e94560] hover:text-white transition-colors"
          >
            + Add
          </button>
        </div>

        {workshopOpen && (
          workshop.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No workshop characters yet. Add one to get started.</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {workshop.map((char, i) => (
                <Link
                  key={char.id}
                  to={`/workshop/${char.id}`}
                  className="flex flex-col items-center rounded-lg bg-[#16213e] hover:bg-[#0f3460] transition-colors overflow-hidden"
                >
                  {char.imageUrl ? (
                    <img
                      src={char.imageUrl}
                      alt={char.name}
                      className="w-full h-auto"
                    />
                  ) : (
                    <div className={`w-full aspect-[3/4] ${CHAR_COLORS[i % CHAR_COLORS.length]} flex items-center justify-center text-3xl font-bold text-white`}>
                      {char.name[0]}
                    </div>
                  )}
                  <span className="text-xs text-white text-center leading-tight py-2 px-1">
                    {char.name}
                  </span>
                </Link>
              ))}
            </div>
          )
        )}
      </section>
    </div>
  )
}
