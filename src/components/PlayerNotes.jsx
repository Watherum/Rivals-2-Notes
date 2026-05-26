import { useState } from 'react'
import { CHARACTERS } from '../data/characters'
import { usePlayerList, usePlayerNote } from '../hooks/useNotes'
import { authFetch } from '../utils/api'
import MarkdownEditor from './MarkdownEditor'
import ConfirmModal from './ConfirmModal'

function CharacterPicker({ selectedId, onSelect }) {
  const [open, setOpen] = useState(false)
  const selected = CHARACTERS.find(c => c.id === selectedId)

  return (
    <div className="border border-[#0f3460] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex justify-between items-center px-3 py-2 bg-[#1a1a2e] text-sm hover:bg-[#0f3460] transition-colors"
      >
        <span className="text-gray-300">
          {selected ? (
            <span className="flex items-center gap-2 text-white">
              {selected.stockUrl && <img src={selected.stockUrl} alt="" className="w-5 h-5" />}
              {selected.name}
            </span>
          ) : (
            'Select main character (optional)'
          )}
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="p-2 grid grid-cols-4 sm:grid-cols-6 gap-1.5 bg-[#1a1a2e] border-t border-[#0f3460]">
          {CHARACTERS.map(char => (
            <button
              key={char.id}
              onClick={() => { onSelect(selectedId === char.id ? null : char.id); setOpen(false) }}
              title={char.name}
              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors ${
                selectedId === char.id ? 'bg-[#e94560]' : 'bg-[#16213e] hover:bg-[#0f3460]'
              }`}
            >
              {char.stockUrl && <img src={char.stockUrl} alt={char.name} className="w-7 h-7" />}
              <span className="text-[10px] text-gray-300 leading-tight text-center">{char.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PlayerCard({ player, players, setPlayers, onDelete }) {
  const [note, setNote, loaded] = usePlayerNote(player.id)

  function updateName(name) {
    setPlayers(players.map(p => p.id === player.id ? { ...p, name } : p))
  }

  function updateMain(mainCharId) {
    setPlayers(players.map(p => p.id === player.id ? { ...p, mainCharId } : p))
  }

  return (
    <div className="bg-[#16213e] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#0f3460]">
        <input
          type="text"
          value={player.name}
          onChange={e => updateName(e.target.value)}
          className="bg-transparent text-white font-medium focus:outline-none border-b border-transparent focus:border-[#e94560] min-w-0 flex-1 transition-colors"
          placeholder="Player name"
        />
        <button
          onClick={onDelete}
          className="ml-4 text-sm text-gray-400 hover:text-[#e94560] transition-colors flex-shrink-0"
        >
          Delete
        </button>
      </div>
      <div className="p-3 space-y-3">
        <CharacterPicker selectedId={player.mainCharId} onSelect={updateMain} />
        <MarkdownEditor
          value={note}
          onChange={setNote}
          placeholder={loaded ? `Notes on playing against ${player.name}...` : 'Loading...'}
          disabled={!loaded}
          className="h-32"
        />
      </div>
    </div>
  )
}

export default function PlayerNotes() {
  const [players, setPlayers, loaded] = usePlayerList()
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMainCharId, setNewMainCharId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  function addPlayer() {
    if (!newName.trim()) return
    const id = Date.now().toString()
    setPlayers([...players, { id, name: newName.trim(), mainCharId: newMainCharId }])
    setNewName('')
    setNewMainCharId(null)
    setAddingPlayer(false)
  }

  async function deletePlayer(id) {
    setPlayers(players.filter(p => p.id !== id))
    await authFetch(`/api/notes/${encodeURIComponent(`player_notes_${id}`)}`, { method: 'DELETE' })
    setConfirmDelete(null)
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 pb-12">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold text-white">Player Notes</h1>
        {!addingPlayer && (
          <button
            onClick={() => setAddingPlayer(true)}
            className="px-3 py-1.5 rounded-lg bg-[#e94560] text-white text-sm font-medium hover:bg-[#c73652] transition-colors"
          >
            + Add Player
          </button>
        )}
      </div>

      {addingPlayer && (
        <div className="bg-[#16213e] rounded-lg overflow-hidden border border-[#0f3460]">
          <div className="px-4 py-3 border-b border-[#0f3460]">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPlayer()}
              placeholder="Player name"
              autoFocus
              className="w-full bg-transparent text-white font-medium focus:outline-none placeholder-gray-500"
            />
          </div>
          <div className="p-3 space-y-3">
            <CharacterPicker selectedId={newMainCharId} onSelect={setNewMainCharId} />
            <div className="flex gap-2">
              <button
                onClick={addPlayer}
                disabled={!newName.trim()}
                className="px-4 py-1.5 rounded-lg bg-[#e94560] text-white text-sm font-medium hover:bg-[#c73652] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save
              </button>
              <button
                onClick={() => { setAddingPlayer(false); setNewName(''); setNewMainCharId(null) }}
                className="px-4 py-1.5 rounded-lg border border-[#0f3460] text-gray-300 text-sm hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loaded && players.length === 0 && !addingPlayer && (
        <p className="text-gray-500 text-sm">No players yet. Add one to get started.</p>
      )}

      {players.map(player => (
        <PlayerCard
          key={player.id}
          player={player}
          players={players}
          setPlayers={setPlayers}
          onDelete={() => setConfirmDelete(player.id)}
        />
      ))}

      {confirmDelete && (
        <ConfirmModal
          message={`Delete notes for "${players.find(p => p.id === confirmDelete)?.name}"?`}
          onConfirm={() => deletePlayer(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
