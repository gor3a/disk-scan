import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { Toast } from '../../lib/powersched'

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-card ${
            t.kind === 'ok'
              ? 'border-accent/30 bg-surface text-ink'
              : 'border-[#b91c1c]/40 bg-[#b91c1c]/10 text-[#b91c1c]'
          }`}
        >
          {t.kind === 'ok' ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
