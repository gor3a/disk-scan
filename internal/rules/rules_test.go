package rules

import "testing"

func TestTierString(t *testing.T) {
	cases := map[Tier]string{Safe: "SAFE", Review: "REVIEW", Keep: "KEEP"}
	for tier, want := range cases {
		if got := tier.String(); got != want {
			t.Errorf("Tier(%d).String() = %q, want %q", tier, got, want)
		}
	}
}

func TestSelectable(t *testing.T) {
	if (Item{Tier: Keep}).Selectable() {
		t.Error("Keep items must not be selectable")
	}
	if !(Item{Tier: Safe}).Selectable() {
		t.Error("Safe items must be selectable")
	}
	if !(Item{Tier: Review}).Selectable() {
		t.Error("Review items must be selectable")
	}
}

func TestDefaultMethod(t *testing.T) {
	// Safe with no explicit method -> Remove; Review -> Trash.
	if m := (Item{Tier: Safe}).EffectiveMethod(); m != Remove {
		t.Errorf("Safe default method = %v, want Remove", m)
	}
	if m := (Item{Tier: Review}).EffectiveMethod(); m != Trash {
		t.Errorf("Review default method = %v, want Trash", m)
	}
	// Explicit method wins.
	if m := (Item{Tier: Safe, Method: Command}).EffectiveMethod(); m != Command {
		t.Errorf("explicit method = %v, want Command", m)
	}
}

func TestCatalogIsOSAware(t *testing.T) {
	mac := Catalog("darwin", "/home/u")
	lin := Catalog("linux", "/home/u")
	if len(mac) == 0 || len(lin) == 0 {
		t.Fatal("catalog must be non-empty for both OSes")
	}
	hasPath := func(entries []Entry, substr string) bool {
		for _, e := range entries {
			if contains(e.PathTemplate, substr) {
				return true
			}
		}
		return false
	}
	if !hasPath(mac, "Library/Caches") {
		t.Error("macOS catalog should include ~/Library/Caches")
	}
	if !hasPath(lin, ".cache") {
		t.Error("linux catalog should include ~/.cache")
	}
}

func TestCatalogExpandsHome(t *testing.T) {
	entries := Catalog("linux", "/home/u")
	for _, e := range entries {
		if got := e.Expand("/home/u"); len(got) > 0 && got[0] != '/' {
			t.Errorf("Expand should yield absolute path, got %q", got)
		}
	}
}

func TestCatalogHasProtectedKeep(t *testing.T) {
	// At least one KEEP entry must exist so protected data is represented.
	for _, e := range Catalog("darwin", "/home/u") {
		if e.Tier == Keep {
			return
		}
	}
	t.Error("catalog should contain at least one KEEP entry")
}

func TestClassifyHeuristic(t *testing.T) {
	// A path matching a catalog dir name is classified from the catalog;
	// an unknown big dir falls back to Review/LargeFiles.
	got := ClassifyHeuristic("/home/u/SomeBigUnknownDir")
	if got.Tier != Review || got.Category != LargeFiles {
		t.Errorf("unknown path => %v/%v, want Review/LargeFiles", got.Tier, got.Category)
	}
}

// small local helper for the test
func contains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && indexOf(s, sub) >= 0)
}
func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
