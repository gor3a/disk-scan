package rules

import (
	"path/filepath"
	"strings"
)

// Entry is a catalog rule. PathTemplate uses "~" for the home dir and may end
// with "/*" to mean "each child is its own item".
type Entry struct {
	PathTemplate string
	Label        string
	Category     Category
	Tier         Tier
	Method       CleanMethod
	Command      []string
	GlobChildren bool // PathTemplate ended with /*
}

// Expand resolves "~" to home and strips a trailing "/*".
// Returns "" for command-token templates that do not start with "~".
func (e Entry) Expand(home string) string {
	p := strings.TrimSuffix(e.PathTemplate, "/*")
	if !strings.HasPrefix(p, "~") {
		return ""
	}
	p = filepath.Join(home, strings.TrimPrefix(p, "~"))
	return p
}

func entry(tmpl, label string, cat Category, tier Tier) Entry {
	e := Entry{PathTemplate: tmpl, Label: label, Category: cat, Tier: tier}
	if strings.HasSuffix(tmpl, "/*") {
		e.GlobChildren = true
	}
	return e
}

func cmd(tmpl, label string, cat Category, c ...string) Entry {
	return Entry{PathTemplate: tmpl, Label: label, Category: cat, Tier: Safe, Method: Command, Command: c}
}

// shared cross-platform dependency/build caches (home-relative).
func sharedEntries() []Entry {
	return []Entry{
		entry("~/.npm", "npm cache", PackageStores, Safe),
		entry("~/.yarn/berry/cache", "Yarn berry cache", PackageStores, Safe),
		entry("~/.pnpm-store", "pnpm store", PackageStores, Safe),
		entry("~/.gradle/caches", "Gradle caches", PackageStores, Safe),
		entry("~/.m2/repository", "Maven repo", PackageStores, Safe),
		entry("~/.cargo/registry", "Cargo registry", PackageStores, Safe),
		entry("~/.cache/go-build", "Go build cache", Caches, Safe),
		entry("~/.cache", "Generic ~/.cache", Caches, Safe),
		entry("~/.bun/install/cache", "Bun cache", PackageStores, Safe),
		entry("~/.ssh", "SSH keys", AppData, Keep),
	}
}

// Catalog returns the classification rules for the given GOOS and home dir.
func Catalog(goos, home string) []Entry {
	out := sharedEntries()
	switch goos {
	case "darwin":
		out = append(out,
			entry("~/Library/Caches/*", "~/Library/Caches", Caches, Safe),
			entry("~/Library/Logs", "~/Library/Logs", Caches, Safe),
			entry("~/Library/Developer/Xcode/DerivedData", "Xcode DerivedData", BuildArtifacts, Safe),
			entry("~/Library/Developer/Xcode/iOS DeviceSupport", "iOS DeviceSupport", BuildArtifacts, Safe),
			entry("~/Library/Developer/CoreSimulator/Caches", "Simulator caches", Simulators, Safe),
			cmd("simctl:unavailable", "Delete unavailable simulators", Simulators, "xcrun", "simctl", "delete", "unavailable"),
			cmd("brew:cleanup", "Homebrew cleanup", PackageStores, "brew", "cleanup", "-s"),
			entry("~/Library/Application Support/Postman", "Postman collections", AppData, Keep),
			entry("~/Library/Group Containers/group.net.whatsapp.WhatsApp.shared", "WhatsApp data", AppData, Keep),
		)
	case "linux":
		out = append(out,
			entry("~/.config/google-chrome/Default/Cache", "Chrome cache", Caches, Safe),
			cmd("brew:cleanup", "Homebrew cleanup", PackageStores, "brew", "cleanup", "-s"),
			entry("~/.local/share/keyrings", "Keyrings", AppData, Keep),
		)
	}
	// home is accepted for symmetry/future use; entries are home-relative via Expand.
	_ = home
	return out
}

// ClassifyHeuristic classifies a path discovered by the heuristic walk that the
// catalog did not already cover. Default: user data, treated as a large file.
func ClassifyHeuristic(path string) Item {
	return Item{
		Path:     path,
		Label:    path,
		Category: LargeFiles,
		Tier:     Review,
		Source:   Heuristic,
	}
}
