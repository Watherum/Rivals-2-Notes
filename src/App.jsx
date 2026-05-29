import { useState } from 'react'
import { Routes, Route, Link, useLocation, Navigate, Outlet } from 'react-router-dom'
import CharacterGrid from './components/CharacterGrid'
import CharacterPage from './components/CharacterPage'
import WorkshopCharacterPage from './components/WorkshopCharacterPage'
import MyMains from './components/MyMains'
import PlayerNotes from './components/PlayerNotes'
import GameNotes from './components/GameNotes'
import ManageData from './components/ManageData'
import AdminPanel from './components/AdminPanel'
import Resources from './components/Resources'
import Gallery from './components/Gallery'
import Login from './components/Login'
import Signup from './components/Signup'
import { useAuth } from './contexts/AuthContext'
import { useVersionCheck } from './hooks/useVersionCheck'

const LINKS = [
  { to: '/',          label: 'Roster' },
  { to: '/players',   label: 'Player Notes' },
  { to: '/mains',     label: 'My Mains' },
  { to: '/notes',     label: 'Game Notes' },
  { to: '/gallery',   label: 'Gallery' },
  { to: '/resources', label: 'Resources' },
  { to: '/manage',    label: 'Manage Data' },
]

function NavBar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  function linkClass(to) {
    return pathname === to ? 'text-[#e94560]' : 'text-gray-300 hover:text-white'
  }

  return (
    <nav className="bg-[#16213e] border-b border-[#0f3460] sticky top-0 z-10">
      <div className="px-4 py-3 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 mr-auto">
          <img src="/logos/RivalsOfAether2_Logo_Square_2k.png" alt="Rivals of Aether II" className="h-8 w-8 object-contain" />
          <span className="text-white font-bold text-lg">Rivals of Aether II</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {LINKS.map(l => (
            <Link key={l.to} to={l.to} className={`text-sm font-medium transition-colors ${linkClass(l.to)}`}>
              {l.label}
            </Link>
          ))}
          {user?.isAdmin && (
            <Link to="/admin" className={`text-sm font-medium transition-colors ${linkClass('/admin')}`}>
              Admin
            </Link>
          )}
          <div className="flex items-center gap-3 border-l border-[#0f3460] pl-6 ml-2">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#0f3460]" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#0f3460] flex items-center justify-center text-white text-xs font-bold select-none">
                {user?.username?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-sm text-gray-400">{user?.username}</span>
            <button
              onClick={logout}
              className="text-sm text-gray-300 hover:text-[#e94560] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="md:hidden flex flex-col gap-1.5 p-1"
          aria-label="Toggle menu"
        >
          <span className={`block w-6 h-0.5 bg-white transition-transform ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block w-6 h-0.5 bg-white transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-6 h-0.5 bg-white transition-transform ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-[#0f3460] flex flex-col">
          {LINKS.map(l => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              className={`px-4 py-3 text-sm font-medium border-b border-[#0f3460] transition-colors ${linkClass(l.to)}`}
            >
              {l.label}
            </Link>
          ))}
          {user?.isAdmin && (
            <Link
              to="/admin"
              onClick={() => setMenuOpen(false)}
              className={`px-4 py-3 text-sm font-medium border-b border-[#0f3460] transition-colors ${linkClass('/admin')}`}
            >
              Admin
            </Link>
          )}
          <div className="px-4 py-3 flex items-center justify-between border-b border-[#0f3460] last:border-0">
            <div className="flex items-center gap-2">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#0f3460]" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#0f3460] flex items-center justify-center text-white text-xs font-bold select-none">
                  {user?.username?.[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-sm text-gray-400">{user?.username}</span>
            </div>
            <button
              onClick={() => { setMenuOpen(false); logout() }}
              className="text-sm text-[#e94560] hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}

function Footer() {
  return (
    <footer className="border-t border-[#0f3460] mt-8 py-4 text-center text-sm text-gray-500 space-y-1">
      <div>
        Rivals of Aether II notes made by{' '}
        <a
          href="https://linktr.ee/watherum"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#e94560] hover:underline"
        >
          Watherum
        </a>
      </div>
      <div>
        <a
          href="https://ko-fi.com/watherum"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#e94560] hover:underline"
        >
          Support on Ko-fi
        </a>
      </div>
    </footer>
  )
}

function ProtectedLayout() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-[#1a1a2e]" />
  if (!user) return <Navigate to="/login" replace />
  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col">
      <NavBar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

function AdminGuard() {
  const { user } = useAuth()
  if (!user?.isAdmin) return <Navigate to="/" replace />
  return <AdminPanel />
}

export default function App() {
  useVersionCheck()
  return (
    <Routes>
      <Route path="/login"  element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<CharacterGrid />} />
        <Route path="/character/:characterId" element={<CharacterPage />} />
        <Route path="/workshop/:characterId" element={<WorkshopCharacterPage />} />
        <Route path="/players"   element={<PlayerNotes />} />
        <Route path="/mains"     element={<MyMains />} />
        <Route path="/notes"     element={<GameNotes />} />
        <Route path="/gallery"   element={<Gallery />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/manage"    element={<ManageData />} />
        <Route path="/admin"     element={<AdminGuard />} />
      </Route>
    </Routes>
  )
}
