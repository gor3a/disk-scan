export function CleaningScreen() {
  return (
    <div className="grid min-h-screen place-items-center px-10 text-center">
      <div className="rise">
        <div className="mx-auto mb-7 h-12 w-12 animate-spin rounded-full border-[3px] border-line border-t-accent" />
        <p className="font-display text-[26px] leading-tight text-ink">Cleaning up…</p>
        <p className="mt-2 text-sm text-ink-soft">Freeing space — this won't take long.</p>
      </div>
    </div>
  )
}
