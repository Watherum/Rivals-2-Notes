import { useParams, Link } from 'react-router-dom'
import { CHARACTERS, characterWikiUrl, characterDataUrl } from '../data/characters'
import { useCharacterNote } from '../hooks/useNotes'
import WikiLink from './WikiLink'
import AttachmentSection from './AttachmentSection'

export default function CharacterPage() {
  const { characterId } = useParams()
  const character = CHARACTERS.find(c => c.id === characterId)
  const [note, setNote, loaded] = useCharacterNote(characterId)

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
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={loaded ? `Notes on fighting ${character.name} — weaknesses, punishes, what to watch for...` : 'Loading...'}
          disabled={!loaded}
          className="w-full h-[60vh] bg-[#16213e] text-white rounded-lg p-4 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#e94560] placeholder-gray-500 disabled:opacity-50"
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
    </div>
  )
}
