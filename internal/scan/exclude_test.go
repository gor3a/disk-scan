package scan

import "testing"

func TestIsExcluded(t *testing.T) {
	ex := []string{"/a/b", "/x"}
	cases := map[string]bool{
		"/a/b":   true,  // exact
		"/a/b/c": true,  // descendant
		"/a/bc":  false, // sibling prefix, not a child
		"/a":     false,
		"/x/y/z": true,
		"/other": false,
	}
	for p, want := range cases {
		if got := IsExcluded(p, ex); got != want {
			t.Errorf("IsExcluded(%q) = %v, want %v", p, got, want)
		}
	}
	if IsExcluded("/a", nil) {
		t.Error("empty excludes should match nothing")
	}
}
