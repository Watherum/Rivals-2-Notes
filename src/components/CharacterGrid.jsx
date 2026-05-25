import { Link } from 'react-router-dom'
import { CHARACTERS } from '../data/characters'

const CHAR_COLORS = [
  'bg-orange-900', 'bg-blue-900', 'bg-sky-900', 'bg-stone-700',
  'bg-gray-700', 'bg-green-900', 'bg-purple-900', 'bg-cyan-900',
  'bg-pink-900', 'bg-teal-900', 'bg-yellow-900', 'bg-indigo-900',
  'bg-red-900', 'bg-violet-900', 'bg-emerald-900', 'bg-amber-900',
]

export default function CharacterGrid() {
  return (
    <div className="p-4 space-y-3">
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
    </div>
  )
}
