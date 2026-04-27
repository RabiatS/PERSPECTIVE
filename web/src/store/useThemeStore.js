import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyDocumentTheme, readInitialTheme } from '../theme/themeDocument.js'

const initialTheme = readInitialTheme()

export const useThemeStore = create(
  persist(
    (set, get) => ({
      /** @type {'dark' | 'light'} */
      theme: initialTheme,
      /** @param {'dark' | 'light'} theme */
      setTheme: (theme) => {
        const t = theme === 'light' ? 'light' : 'dark'
        set({ theme: t })
        applyDocumentTheme(t)
      },
      toggleTheme: () => {
        const t = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: t })
        applyDocumentTheme(t)
      },
    }),
    {
      name: 'perspective-theme',
      partialize: (s) => ({ theme: s.theme }),
      onRehydrateStorage: () => (state, error) => {
        if (!error && state?.theme) {
          applyDocumentTheme(state.theme)
        }
      },
    },
  ),
)
