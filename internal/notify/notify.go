// Package notify shows best-effort desktop notifications.
package notify

import "os"

// Notify posts a desktop notification. No-op when the body is empty or
// DSCAN_NO_NOTIFY is set (tests/headless).
func Notify(title, body string) {
	if body == "" || os.Getenv("DSCAN_NO_NOTIFY") != "" {
		return
	}
	dispatch(title, body)
}
