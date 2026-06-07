import { homedir } from 'node:os'
import { join } from 'node:path'
import { writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

export type Cadence = 'off' | 'daily' | 'weekly'
const LABEL = 'com.gor3a.dscan'

export function plistContent(binPath: string, autoClean: boolean, cadence: Cadence): string {
  const cleanArg = autoClean ? '\n    <string>--clean</string>' : ''
  const cal =
    cadence === 'weekly'
      ? '<key>Weekday</key><integer>1</integer><key>Hour</key><integer>11</integer><key>Minute</key><integer>0</integer>'
      : '<key>Hour</key><integer>11</integer><key>Minute</key><integer>0</integer>'
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array>
    <string>${binPath}</string>
    <string>notify</string>${cleanArg}
  </array>
  <key>StartCalendarInterval</key><dict>${cal}</dict>
</dict></plist>
`
}

export function systemdUnits(
  binPath: string,
  autoClean: boolean,
  cadence: Cadence,
): { service: string; timer: string } {
  const cleanArg = autoClean ? ' --clean' : ''
  const onCal = cadence === 'weekly' ? 'Mon *-*-* 11:00:00' : '*-*-* 11:00:00'
  return {
    service: `[Unit]
Description=dscan scheduled scan
[Service]
Type=oneshot
ExecStart=${binPath} notify${cleanArg}
`,
    timer: `[Unit]
Description=dscan scheduled scan timer
[Timer]
OnCalendar=${onCal}
Persistent=true
[Install]
WantedBy=timers.target
`,
  }
}

export interface ScheduleResult {
  ok: boolean
  error?: string
}

function commandExists(cmd: string): boolean {
  try {
    execFileSync('/bin/sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// applySchedule installs (or, for 'off', removes) the recurring job. With
// DSCAN_SCHEDULE_DIR set, it only writes/removes the unit file and skips the
// launchctl/systemctl activation — used by tests and local dev.
export function applySchedule(
  cadence: Cadence,
  autoClean: boolean,
  binPath: string,
  platform: NodeJS.Platform = process.platform,
): ScheduleResult {
  const override = process.env.DSCAN_SCHEDULE_DIR
  const run = (cmd: string, args: string[]) => {
    if (override) return
    try {
      execFileSync(cmd, args, { stdio: 'ignore' })
    } catch {
      /* best-effort */
    }
  }
  try {
    if (platform === 'darwin') {
      const dir = override ?? join(homedir(), 'Library', 'LaunchAgents')
      mkdirSync(dir, { recursive: true })
      const file = join(dir, `${LABEL}.plist`)
      run('launchctl', ['unload', file])
      if (cadence === 'off') {
        if (existsSync(file)) rmSync(file)
        return { ok: true }
      }
      writeFileSync(file, plistContent(binPath, autoClean, cadence))
      run('launchctl', ['load', '-w', file])
      return { ok: true }
    }
    if (platform === 'linux') {
      if (!override && !commandExists('systemctl')) return { ok: false, error: 'unavailable' }
      const dir = override ?? join(homedir(), '.config', 'systemd', 'user')
      mkdirSync(dir, { recursive: true })
      const svc = join(dir, 'dscan.service')
      const tmr = join(dir, 'dscan.timer')
      if (cadence === 'off') {
        run('systemctl', ['--user', 'disable', '--now', 'dscan.timer'])
        if (existsSync(svc)) rmSync(svc)
        if (existsSync(tmr)) rmSync(tmr)
        return { ok: true }
      }
      const u = systemdUnits(binPath, autoClean, cadence)
      writeFileSync(svc, u.service)
      writeFileSync(tmr, u.timer)
      run('systemctl', ['--user', 'daemon-reload'])
      run('systemctl', ['--user', 'enable', '--now', 'dscan.timer'])
      return { ok: true }
    }
    return { ok: false, error: 'unsupported platform' }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
