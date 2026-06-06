package main

import "testing"

func TestIsServeMode(t *testing.T) {
	if !isServeMode([]string{"dscan", "serve"}) {
		t.Fatal("serve should be detected")
	}
	if isServeMode([]string{"dscan"}) {
		t.Fatal("no subcommand is not serve")
	}
	if isServeMode([]string{"dscan", "--yes"}) {
		t.Fatal("flags are not serve")
	}
}
