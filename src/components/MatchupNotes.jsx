import { useState } from 'react'
import { CHARACTERS, characterWikiUrl } from '../data/characters'
import { useMatchupNote } from '../hooks/useNotes'
import WikiLink from './WikiLink'

function MatchupRow({ characterId, opponent }) {
  const [open, setOpen] = useState(false)
  const [note, setNote, loaded] = useMatchupNote(characterId, opponent.id)

  return (
    <div className="border border-[#0f3460] rounded-lg overflow-hidden mb-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex justify-between items-center px-4 py-3 bg-[#16213e] text-white text-left hover:bg-[#0f3460] transition-colors"
      >
        <span className="font-medium">{opponent.name}</span>
        <div className="flex items-center gap-3">
          {note && <span className="text-xs text-[#e94560]">has notes</span>}
          <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="p-4 bg-[#1a1a2e] space-y-3">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={loaded ? `Notes vs ${opponent.name}...` : 'Loading...'}
            disabled={!loaded}
            className="w-full h-32 bg-[#16213e] text-white rounded p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#e94560] placeholder-gray-500 disabled:opacity-50"
          />
          <WikiLink
            href={characterWikiUrl(opponent.wikiSlug)}
            className="inline-block text-sm text-[#e94560] underline hover:opacity-80"
          >
            View {opponent.name} on Wiki →
          </WikiLink>
        </div>
      )}
    </div>
  )
}

export default function MatchupNotes({ characterId }) {
  const opponents = CHARACTERS.filter(c => c.id !== characterId)

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Matchup Notes</h2>
      {opponents.map(opp => (
        <MatchupRow key={opp.id} characterId={characterId} opponent={opp} />
      ))}
    </section>
  )
}
