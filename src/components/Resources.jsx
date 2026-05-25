import WikiLink from './WikiLink'

const RESOURCES = [
  {
    label: 'Dragdown Wiki',
    description: 'In-depth breakdown of RoA2 system mechanics on the Dragdown wiki.',
    url: 'https://dragdown.wiki/wiki/RoA2',
  },
  {
    label: 'Rivals 2 VODs',
    description: 'Browse match VODs to study players and matchups.',
    url: 'https://www.rivals2vods.com/',
  },
  {
    label: 'Rivals 2 Discords',
    description: 'Find community and character-specific Discord servers.',
    url: 'https://dragdown.wiki/wiki/RoA2/Discords',
  },
  {
    label: 'Rivals Play Network',
    description: 'Discover local and online tournaments via Rivals Play Network.',
    url: 'https://rivalsplaynetwork.com/',
  },
  {
    label: 'Rivals 2 Nolt Board',
    description: 'Submit and vote on feature requests and feedback for Rivals of Aether II.',
    url: 'http://rivals2.com/nolt',
  },
  {
    label: "Watherum's Discord",
    description: "Join Watherum's Discord community.",
    url: 'http://watherum.gg/',
  },
]

export default function Resources() {
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 pb-12">
      <h1 className="text-2xl font-bold text-white pt-2">Resources</h1>
      {RESOURCES.map(r => (
        <WikiLink
          key={r.url}
          href={r.url}
          className="flex flex-col gap-1 w-full bg-[#16213e] rounded-lg px-5 py-4 border border-transparent hover:border-[#e94560] transition-colors group"
        >
          <span className="text-white font-semibold group-hover:text-[#e94560] transition-colors">{r.label}</span>
          <span className="text-sm text-gray-400">{r.description}</span>
          <span className="text-xs text-gray-600 mt-1 truncate">{r.url}</span>
        </WikiLink>
      ))}
    </div>
  )
}
