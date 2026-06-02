package rules

import "testing"

func TestTierString(t *testing.T) {
	cases := map[Tier]string{Safe: "SAFE", Review: "REVIEW", Keep: "KEEP"}
	for tier, want := range cases {
		if got := tier.String(); got != want {
			t.Errorf("Tier(%d).String() = %q, want %q", tier, got, want)
		}
	}
}

func TestSelectable(t *testing.T) {
	if (Item{Tier: Keep}).Selectable() {
		t.Error("Keep items must not be selectable")
	}
	if !(Item{Tier: Safe}).Selectable() {
		t.Error("Safe items must be selectable")
	}
	if !(Item{Tier: Review}).Selectable() {
		t.Error("Review items must be selectable")
	}
}

func TestDefaultMethod(t *testing.T) {
	// Safe with no explicit method -> Remove; Review -> Trash.
	if m := (Item{Tier: Safe}).EffectiveMethod(); m != Remove {
		t.Errorf("Safe default method = %v, want Remove", m)
	}
	if m := (Item{Tier: Review}).EffectiveMethod(); m != Trash {
		t.Errorf("Review default method = %v, want Trash", m)
	}
	// Explicit method wins.
	if m := (Item{Tier: Safe, Method: Command}).EffectiveMethod(); m != Command {
		t.Errorf("explicit method = %v, want Command", m)
	}
}
