import { useThemeStore } from '../../store/useThemeStore.js'

/** @param {{ variant?: 'nav' | 'chrome' }} props */
export function ThemeToggle({ variant = 'nav' }) {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      className={
        variant === 'chrome' ? 'theme-toggle theme-toggle--chrome' : 'theme-toggle theme-toggle--nav'
      }
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      aria-pressed={isLight}
      title={isLight ? 'Dark mode' : 'Light mode'}
    >
      <span className="theme-toggle__icon" aria-hidden>
        {isLight ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 14.5A7.5 7.5 0 0 1 9.5 3a7.5 7.5 0 1 0 11.5 11.5Z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
            <path
              d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
      {variant === 'chrome' ? (
        <span className="theme-toggle__label">
          {isLight ? 'Dark' : 'Light'}
        </span>
      ) : null}
    </button>
  )
}
