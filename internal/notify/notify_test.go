package notify

import "testing"

func TestNotifyNoOpWhenDisabled(t *testing.T) {
	t.Setenv("DSCAN_NO_NOTIFY", "1")
	Notify("dscan", "hello") // must not exec or panic
}

func TestNotifyNoOpWhenEmpty(t *testing.T) {
	Notify("dscan", "") // empty body → no-op
}
