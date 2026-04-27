import { useLayoutEffect } from 'react'
import { useThemeStore } from '../../store/useThemeStore.js'
import { applyDocumentTheme } from '../../theme/themeDocument.js'

/** Keeps `data-theme` on `<html>` in sync with persisted store */
export function ThemeSync() {
  const theme = useThemeStore((s) => s.theme)

  useLayoutEffect(() => {
    applyDocumentTheme(theme)
  }, [theme])

  return null
}
