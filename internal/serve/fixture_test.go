package serve

import (
	"bytes"
	"encoding/json"
	"testing"
)

// TestItemDTOMatchesFixtureShape pins the JSON shape the renderer parses in
// desktop/src/lib/protocol.test.ts against testdata/protocol-fixture.jsonl, so
// the Go encoder and the TypeScript types can't drift.
func TestItemDTOMatchesFixtureShape(t *testing.T) {
	e := Event{Event: "item", Item: &ItemDTO{
		ID: "/Users/me/.cache", Path: "/Users/me/.cache", Label: "~/.cache",
		Bytes: 3100000000, Category: "Caches", Tier: "SAFE", Method: "remove",
		Source: "catalog", Selectable: true,
	}}
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(e); err != nil {
		t.Fatal(err)
	}
	want := `{"event":"item","item":{"id":"/Users/me/.cache","path":"/Users/me/.cache","label":"~/.cache","bytes":3100000000,"category":"Caches","tier":"SAFE","method":"remove","source":"catalog","selectable":true}}`
	if got := bytes.TrimSpace(buf.Bytes()); string(got) != want {
		t.Fatalf("shape drift:\n got=%s\nwant=%s", got, want)
	}
}
