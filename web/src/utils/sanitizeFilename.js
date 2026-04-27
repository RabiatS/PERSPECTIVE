/** Safe basename for download= (no path traversal, illegal Windows/mac chars). */
export function sanitizeFilename(name, fallback = 'dataset') {
  let base = String(name || '')
    .replace(/^[a-zA-Z]:\\|^\\\\|^\/+/g, '')
    .split(/[/\\]/)
    .pop()
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)

  base = [...base].filter((ch) => ch >= ' ').join('')

  return base || fallback
}
