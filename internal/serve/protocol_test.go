package serve

import (
	"testing"

	"github.com/gor3a/disk-scan/internal/rules"
)

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
