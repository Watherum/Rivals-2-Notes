import { useServerNote } from '../hooks/useNotes'
import AttachmentSection from './AttachmentSection'

export default function GameNotes() {
  const [note, setNote, loaded] = useServerNote('game_general', '')

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 pb-12">
      <h1 className="text-2xl font-bold text-white pt-2">Game Notes</h1>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder={loaded ? 'General game notes, mechanics, tournament prep, goals...' : 'Loading...'}
        disabled={!loaded}
        className="w-full h-[70vh] bg-[#16213e] text-white rounded-lg p-4 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#e94560] placeholder-gray-500 disabled:opacity-50"
      />
      <p className="text-xs text-gray-500">Auto-saved to notes/game-general.txt</p>
      <AttachmentSection scope="general" />
    </div>
  )
}
