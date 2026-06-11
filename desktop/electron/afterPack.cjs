// electron-builder afterPack hook (macOS only).
//
// We have no Apple Developer ID yet, so electron-builder's signing pass is
// disabled (mac.identity: null). Without a stable code identity, macOS re-prompts
// for permissions on every launch: an unsigned/ad-hoc app run from a downloaded
// location gets Gatekeeper App Translocation (a randomized read-only path each
// launch), and TCC keys grants to identity + path — so it looks like a brand-new
// app every time.
//
// As a stopgap this:
//   1. ad-hoc signs the Go sidecar (the nested binary electron-builder ignores),
//   2. ad-hoc signs the app bundle so its seal covers the signed sidecar,
//   3. strips the quarantine attribute from the build output.
//
// This stabilizes a LOCALLY built/run app. A downloaded, distributed build is
// still quarantined on first open and will re-prompt — persistent grants across
// machines require the follow-up: Developer ID signing + notarization.

const { execFileSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

/** @param {import('electron-builder').AfterPackContext} context */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)
  const sidecar = path.join(appPath, 'Contents', 'Resources', 'dscan')

  const sign = (target) =>
    execFileSync('codesign', ['--force', '--sign', '-', '--timestamp=none', target], {
      stdio: 'inherit',
    })

  // Sign the nested sidecar first, then the bundle, so the app's seal covers it.
  if (fs.existsSync(sidecar)) sign(sidecar)
  sign(appPath)

  // Remove quarantine so a locally-built app isn't path-randomized by Gatekeeper.
  try {
    execFileSync('xattr', ['-dr', 'com.apple.quarantine', appPath], { stdio: 'inherit' })
  } catch {
    // No quarantine attribute present (the common case for a local build) — fine.
  }

  console.log(`afterPack: ad-hoc signed + de-quarantined ${appName}`)
}
