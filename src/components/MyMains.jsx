import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CHARACTERS, characterWikiUrl, characterDataUrl } from '../data/characters'
import { useUserMains, useMainNote } from '../hooks/useNotes'
import WikiLink from './WikiLink'
import AttachmentSection from './AttachmentSection'
import MarkdownEditor from './MarkdownEditor'

function MainCharacterSection({ char }) {
  const [note, setNote, loaded] = useMainNote(char.id)
  const [collapsed, setCollapsed] = useState(false)
  const cardRef = useRef(null)

  return (
    <div ref={cardRef} className="bg-[#16213e] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#0f3460]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
            setCollapsed(v => {
              if (!v && cardRef.current) cardRef.current.style.width = ''
              return !v
            })
          }}
            className="text-gray-400 hover:text-white transition-colors text-xs flex-shrink-0"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
          <Link
            to={`/character/${char.id}`}
            className="flex items-center gap-2 text-white font-medium hover:text-[#e94560] transition-colors min-w-0"
          >
            {char.stockUrl && <img src={char.stockUrl} alt="" className="w-7 h-7" />}
            {char.name}
          </Link>
        </div>
        <div className="flex gap-2">
          <WikiLink
            href={characterWikiUrl(char.wikiSlug)}
            className="px-3 py-1 rounded-lg border border-[#e94560] text-[#e94560] text-sm hover:bg-[#e94560] hover:text-white transition-colors"
          >
            Wiki
          </WikiLink>
          <WikiLink
            href={characterDataUrl(char.wikiSlug)}
            className="px-3 py-1 rounded-lg border border-[#e94560] text-[#e94560] text-sm hover:bg-[#e94560] hover:text-white transition-colors"
          >
            Frame Data
          </WikiLink>
        </div>
      </div>
      {!collapsed && (
        <div className="p-3">
          <MarkdownEditor
            value={note}
            onChange={setNote}
            placeholder={loaded ? `Things to work on, goals, habits to build with ${char.name}...` : 'Loading...'}
            disabled={!loaded}
            className="h-32"
            onResize={w => { if (cardRef.current) cardRef.current.style.width = (w + 24) + 'px' }}
          />
          <AttachmentSection scope="mains" id={char.id} />
        </div>
      )}
    </div>
  )
}

export default function MyMains() {
  const [mains, setMains] = useUserMains()
  const [selectorOpen, setSelectorOpen] = useState(false)

  function toggleMain(id) {
    setMains(
      mains.includes(id)
        ? mains.filter(m => m !== id)
        : [...mains, id]
    )
  }

  const mainCharacters = CHARACTERS.filter(c => mains.includes(c.id))

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 pb-12">
      <h1 className="text-2xl font-bold text-white pt-2">My Mains</h1>

      {mainCharacters.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">My Characters</h2>
          {mainCharacters.map(char => (
            <MainCharacterSection key={char.id} char={char} />
          ))}
        </section>
      )}

      <section className="border border-[#0f3460] rounded-lg overflow-hidden">
        <button
          onClick={() => setSelectorOpen(v => !v)}
          className="w-full flex justify-between items-center px-4 py-3 bg-[#16213e] text-white hover:bg-[#0f3460] transition-colors"
        >
          <span className="font-semibold">Select Your Mains</span>
          <span className="text-gray-400 text-sm">{selectorOpen ? '▲' : '▼'}</span>
        </button>
        {selectorOpen && (
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#1a1a2e]">
            {CHARACTERS.map(char => (
              <button
                key={char.id}
                onClick={() => toggleMain(char.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mains.includes(char.id)
                    ? 'bg-[#e94560] text-white'
                    : 'bg-[#16213e] text-gray-300 hover:bg-[#0f3460]'
                }`}
              >
                {char.stockUrl && <img src={char.stockUrl} alt="" className="w-5 h-5" />}
                {char.name}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
