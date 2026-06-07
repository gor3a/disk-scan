//go:build darwin

package notify

import (
	"fmt"
	"os/exec"
)

func dispatch(title, body string) {
	script := fmt.Sprintf("display notification %q with title %q", body, title)
	_ = exec.Command("osascript", "-e", script).Run()
}
