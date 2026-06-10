package serve

import (
	"testing"

	"github.com/gor3a/disk-scan/internal/apps"
	"github.com/gor3a/disk-scan/internal/engine"
	"github.com/gor3a/disk-scan/internal/rules"
)

func TestAppDTO(t *testing.T) {
	a := apps.App{Path: "/Applications/Foo.app", Name: "Foo", BundleID: "com.acme.foo", Bytes: 1234, Arch: apps.ArchIntel}
	d := appDTO(a)
	if d.ID != a.Path || d.Name != "Foo" || d.BundleID != "com.acme.foo" || d.Bytes != 1234 || d.Arch != "intel" {
		t.Fatalf("appDTO = %+v", d)
	}
}

func TestLeftoverDTO(t *testing.T) {
	d := toLeftoverDTO(apps.Leftover{Path: "/x/y", Bytes: 9})
	if d.Path != "/x/y" || d.Label != "y" || d.Bytes != 9 {
		t.Fatalf("toLeftoverDTO = %+v", d)
	}
}

func engineProject(path, dir string, bytes, modified int64) engine.Project {
	return engine.Project{Path: path, Dir: dir, Bytes: bytes, Modified: modified}
}

func TestProjectDTOCarriesKind(t *testing.T) {
	p := engine.Project{Path: "/a/.next", Dir: "/a", Kind: ".next", Bytes: 5, Modified: 1}
	dto := projectDTO(p)
	if dto.Kind != ".next" || dto.Category != "Projects" {
		t.Fatalf("dto = %+v", dto)
	}
}

func TestProjectDTO(t *testing.T) {
	p := engineProject("/Users/me/dev/work-app/node_modules", "/Users/me/dev/work-app", 880, 1700000000)
	dto := projectDTO(p)
	if dto.ID != "/Users/me/dev/work-app/node_modules" {
		t.Errorf("ID = %s", dto.ID)
	}
	if dto.Label != "work-app" {
		t.Errorf("Label = %s, want work-app", dto.Label)
	}
	if dto.Category != "Projects" || dto.Tier != "SAFE" || dto.Method != "remove" {
		t.Errorf("bad classification: %+v", dto)
	}
	if dto.Modified != 1700000000 || !dto.Selectable {
		t.Errorf("Modified/Selectable wrong: %+v", dto)
	}
}

func TestToDTO(t *testing.T) {
	cases := []struct {
		in         rules.Item
		wantID     string
		wantTier   string
		wantMethod string
		wantSelect bool
	}{
		{rules.Item{Path: "/x", Tier: rules.Safe, Method: rules.Remove, Bytes: 9},
			"/x", "SAFE", "remove", true},
		{rules.Item{Path: "/y", Tier: rules.Review},
			"/y", "REVIEW", "trash", true},
		{rules.Item{Label: "docker", Tier: rules.Safe, Method: rules.Command, Command: []string{"docker"}},
			"cmd:docker", "SAFE", "command", true},
		{rules.Item{Path: "/z", Tier: rules.Keep},
			"/z", "KEEP", "remove", false},
	}
	for _, c := range cases {
		got := ToDTO(c.in)
		if got.ID != c.wantID || got.Tier != c.wantTier ||
			got.Method != c.wantMethod || got.Selectable != c.wantSelect {
			t.Errorf("ToDTO(%+v) = %+v", c.in, got)
		}
	}
}
