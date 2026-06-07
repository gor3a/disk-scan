// A small, inviting "buy me a coffee" pill. Warm amber tones (distinct from the
// emerald clean actions); the steam rises on hover.
export function SupportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Support dscan on Ko-fi"
      className="group flex items-center gap-1.5 rounded-full border border-[#ecd6a6] bg-gradient-to-b from-[#fdf4de] to-[#f7e6bf] px-3 py-1 text-[11.5px] font-semibold text-[#8a5a16] shadow-[0_1px_2px_rgba(138,90,22,.18)] transition-all duration-200 hover:-translate-y-0.5 hover:from-[#fbeecb] hover:to-[#f3dca8] hover:shadow-[0_4px_10px_-2px_rgba(138,90,22,.4)] dark:border-[#5a4a2a] dark:from-[#2c2a22] dark:to-[#332e20] dark:text-[#e3b873] dark:hover:from-[#343026] dark:hover:to-[#3c3526]"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="-ml-0.5">
        <path className="steam" d="M8.5 2.5c.6.8-.4 1.5-.4 2.4s.7 1.2.4 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
        <path className="steam steam-2" d="M12.5 2.5c.6.8-.4 1.5-.4 2.4s.7 1.2.4 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4" />
        <path d="M4 9.5h12v4.2A4.8 4.8 0 0 1 11.2 18.5H8.8A4.8 4.8 0 0 1 4 13.7V9.5Z" fill="currentColor" />
        <path d="M16 10.4h2.4a2.3 2.3 0 0 1 0 4.6H16" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <rect x="5" y="19.6" width="10" height="1.6" rx="0.8" fill="currentColor" />
      </svg>
      Buy me a coffee
    </button>
  )
}
