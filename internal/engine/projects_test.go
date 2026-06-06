package engine

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestFindProjectsSkipsNestedAndReportsLastUsed(t *testing.T) {
	root := t.TempDir()
	mkfileP(t, filepath.Join(root, "a", "node_modules", "pkg", "f"), 2048)
	mkfileP(t, filepath.Join(root, "a", "node_modules", "pkg", "node_modules", "dep", "f"), 1024)
	mkfileP(t, filepath.Join(root, "a", "src", "index.js"), 10)
	mkfileP(t, filepath.Join(root, "b", "node_modules", "f"), 4096)

	var got []Project
	FindProjects(root, func(p Project) { got = append(got, p) }, nil)

	if len(got) != 2 {
		t.Fatalf("expected 2 projects (nested skipped), got %d: %+v", len(got), got)
	}
	byDir := map[string]Project{}
	for _, p := range got {
		byDir[filepath.Base(p.Dir)] = p
	}
	a, ok := byDir["a"]
	if !ok {
		t.Fatal("project a not found")
	}
	if a.Path != filepath.Join(root, "a", "node_modules") {
		t.Errorf("a.Path = %s", a.Path)
	}
	if a.Bytes < 3072 {
		t.Errorf("a.Bytes = %d, want >= 3072", a.Bytes)
	}
	if a.Modified == 0 {
		t.Error("a.Modified should reflect the src file mtime")
	}
}

func TestFindProjectsArtifactKinds(t *testing.T) {
	root := t.TempDir()
	mkfileP(t, filepath.Join(root, "node-app", "node_modules", "f"), 1024)
	mkfileP(t, filepath.Join(root, "next-app", ".next", "f"), 1024)
	mkfileP(t, filepath.Join(root, "py", "__pycache__", "f"), 1024)
	mkfileP(t, filepath.Join(root, "rust", "Cargo.toml"), 10)
	mkfileP(t, filepath.Join(root, "rust", "target", "f"), 1024)
	mkfileP(t, filepath.Join(root, "plain", "target", "f"), 1024)
	mkfileP(t, filepath.Join(root, "c-proj", "build", "f"), 1024)

	kinds := map[string]string{}
	FindProjects(root, func(p Project) { kinds[filepath.Base(p.Dir)] = p.Kind }, nil)

	if kinds["node-app"] != "node_modules" {
		t.Errorf("node-app kind = %q", kinds["node-app"])
	}
	if kinds["next-app"] != ".next" || kinds["py"] != "__pycache__" {
		t.Errorf("kinds = %+v", kinds)
	}
	if kinds["rust"] != "target" {
		t.Errorf("rust target (with Cargo.toml) should match, got %q", kinds["rust"])
	}
	if _, ok := kinds["plain"]; ok {
		t.Error("bare target without Cargo.toml must be skipped")
	}
	if _, ok := kinds["c-proj"]; ok {
		t.Error("build without package.json must be skipped")
	}
}

func TestFindProjectsModifiedIgnoresNodeModules(t *testing.T) {
	root := t.TempDir()
	proj := filepath.Join(root, "p")
	mkfileP(t, filepath.Join(proj, "node_modules", "f"), 10)
	mkfileP(t, filepath.Join(proj, "main.go"), 10)
	old := time.Now().Add(-200 * 24 * time.Hour)
	_ = os.Chtimes(filepath.Join(proj, "node_modules"), time.Now(), time.Now())
	_ = os.Chtimes(filepath.Join(proj, "main.go"), old, old)

	var got []Project
	FindProjects(root, func(p Project) { got = append(got, p) }, nil)
	if len(got) != 1 {
		t.Fatalf("want 1 project, got %d", len(got))
	}
	if got[0].Modified > old.Unix()+5 {
		t.Errorf("Modified should reflect source mtime (old), got %d", got[0].Modified)
	}
}
