import { useEffect, useMemo, useState } from 'react';
import { NavLink, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import HomePage from './pages/StudioHomePage.jsx';
import ExercisesPage from './pages/ExercisesPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import {
  getPreferredLanguage,
  getPreferredVoiceStyle,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
  normalizeVoiceStyle,
  VOICE_STYLE_STORAGE_KEY,
} from './utils/language';
import './App.css';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [language, setLanguage] = useState(getPreferredLanguage);
  const [voiceStyle, setVoiceStyle] = useState(getPreferredVoiceStyle);
  const [isAuthed, setIsAuthed] = useState(() => !!localStorage.getItem('auth_token'));
  const navItems = useMemo(() => ([
    { to: '/', label: 'Home', public: true },
    { to: '/exercises', label: 'Exercise', public: false },
    { to: '/profile', label: 'Profile', public: false },
    { to: '/settings', label: 'Settings', public: false },
  ]), []);

  useEffect(() => {
    const syncAuth = () => setIsAuthed(!!localStorage.getItem('auth_token'));
    window.addEventListener('pose-auth-change', syncAuth);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener('pose-auth-change', syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  function handleLanguageChange(value) {
    const nextLanguage = normalizeLanguage(value);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    setLanguage(nextLanguage);
  }

  function handleVoiceStyleChange(value) {
    const nextStyle = normalizeVoiceStyle(value);
    localStorage.setItem(VOICE_STYLE_STORAGE_KEY, nextStyle);
    setVoiceStyle(nextStyle);
  }

  function handleLogout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth');
    setIsAuthed(false);
    navigate('/login');
  }

  function Protected({ children }) {
    if (!isAuthed) return <Navigate to="/login" replace />;
    return children;
  }

  return (
    <div className="neo-app">
      <div className="neo-layout">
        <aside className="neo-sidebar">
          <NavLink to="/" className="neo-brand" aria-label="Pose Coach home">
            <span className="neo-brand-mark">PC</span>
            <span><strong>POSE</strong><small>COACH STUDIO</small></span>
          </NavLink>
          <nav className="neo-nav" aria-label="Main navigation">
            {navItems.filter(item => item.public || isAuthed).map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `neo-nav-link ${isActive ? 'is-active' : ''}`}
                end={item.to === '/'}
              >
                <span className="neo-nav-icon" aria-hidden="true">{item.to === '/' ? '⌂' : item.to === '/exercises' ? '↗' : item.to === '/profile' ? '▦' : '⚙'}</span>
                {item.label}
              </NavLink>
            ))}
            {isAuthed ? (
              <button onClick={handleLogout} className="neo-nav-link neo-logout"><span className="neo-nav-icon" aria-hidden="true">↪</span>Log out</button>
            ) : (
              <NavLink to="/login" className={({ isActive }) => `neo-nav-link ${isActive ? 'is-active' : ''}`}><span className="neo-nav-icon" aria-hidden="true">↪</span>Sign in</NavLink>
            )}
          </nav>
          <div className="neo-sidebar-note"><span className="neo-dot" /> CAMERA-READY COACHING</div>
        </aside>
        <main className="neo-main">
          <div className="neo-topbar">
            <span className="neo-breadcrumb">STUDIO <span>›</span> {location.pathname.replace('/', '').toUpperCase() || 'HOME'}</span>
            <span className="neo-language-chip">VOICE · {language.toUpperCase()} / {voiceStyle.toUpperCase()}</span>
          </div>
          <div className="neo-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/exercises" element={<Protected><ExercisesPage language={language} onLanguageChange={handleLanguageChange} voiceStyle={voiceStyle} onVoiceStyleChange={handleVoiceStyleChange} /></Protected>} />
            <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
            <Route path="/settings" element={<Protected><SettingsPage language={language} onLanguageChange={handleLanguageChange} voiceStyle={voiceStyle} onVoiceStyleChange={handleVoiceStyleChange} /></Protected>} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
