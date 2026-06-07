package serve

import (
	"os/exec"
	"strconv"
	"strings"
	"syscall"
)

// killLockers best-effort SIGTERMs processes holding files under any of paths,
// so a project delete isn't fought by a watcher/dev-server. Uses `lsof`; if it
// is missing or errors, this is a no-op.
func killLockers(paths []string) {
	self := syscall.Getpid()
	for _, p := range paths {
		out, err := exec.Command("lsof", "-t", "+D", p).Output()
		if err != nil {
			continue
		}
		for _, line := range strings.Fields(string(out)) {
			if pid, perr := strconv.Atoi(line); perr == nil && pid != self {
				_ = syscall.Kill(pid, syscall.SIGTERM)
			}
		}
	}
}
