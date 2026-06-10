package apps

import (
	"debug/macho"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

// makeBundle writes a minimal Foo.app at dir/name with the given bundle id and
// a thin Mach-O main executable of the given CPU.
func makeBundle(t *testing.T, dir, name, bundleID string, cpu macho.Cpu) string {
	t.Helper()
	app := filepath.Join(dir, name+".app")
	macos := filepath.Join(app, "Contents", "MacOS")
	if err := os.MkdirAll(macos, 0o755); err != nil {
		t.Fatal(err)
	}
	exe := filepath.Join(macos, name)
	if err := os.WriteFile(exe, thinMachO(cpu), 0o755); err != nil {
		t.Fatal(err)
	}
	plistXML := `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>` + name + `</string>
<key>CFBundleIdentifier</key><string>` + bundleID + `</string>
</dict></plist>`
	if err := os.WriteFile(filepath.Join(app, "Contents", "Info.plist"), []byte(plistXML), 0o644); err != nil {
		t.Fatal(err)
	}
	return app
}

func TestScanRoots(t *testing.T) {
	root := t.TempDir()
	makeBundle(t, root, "Older", "com.acme.older", macho.CpuAmd64)
	makeBundle(t, root, "Native", "com.acme.native", macho.CpuArm64)
	sub := filepath.Join(root, "Utilities")
	if err := os.MkdirAll(sub, 0o755); err != nil {
		t.Fatal(err)
	}
	makeBundle(t, sub, "Nested", "com.acme.nested", macho.CpuArm64)

	apps := scanRoots([]string{root}, nil, nil)
	if len(apps) != 3 {
		t.Fatalf("got %d apps, want 3: %+v", len(apps), apps)
	}
	byName := map[string]App{}
	for _, a := range apps {
		byName[a.Name] = a
	}
	if byName["Older"].Arch != ArchIntel || byName["Older"].BundleID != "com.acme.older" {
		t.Errorf("Older = %+v", byName["Older"])
	}
	if byName["Native"].Arch != ArchAppleSilicon {
		t.Errorf("Native = %+v", byName["Native"])
	}
	if _, ok := byName["Nested"]; !ok {
		t.Error("nested app not found")
	}
}

func TestScanRootsStreamsAndDedupes(t *testing.T) {
	root := t.TempDir()
	makeBundle(t, root, "One", "com.acme.one", macho.CpuArm64)
	var streamed []string
	apps := scanRoots([]string{root, root}, func(a App) { streamed = append(streamed, a.Name) }, nil)
	if len(apps) != 1 {
		t.Fatalf("dedupe failed: %d", len(apps))
	}
	sort.Strings(streamed)
	if len(streamed) != 1 || streamed[0] != "One" {
		t.Fatalf("stream = %v", streamed)
	}
}

func TestLeftovers(t *testing.T) {
	home := t.TempDir()
	lib := filepath.Join(home, "Library")
	mk := func(parts ...string) string {
		p := filepath.Join(append([]string{lib}, parts...)...)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		return p
	}
	if err := os.MkdirAll(mk("Application Support", "com.acme.foo"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(mk("Application Support", "com.acme.foo", "data.bin"), make([]byte, 2048), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(mk("Preferences", "com.acme.foo.plist"), make([]byte, 16), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(mk("Caches", "com.acme.foobar"), 0o755); err != nil {
		t.Fatal(err)
	}

	got := Leftovers(home, "com.acme.foo")
	paths := map[string]int64{}
	for _, l := range got {
		paths[l.Path] = l.Bytes
	}
	if _, ok := paths[filepath.Join(lib, "Application Support", "com.acme.foo")]; !ok {
		t.Error("missing Application Support match")
	}
	if _, ok := paths[filepath.Join(lib, "Preferences", "com.acme.foo.plist")]; !ok {
		t.Error("missing Preferences match")
	}
	if _, ok := paths[filepath.Join(lib, "Caches", "com.acme.foobar")]; ok {
		t.Error("over-matched com.acme.foobar")
	}
	if Leftovers(home, "") != nil {
		t.Error("empty bundle id should match nothing")
	}
}
