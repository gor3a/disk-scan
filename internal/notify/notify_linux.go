//go:build linux

package notify

import "os/exec"

func dispatch(title, body string) {
	_ = exec.Command("notify-send", title, body).Run()
}
