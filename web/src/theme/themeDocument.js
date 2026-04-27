/** Must match `name` in useThemeStore persist config */
export const THEME_STORAGE_KEY = 'perspective-theme'

/**
 * Read theme from zustand-persist JSON before React hydrates (avoids flash).
 * @returns {'dark' | 'light'}
 */
export function readInitialTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (!raw) return 'dark'
    const parsed = JSON.parse(raw)
    const t = parsed?.state?.theme
    if (t === 'light' || t === 'dark') return t
  } catch {
    /* ignore */
  }
  return 'dark'
}

/** @param {'dark' | 'light'} theme */
export function applyDocumentTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.theme = t
  document.documentElement.style.colorScheme = t === 'light' ? 'light' : 'dark'
}
