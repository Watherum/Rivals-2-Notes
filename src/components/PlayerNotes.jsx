import { useState, useEffect } from 'react'
import { CHARACTERS } from '../data/characters'
import { usePlayerList, usePlayerNote, usePlayerCharNote } from '../hooks/useNotes'
import { authFetch } from '../utils/api'
import MarkdownEditor from './MarkdownEditor'
import ConfirmModal from './ConfirmModal'

function CharacterPicker({ selectedIds = [], onSelect, defaultOpen = false, disabled = false }) {
  const [open, setOpen] = useState(defaultOpen)

  function toggle(charId) {
    if (selectedIds.includes(charId)) {
      onSelect(selectedIds.filter(id => id !== charId))
    } else {
      onSelect([...selectedIds, charId])
    }
  }

  const selectedChars = CHARACTERS.filter(c => selectedIds.includes(c.id))

  return (
    <div className={`border border-[#0f3460] rounded-lg overflow-hidden ${disabled ? 'opacity-40' : ''}`}>
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        className="w-full flex justify-between items-center px-3 py-2 bg-[#1a1a2e] text-sm hover:bg-[#0f3460] transition-colors disabled:cursor-not-allowed disabled:hover:bg-[#1a1a2e]"
      >
        <span className="text-gray-300 min-w-0">
          Select characters{selectedChars.length > 0 ? ` (${selectedChars.length} selected)` : ' (optional)'}
        </span>
        <span className="text-gray-400 text-xs flex-shrink-0 ml-2">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="p-2 grid grid-cols-4 gap-1.5 bg-[#1a1a2e] border-t border-[#0f3460]">
          {CHARACTERS.map(char => (
            <button
              key={char.id}
              onClick={() => !disabled && toggle(char.id)}
              disabled={disabled}
              title={char.name}
              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors disabled:cursor-not-allowed ${
                selectedIds.includes(char.id) ? 'bg-[#e94560]' : 'bg-[#16213e] hover:bg-[#0f3460]'
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

function PlayerCharNote({ playerId, playerName, char }) {
  const [note, setNote, loaded] = usePlayerCharNote(playerId, char.id)
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="border border-[#0f3460] rounded-lg overflow-hidden">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[#1a1a2e] border-b border-[#0f3460] hover:bg-[#0f3460] transition-colors"
      >
        <span className="text-gray-400 text-xs flex-shrink-0">{collapsed ? '▶' : '▼'}</span>
        {char.stockUrl && <img src={char.stockUrl} alt="" className="w-5 h-5" />}
        <span className="text-sm font-medium text-white">{char.name}</span>
      </button>
      {!collapsed && (
        <div className="p-2">
          <MarkdownEditor
            value={note}
            onChange={setNote}
            placeholder={loaded ? `Notes vs ${playerName}'s ${char.name}...` : 'Loading...'}
            disabled={!loaded}
            className="h-28"
          />
        </div>
      )}
    </div>
  )
}

function PlayerCard({ player, players, setPlayers, onDelete }) {
  const [collapsed, setCollapsed] = useState(false)
  const [generalNote, setGeneralNote, generalLoaded] = usePlayerNote(player.id)
  const charIds = player.charIds ?? []
  const selectedChars = CHARACTERS.filter(c => charIds.includes(c.id))

  function updateName(name) {
    setPlayers(players.map(p => p.id === player.id ? { ...p, name } : p))
  }

  function updateChars(charIds) {
    setPlayers(players.map(p => p.id === player.id ? { ...p, charIds } : p))
  }

  return (
    <div className="bg-[#16213e] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-3 border-b border-[#0f3460]">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="text-gray-400 hover:text-white transition-colors text-xs pr-3 flex-shrink-0"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▶' : '▼'}
        </button>
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

      {!collapsed && (
        <div className="p-3 space-y-3">
          <CharacterPicker selectedIds={charIds} onSelect={updateChars} />
          {selectedChars.length > 0 ? (
            <div className="space-y-3">
              {selectedChars.map(char => (
                <PlayerCharNote
                  key={char.id}
                  playerId={player.id}
                  playerName={player.name}
                  char={char}
                />
              ))}
            </div>
          ) : (
            <MarkdownEditor
              value={generalNote}
              onChange={setGeneralNote}
              placeholder={generalLoaded ? `Notes on playing against ${player.name}...` : 'Loading...'}
              disabled={!generalLoaded}
              className="h-32"
            />
          )}
        </div>
      )}
    </div>
  )
}

export default function PlayerNotes() {
  const [players, setPlayers, loaded] = usePlayerList()
  const [migrated, setMigrated] = useState(false)
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCharIds, setNewCharIds] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Migrate old mainCharId format to charIds array
  useEffect(() => {
    if (!loaded || migrated) return
    const needsMigration = players.some(p => !('charIds' in p))
    if (needsMigration) {
      setPlayers(players.map(p =>
        'charIds' in p ? p : { id: p.id, name: p.name, charIds: p.mainCharId ? [p.mainCharId] : [] }
      ))
    }
    setMigrated(true)
  }, [loaded, migrated, players, setPlayers])

  const filteredPlayers = searchQuery.trim()
    ? players.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : players

  function addPlayer() {
    if (!newName.trim()) return
    const id = Date.now().toString()
    setPlayers([...players, { id, name: newName.trim(), charIds: newCharIds }])
    setNewName('')
    setNewCharIds([])
    setAddingPlayer(false)
  }

  async function deletePlayer(id) {
    setPlayers(players.filter(p => p.id !== id))
    await authFetch(`/api/notes/${encodeURIComponent(`player_notes_${id}`)}`, { method: 'DELETE' })
    setConfirmDelete(null)
  }

  return (
    <div className="max-w-screen-xl mx-auto p-4 pb-12 space-y-4">
      {/* Header row */}
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

      {/* Search bar */}
      {loaded && players.length > 0 && (
        <div className="relative max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search players..."
            className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-lg pl-8 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#e94560] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Add player modal */}
      {addingPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={e => { if (e.target === e.currentTarget) { setAddingPlayer(false); setNewName(''); setNewCharIds([]) } }}
        >
          <div className="w-full max-w-sm mx-4 bg-[#16213e] rounded-lg overflow-hidden border border-[#0f3460] shadow-xl">
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
              <CharacterPicker selectedIds={newCharIds} onSelect={setNewCharIds} defaultOpen disabled={!newName.trim()} />
              <div className="flex gap-2">
                <button
                  onClick={addPlayer}
                  disabled={!newName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-[#e94560] text-white text-sm font-medium hover:bg-[#c73652] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save
                </button>
                <button
                  onClick={() => { setAddingPlayer(false); setNewName(''); setNewCharIds([]) }}
                  className="px-4 py-1.5 rounded-lg border border-[#0f3460] text-gray-300 text-sm hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loaded && players.length === 0 && !addingPlayer && (
        <p className="text-gray-500 text-sm">No players yet. Add one to get started.</p>
      )}

      {loaded && players.length > 0 && filteredPlayers.length === 0 && (
        <p className="text-gray-500 text-sm">No players match "{searchQuery}".</p>
      )}

      {/* Responsive grid: 1 col mobile → 2 col md → 3 col xl */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {filteredPlayers.map(player => (
          <PlayerCard
            key={player.id}
            player={player}
            players={players}
            setPlayers={setPlayers}
            onDelete={() => setConfirmDelete(player.id)}
          />
        ))}
      </div>

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
