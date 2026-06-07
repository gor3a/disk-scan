package scan

import (
	"os"
	"strings"
)

// IsExcluded reports whether path equals or sits under any excluded prefix.
func IsExcluded(path string, excludes []string) bool {
	for _, e := range excludes {
		if e == "" {
			continue
		}
		if path == e || strings.HasPrefix(path, e+string(os.PathSeparator)) {
			return true
		}
	}
	return false
}
