package apps

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/gor3a/disk-scan/internal/scan"
	"howett.net/plist"
)

// App is one installed application.
type App struct {
	Path     string // …/Foo.app
	Name     string // "Foo"
	BundleID string // com.acme.foo ("" if unreadable)
	Bytes    int64
	Arch     Arch
}

// Leftover is a support file/dir associated with an app's bundle id.
type Leftover struct {
	Path  string
	Bytes int64
}

func canceled(c <-chan struct{}) bool {
	if c == nil {
		return false
	}
	select {
	case <-c:
		return true
	default:
		return false
	}
}

// bundleInfo reads CFBundleExecutable + CFBundleIdentifier from an app's
// Info.plist (binary or XML). Missing/unreadable plists yield empty strings.
func bundleInfo(appPath string) (exe, bundleID string) {
	f, err := os.Open(filepath.Join(appPath, "Contents", "Info.plist"))
	if err != nil {
		return "", ""
	}
	defer f.Close()
	var info struct {
		Executable string `plist:"CFBundleExecutable"`
		BundleID   string `plist:"CFBundleIdentifier"`
	}
	_ = plist.NewDecoder(f).Decode(&info)
	return info.Executable, info.BundleID
}

// mainExecutable resolves the app's main binary: the declared CFBundleExecutable
// if present, else the first regular file under Contents/MacOS.
func mainExecutable(appPath, declared string) string {
	macos := filepath.Join(appPath, "Contents", "MacOS")
	if declared != "" {
		p := filepath.Join(macos, declared)
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			return p
		}
	}
	entries, _ := os.ReadDir(macos)
	for _, e := range entries {
		if !e.IsDir() {
			return filepath.Join(macos, e.Name())
		}
	}
	return ""
}

func appFromBundle(appPath string, cancel <-chan struct{}) App {
	exeDecl, bundleID := bundleInfo(appPath)
	arch := ArchUnknown
	if exe := mainExecutable(appPath, exeDecl); exe != "" {
		arch = ArchOf(exe)
	}
	size, _ := scan.DirSizeCancel(appPath, cancel)
	return App{
		Path:     appPath,
		Name:     strings.TrimSuffix(filepath.Base(appPath), ".app"),
		BundleID: bundleID,
		Bytes:    size,
		Arch:     arch,
	}
}

// scanRoots enumerates .app bundles directly under each root and one level into
// subfolders (Utilities, Setapp, …). Apps are streamed via onApp (if non-nil)
// and returned. Duplicate bundle paths are visited once.
func scanRoots(roots []string, onApp func(App), cancel <-chan struct{}) []App {
	var apps []App
	seen := map[string]bool{}
	add := func(appPath string) {
		if seen[appPath] {
			return
		}
		seen[appPath] = true
		a := appFromBundle(appPath, cancel)
		apps = append(apps, a)
		if onApp != nil {
			onApp(a)
		}
	}
	for _, root := range roots {
		entries, err := os.ReadDir(root)
		if err != nil {
			continue // unreadable / missing root: skip
		}
		for _, e := range entries {
			if canceled(cancel) {
				return apps
			}
			full := filepath.Join(root, e.Name())
			switch {
			case strings.HasSuffix(e.Name(), ".app"):
				add(full)
			case e.IsDir():
				subs, _ := os.ReadDir(full)
				for _, se := range subs {
					if strings.HasSuffix(se.Name(), ".app") {
						add(filepath.Join(full, se.Name()))
					}
				}
			}
		}
	}
	return apps
}

// Leftovers returns existing support files/dirs whose name is an EXACT match for
// the bundle id under the standard ~/Library locations, each with its size.
// Exact matching avoids over-matching neighbors (com.acme.foo vs com.acme.foobar).
func Leftovers(home, bundleID string) []Leftover {
	if bundleID == "" {
		return nil
	}
	lib := filepath.Join(home, "Library")
	candidates := []string{
		filepath.Join(lib, "Application Support", bundleID),
		filepath.Join(lib, "Caches", bundleID),
		filepath.Join(lib, "Preferences", bundleID+".plist"),
		filepath.Join(lib, "Logs", bundleID),
		filepath.Join(lib, "Containers", bundleID),
		filepath.Join(lib, "HTTPStorages", bundleID),
		filepath.Join(lib, "Saved Application State", bundleID+".savedState"),
	}
	var out []Leftover
	for _, p := range candidates {
		fi, err := os.Stat(p)
		if err != nil {
			continue
		}
		size := fi.Size()
		if fi.IsDir() {
			size, _ = scan.DirSizeCancel(p, nil)
		}
		out = append(out, Leftover{Path: p, Bytes: size})
	}
	return out
}
