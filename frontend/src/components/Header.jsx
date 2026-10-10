import './Header.css'
import { useLanguage } from '../i18n/LanguageContext'

function Header({ activePage = 'dashboard', onSelectPage, isDarkMode, onToggleTheme }) {
  const { lang, setLang, t } = useLanguage()

  const navItems = [
    { key: 'dashboard', label: t('nav.dashboard') },
    { key: 'weather', label: t('nav.weather') },
    { key: 'about', label: t('nav.about') },
  ]

  return (
    <header className="topbar">
      <div className="brand-wrap">
        <div className="brand-icon">
          <span className="brand-mark">◌</span>
        </div>
        <div className="brand-text">AeroPulse</div>
      </div>

      <nav className="main-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-button ${activePage === item.key ? 'active' : ''}`}
            onClick={() => onSelectPage?.(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="header-tools">
        <div className="lang-switch" role="group" aria-label="Language selector">
          <button
            type="button"
            className={`lang-btn ${lang === 'vi' ? 'active' : ''}`}
            onClick={() => setLang('vi')}
            aria-pressed={lang === 'vi'}
            title="Tiếng Việt"
          >
            VN
          </button>
          <span className="divider">|</span>
          <button
            type="button"
            className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
            title="English"
          >
            EN
          </button>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={isDarkMode ? t('nav.switchLight') : t('nav.switchDark')}
          aria-pressed={isDarkMode}
          onClick={onToggleTheme}
          title={isDarkMode ? t('nav.lightMode') : t('nav.darkMode')}
        >
          {isDarkMode ? '☼' : '☾'}
        </button>
      </div>
    </header>
  )
}

export default Header
