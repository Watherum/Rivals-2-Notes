import { useParams, Link } from 'react-router-dom'
import { CHARACTERS, characterWikiUrl, characterDataUrl, matchupBuddyUrl } from '../data/characters'
import { useCharacterNote, usePlayerList, usePlayerCharNote, useUserMains } from '../hooks/useNotes'
import WikiLink from './WikiLink'
import AttachmentSection from './AttachmentSection'
import MarkdownEditor from './MarkdownEditor'

function CharacterPlayerCard({ player, characterId }) {
  const [note, setNote, loaded] = usePlayerCharNote(player.id, characterId)
  return (
    <div className="bg-[#16213e] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#0f3460]">
        <span className="text-white font-medium">{player.name}</span>
      </div>
      <div className="p-3">
        <MarkdownEditor
          value={note}
          onChange={setNote}
          placeholder={loaded ? `Notes vs ${player.name}'s ${CHARACTERS.find(c => c.id === characterId)?.name ?? characterId}...` : 'Loading...'}
          disabled={!loaded}
          className="h-32"
        />
      </div>
    </div>
  )
}

export default function CharacterPage() {
  const { characterId } = useParams()
  const character = CHARACTERS.find(c => c.id === characterId)
  const [note, setNote, loaded] = useCharacterNote(characterId)
  const [players] = usePlayerList()
  const [mains] = useUserMains()
  const matchingPlayers = players.filter(p =>
    p.charIds?.includes(characterId) || p.mainCharId === characterId
  )

  if (!character) {
    return (
      <div className="p-6 text-white">
        <p>Character not found.</p>
        <Link to="/" className="text-[#e94560] underline">Back to roster</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 pb-12">
      <div className="flex items-center justify-between pt-2">
        <Link to="/" className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e94560] text-[#e94560] text-sm hover:bg-[#e94560] hover:text-white transition-colors">
          ← Roster
        </Link>
        <h1 className="text-2xl font-bold text-white">{character.name}</h1>
        <div className="w-24" />
      </div>

      <section>
        <MarkdownEditor
          value={note}
          onChange={setNote}
          placeholder={loaded ? `Notes on fighting ${character.name} — weaknesses, punishes, what to watch for...` : 'Loading...'}
          disabled={!loaded}
          className="h-[60vh]"
        />
        <p className="text-xs text-gray-500 mt-1">Auto-saved to notes/{character.id}.txt</p>
        <AttachmentSection scope="character" id={characterId} />
      </section>

      <WikiLink
        href={characterDataUrl(character.wikiSlug)}
        className="block w-full text-center py-2 rounded-lg border border-[#e94560] text-[#e94560] hover:bg-[#e94560] hover:text-white transition-colors"
      >
        Frame Data
      </WikiLink>

      <WikiLink
        href={characterWikiUrl(character.wikiSlug)}
        className="block w-full text-center py-2 rounded-lg border border-[#e94560] text-[#e94560] hover:bg-[#e94560] hover:text-white transition-colors"
      >
        View {character.name} Full Wiki Page
      </WikiLink>

      {mains.map(mainId => {
        const main = CHARACTERS.find(c => c.id === mainId)
        if (!main) return null
        return (
          <WikiLink
            key={mainId}
            href={matchupBuddyUrl(mainId, characterId)}
            className="block w-full text-center py-2 rounded-lg border border-[#e94560] text-[#e94560] hover:bg-[#e94560] hover:text-white transition-colors"
          >
            {main.name} Vs {character.name} (Matchup Buddy)
          </WikiLink>
        )
      })}

      {matchingPlayers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Players who main {character.name}</h2>
          {matchingPlayers.map(player => (
            <CharacterPlayerCard key={player.id} player={player} characterId={characterId} />
          ))}
        </section>
      )}
    </div>
  )
}
