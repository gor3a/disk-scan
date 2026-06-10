package apps

import (
	"path/filepath"
	"syscall"
)

// Scan enumerates apps in the standard macOS install roots (/Applications and
// ~/Applications, one level into subfolders). /System/Applications is skipped:
// Apple's apps are always Universal, SIP-protected, and not removable.
func Scan(home string, onApp func(App), cancel <-chan struct{}) []App {
	roots := []string{"/Applications"}
	if home != "" {
		roots = append(roots, filepath.Join(home, "Applications"))
	}
	return scanRoots(roots, onApp, cancel)
}

// HostIsAppleSilicon reports whether the machine is Apple Silicon hardware,
// read from sysctl hw.optional.arm64. This is authoritative even when the
// process runs translated under Rosetta (unlike runtime.GOARCH / process.arch).
func HostIsAppleSilicon() bool {
	v, err := syscall.SysctlUint32("hw.optional.arm64")
	if err != nil {
		// Older sysctl name or error: fall back to the proc_translated flag.
		return translatedFallback()
	}
	return v == 1
}

func translatedFallback() bool {
	v, err := syscall.SysctlUint32("sysctl.proc_translated")
	return err == nil && v == 1
}
