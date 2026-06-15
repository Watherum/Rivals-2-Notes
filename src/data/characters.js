export const CHARACTERS = [
  { id: 'zetterburn', name: 'Zetterburn', wikiSlug: 'Zetterburn', portraitUrl: '/portraits/zetterburn.png', stockUrl: '/stocks/zetterburn.png' },
  { id: 'orcane',     name: 'Orcane',     wikiSlug: 'Orcane',     portraitUrl: '/portraits/orcane.png',     stockUrl: '/stocks/orcane.png' },
  { id: 'wrastor',    name: 'Wrastor',    wikiSlug: 'Wrastor',    portraitUrl: '/portraits/wrastor.png',    stockUrl: '/stocks/wrastor.png' },
  { id: 'kragg',      name: 'Kragg',      wikiSlug: 'Kragg',      portraitUrl: '/portraits/kragg.png',      stockUrl: '/stocks/kragg.png' },
  { id: 'forsburn',   name: 'Forsburn',   wikiSlug: 'Forsburn',   portraitUrl: '/portraits/forsburn.png',   stockUrl: '/stocks/forsburn.png' },
  { id: 'maypul',     name: 'Maypul',     wikiSlug: 'Maypul',     portraitUrl: '/portraits/maypul.png',     stockUrl: '/stocks/maypul.png' },
  { id: 'absa',       name: 'Absa',       wikiSlug: 'Absa',       portraitUrl: '/portraits/absa.png',       stockUrl: '/stocks/absa.png' },
  { id: 'etalus',     name: 'Etalus',     wikiSlug: 'Etalus',     portraitUrl: '/portraits/etalus.png',     stockUrl: '/stocks/etalus.png' },
  { id: 'clairen',    name: 'Clairen',    wikiSlug: 'Clairen',    portraitUrl: '/portraits/clairen.png',    stockUrl: '/stocks/clairen.png' },
  { id: 'ranno',      name: 'Ranno',      wikiSlug: 'Ranno',      portraitUrl: '/portraits/ranno.png',      stockUrl: '/stocks/ranno.png' },
  { id: 'fleet',      name: 'Fleet',      wikiSlug: 'Fleet',      portraitUrl: '/portraits/fleet.png',      stockUrl: '/stocks/fleet.png' },
  { id: 'galvan',     name: 'Galvan',     wikiSlug: 'Galvan',     portraitUrl: '/portraits/galvan.png',     stockUrl: '/stocks/galvan.png' },
  { id: 'loxodont',  name: 'Loxodont',   wikiSlug: 'Loxodont',   portraitUrl: '/portraits/loxodont.png',   stockUrl: '/stocks/loxodont.png' },
  { id: 'olympia',   name: 'Olympia',    wikiSlug: 'Olympia',    portraitUrl: '/portraits/olympia.png',    stockUrl: '/stocks/olympia.png' },
  { id: 'slade',     name: 'Slade',      wikiSlug: 'Slade',      portraitUrl: '/portraits/slade.png',      stockUrl: '/stocks/slade.png' },
  { id: 'lareina',   name: 'La Reina',   wikiSlug: 'La_Reina',   portraitUrl: '/portraits/lareina.png',    stockUrl: '/stocks/lareina.png' },
].sort((a, b) => a.name.localeCompare(b.name))

const WIKI_BASE = 'https://dragdown.wiki/wiki/RoA2'

export function characterWikiUrl(wikiSlug) {
  return `${WIKI_BASE}/${encodeURIComponent(wikiSlug)}`
}

export function characterDataUrl(wikiSlug) {
  return `https://dragdown.wiki/wiki/Rivals_of_Aether_II/${encodeURIComponent(wikiSlug)}/Data`
}

export function frameDataUrl() {
  return `${WIKI_BASE}/Frame_Data`
}

const MATCHUP_BUDDY_SLUGS = { lareina: 'la-reina' }

export function matchupBuddySlug(id) {
  return MATCHUP_BUDDY_SLUGS[id] ?? id
}

export function matchupBuddyUrl(mainId, opponentId) {
  return `https://matchupbuddy.gg/${matchupBuddySlug(mainId)}/${matchupBuddySlug(opponentId)}`
}
