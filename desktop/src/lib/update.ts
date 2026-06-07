export type UpdateState =
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'none'
  | 'error'

export interface UpdateStatus {
  state: UpdateState
  version?: string
  percent?: number
}

export interface Banner {
  show: boolean
  text: string
  action?: 'install' | 'download'
}

// updateBanner maps an updater status + platform to what the footer shows.
// Linux auto-downloads (so 'available' is silent until 'downloading'); macOS
// can't auto-install while unsigned, so 'available' offers a Download link.
export function updateBanner(s: UpdateStatus, platform: string): Banner {
  switch (s.state) {
    case 'downloading':
      return { show: true, text: `Downloading update… ${Math.round(s.percent ?? 0)}%` }
    case 'downloaded':
      return { show: true, text: 'Update ready', action: 'install' }
    case 'available':
      return platform === 'darwin'
        ? { show: true, text: `v${s.version} available`, action: 'download' }
        : { show: false, text: '' }
    default:
      return { show: false, text: '' }
  }
}
