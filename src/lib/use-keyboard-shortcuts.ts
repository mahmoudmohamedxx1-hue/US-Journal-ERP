'use client'

import * as React from 'react'

/**
 * Global keyboard shortcuts hook.
 *
 * Usage:
 *   useKeyboardShortcuts({
 *     'ctrl+n': () => setView('journal-new'),
 *     'ctrl+/': () => focusSearch(),
 *   })
 */
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Build the key combination string
      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push('ctrl')
      if (e.shiftKey) parts.push('shift')
      if (e.altKey) parts.push('alt')
      parts.push(e.key.toLowerCase())
      const combo = parts.join('+')

      if (shortcuts[combo]) {
        e.preventDefault()
        shortcuts[combo]()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}
