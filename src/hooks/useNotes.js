import { useState, useEffect, useRef, useCallback } from 'react'
import { authFetch, getToken } from '../utils/api'

const API = '/api'

// In-memory cache populated once on first use
let cache = null
let cachePromise = null

export function clearNotesCache() {
  cache = null
  cachePromise = null
}

async function loadCache() {
  if (cache) return cache
  if (!cachePromise) {
    cachePromise = authFetch(`${API}/notes`)
      .then(r => { if (!r.ok) throw new Error('Auth'); return r.json() })
      .then(data => { cache = data; return cache })
      .catch(() => { cache = {}; return cache })
  }
  return cachePromise
}

function saveToServer(key, value) {
  authFetch(`${API}/notes/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  }).catch(err => console.warn('Save failed:', err))
}

// Generic hook: loads initial value from server cache, saves with debounce
export function useServerNote(key, defaultValue) {
  const [value, setValue] = useState(defaultValue)
  const [loaded, setLoaded] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    loadCache().then(data => {
      if (key in data) setValue(data[key])
      setLoaded(true)
    })
  }, [key])

  const set = useCallback((newValue) => {
    setValue(newValue)
    if (cache) cache[key] = newValue
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveToServer(key, newValue), 500)
  }, [key])

  return [value, set, loaded]
}

export function useCharacterNote(characterId) {
  return useServerNote(`notes_${characterId}`, '')
}

export function useMainNote(characterId) {
  return useServerNote(`main_notes_${characterId}`, '')
}

export function useMatchupNote(characterId, opponentId) {
  return useServerNote(`matchup_${characterId}_vs_${opponentId}`, '')
}

export function useUserMains() {
  return useServerNote('user_mains', [])
}

export function exportNotes() {
  const token = getToken()
  const a = document.createElement('a')
  a.href = `${API}/export${token ? `?token=${encodeURIComponent(token)}` : ''}`
  a.download = 'roa2-notes-backup.zip'
  a.click()
}

export async function importNotes(file) {
  let res
  if (file.name.endsWith('.zip')) {
    const form = new FormData()
    form.append('backup', file)
    res = await authFetch(`${API}/import`, { method: 'POST', body: form })
  } else {
    const text = await file.text()
    const notes = JSON.parse(text)
    const form = new FormData()
    form.append('backup', new Blob([JSON.stringify(notes)], { type: 'application/json' }), file.name)
    res = await authFetch(`${API}/import`, { method: 'POST', body: form })
  }
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Import failed')
  clearNotesCache()
  return data
}
