package engine

import (
	"os"
	"path/filepath"
	"testing"
)

func writeFile(t *testing.T, path string, size int) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, make([]byte, size), 0o644); err != nil {
		t.Fatal(err)
	}
}

func childByName(n *Node, name string) *Node {
	for _, c := range n.Children {
		if c.Name == name {
			return c
		}
	}
	return nil
}

func TestBuildSizeTree(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "big", "blob"), 1<<20) // 1 MiB dir
	writeFile(t, filepath.Join(root, "huge.bin"), 2<<20)    // 2 MiB file (own leaf)
	for i := 0; i < 5; i++ {
		writeFile(t, filepath.Join(root, "tiny"+string(rune('a'+i))), 16) // collapse at root
	}
	writeFile(t, filepath.Join(root, "skip", "x"), 1<<20)

	tree := BuildSizeTree(root, []string{filepath.Join(root, "skip")}, nil, nil)
	if tree == nil {
		t.Fatal("nil tree")
	}
	if got := tree.Bytes; got < 3<<20 || got > 3<<20+4096 {
		t.Fatalf("root bytes = %d, want ~3 MiB", got)
	}
	if childByName(tree, "skip") != nil {
		t.Error("excluded subtree must be absent")
	}
	if huge := childByName(tree, "huge.bin"); huge == nil || huge.Dir {
		t.Error("large file should be its own leaf tile")
	}
	if big := childByName(tree, "big"); big == nil || !big.Dir {
		t.Error("big dir should be a drillable node")
	}
	var agg *Node
	for _, c := range tree.Children {
		if c.Path == "" {
			agg = c
		}
	}
	if agg == nil {
		t.Error("small children should collapse into an aggregate node")
	}
}
