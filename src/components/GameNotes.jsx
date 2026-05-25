import { useServerNote } from '../hooks/useNotes'
import AttachmentSection from './AttachmentSection'
import MarkdownEditor from './MarkdownEditor'

export default function GameNotes() {
  const [note, setNote, loaded] = useServerNote('game_general', '')

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 pb-12">
      <h1 className="text-2xl font-bold text-white pt-2">Game Notes</h1>
      <MarkdownEditor
        value={note}
        onChange={setNote}
        placeholder={loaded ? 'General game notes, mechanics, tournament prep, goals...' : 'Loading...'}
        disabled={!loaded}
        className="h-[70vh]"
      />
      <p className="text-xs text-gray-500">Auto-saved to notes/game-general.txt</p>
      <AttachmentSection scope="general" />
    </div>
  )
}
