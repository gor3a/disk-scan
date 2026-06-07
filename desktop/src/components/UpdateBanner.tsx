import { DownloadCloud, RefreshCw } from 'lucide-react'
import { updateBanner, type UpdateStatus } from '../lib/update'

export function UpdateBanner({
  status,
  platform,
  onInstall,
  onDownload,
}: {
  status: UpdateStatus
  platform: string
  onInstall: () => void
  onDownload: () => void
}) {
  const b = updateBanner(status, platform)
  if (!b.show) return null
  return (
    <div className="flex items-center gap-2 border-t border-line bg-surface px-5 py-2 text-[12.5px] text-ink">
      {status.state === 'downloading' ? (
        <RefreshCw size={14} strokeWidth={1.75} className="animate-spin text-accent" />
      ) : (
        <DownloadCloud size={14} strokeWidth={1.75} className="text-accent" />
      )}
      <span>{b.text}</span>
      {b.action === 'install' && (
        <button onClick={onInstall} className="ml-auto font-semibold text-accent">
          Restart to update
        </button>
      )}
      {b.action === 'download' && (
        <button onClick={onDownload} className="ml-auto font-semibold text-accent">
          Download
        </button>
      )}
    </div>
  )
}
