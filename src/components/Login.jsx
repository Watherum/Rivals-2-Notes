import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#16213e] rounded-xl p-8 space-y-6 border border-[#0f3460]">
        <div className="flex flex-col items-center gap-3">
          <img src="/logos/RivalsOfAether2_Logo_Square_2k.png" alt="RoA2" className="h-14 w-14 object-contain" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Rivals of Aether II Notes</h1>
            <p className="text-sm text-gray-400 mt-1">Sign in to your notes</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm text-gray-400">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              className="w-full px-3 py-2 rounded-lg bg-[#0f3460] text-white text-sm border border-[#0f3460] focus:border-[#e94560] focus:outline-none transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-lg bg-[#0f3460] text-white text-sm border border-[#0f3460] focus:border-[#e94560] focus:outline-none transition-colors"
            />
          </div>

          {error && <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 rounded-lg bg-[#e94560] text-white text-sm font-medium hover:bg-[#c73652] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400">
          No account?{' '}
          <Link to="/signup" className="text-[#e94560] hover:underline font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
