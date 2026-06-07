import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'

// Custom min / maximize-restore / close controls for the frameless window.
// Flush to the top-right corner, full title-bar height. `app-no-drag` keeps them
// clickable inside the draggable bar.
export function WindowControls() {
  const [maximized, setMaximized] = useState(false)
  useEffect(() => window.dscan.win.onMaximized(setMaximized), [])

  const base =
    'app-no-drag flex h-full w-11 items-center justify-center text-ink-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent'
  const neutral = 'hover:bg-paper hover:text-ink active:bg-line/60'

  return (
    <div className="app-no-drag flex items-stretch">
      <button
        aria-label="Minimize window"
        title="Minimize"
        onClick={() => window.dscan.win.minimize()}
        className={`${base} ${neutral}`}
      >
        <Minus size={15} strokeWidth={1.75} />
      </button>
      <button
        aria-label={maximized ? 'Restore window' : 'Maximize window'}
        title={maximized ? 'Restore' : 'Maximize'}
        onClick={() => window.dscan.win.maximize()}
        className={`${base} ${neutral}`}
      >
        {maximized ? (
          <Copy size={13} strokeWidth={1.75} />
        ) : (
          <Square size={13} strokeWidth={1.75} />
        )}
      </button>
      <button
        aria-label="Close window"
        title="Close"
        onClick={() => window.dscan.win.close()}
        className={`${base} hover:bg-[#e5484d] hover:text-white active:bg-[#c93b40]`}
      >
        <X size={15} strokeWidth={1.75} />
      </button>
    </div>
  )
}
