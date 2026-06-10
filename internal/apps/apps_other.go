//go:build !darwin

package apps

// Scan is darwin-only; on other platforms there are no macOS apps to audit.
func Scan(_ string, _ func(App), _ <-chan struct{}) []App { return nil }

// HostIsAppleSilicon is false off macOS.
func HostIsAppleSilicon() bool { return false }
