export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" aria-label="dscan">
      <defs>
        <linearGradient id="dmk" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#33A57E" />
          <stop offset="1" stopColor="#0F3D2E" />
        </linearGradient>
      </defs>
      <g transform="translate(120,120)">
        <circle r="78" fill="none" stroke="#E4DCCD" strokeWidth="22" />
        <circle
          r="78"
          fill="none"
          stroke="url(#dmk)"
          strokeWidth="22"
          strokeLinecap="round"
          strokeDasharray="382 108"
          transform="rotate(-90)"
        />
        <path
          d="M-36,4 L-10,33 L39,-33"
          fill="none"
          stroke="url(#dmk)"
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
