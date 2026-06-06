package engine

import (
	"path/filepath"
	"testing"

	"github.com/gor3a/disk-scan/internal/rules"
)

func TestScanAllStreamsAndReturns(t *testing.T) {
	home := t.TempDir()
	cache := filepath.Join(home, ".cache", "stuff")
	if err := writeTree(t, cache, 4096); err != nil {
		t.Fatal(err)
	}

	var streamed []rules.Item
	got := ScanAll("linux", home, false, func(it rules.Item) {
		streamed = append(streamed, it)
	})

	if len(got) == 0 {
		t.Fatalf("expected items, got none")
	}
	if len(streamed) == 0 {
		t.Fatalf("expected streamed callback to fire for catalog items")
	}
	for _, it := range got {
		if it.Source == rules.CatalogSource && it.Path != "" && !contains(streamed, it.Path) {
			t.Errorf("catalog item %q was returned but never streamed", it.Path)
		}
	}
}

func TestAutoSafeSelectionExcludesReviewKeepAndCommands(t *testing.T) {
	items := []rules.Item{
		{Path: "/a", Tier: rules.Safe, Method: rules.Remove, Bytes: 1},
		{Path: "/b", Tier: rules.Review, Method: rules.Trash, Bytes: 1},
		{Path: "/c", Tier: rules.Keep, Bytes: 1},
		{Label: "docker", Tier: rules.Safe, Method: rules.Command, Bytes: 1},
	}
	got := AutoSafeSelection(items)
	if len(got) != 1 || got[0].Path != "/a" {
		t.Fatalf("expected only /a, got %+v", got)
	}
}
