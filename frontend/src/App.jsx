import { useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import Dashboard from './pages/Dashboard'
import WeatherPage from './pages/WeatherPage'
import About from './pages/About'
import { LanguageProvider } from './i18n/LanguageContext'

function AppContent() {
  const [activePage, setActivePage] = useState('dashboard')
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('aeropulse-theme') === 'dark')

  const toggleTheme = () => {
    setIsDarkMode((current) => {
      const nextValue = !current
      localStorage.setItem('aeropulse-theme', nextValue ? 'dark' : 'light')
      return nextValue
    })
  }

  const renderPage = () => {
    switch (activePage) {
      case 'weather':
        return <WeatherPage />
      case 'about':
        return <About />
      case 'dashboard':
      default:
        return <Dashboard />
    }
  }

  return (
    <div className={`app-shell ${isDarkMode ? 'dark-theme' : ''}`}>
      <Header
        activePage={activePage}
        onSelectPage={setActivePage}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />
      {renderPage()}
      <Footer />
    </div>
  )
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  )
}

export default App


