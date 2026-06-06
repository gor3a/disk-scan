import type { Tier } from './protocol'

// Visual tokens per safety tier. Literal Tailwind classes (no string interpolation
// so the JIT compiler keeps them).
export const TIER: Record<
  Tier,
  { title: string; sub: string; pill: string; dot: string }
> = {
  SAFE: {
    title: 'Safe to remove',
    sub: 'Caches & build output — they regenerate on next use',
    pill: 'bg-safe-bg text-safe',
    dot: 'bg-safe',
  },
  REVIEW: {
    title: 'Worth a look',
    sub: 'Your files — moved to Trash, fully recoverable',
    pill: 'bg-review-bg text-review',
    dot: 'bg-review',
  },
  KEEP: {
    title: 'Protected',
    sub: 'Browser profiles, keys, messaging — never touched',
    pill: 'bg-keep-bg text-keep',
    dot: 'bg-keep',
  },
}
