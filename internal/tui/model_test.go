package tui

import (
	"testing"

	"github.com/gor3a/disk-scan/internal/rules"
)

func sample() []rules.Item {
	return []rules.Item{
		{Label: "DerivedData", Bytes: 100, Tier: rules.Safe},
		{Label: "userdata", Bytes: 200, Tier: rules.Review},
		{Label: "whatsapp", Bytes: 300, Tier: rules.Keep},
	}
}

func TestToggleAndTotal(t *testing.T) {
	m := New(sample())
	m.Toggle(0) // select DerivedData
	if got := m.SelectedBytes(); got != 100 {
		t.Errorf("SelectedBytes = %d, want 100", got)
	}
	m.Toggle(1) // select userdata
	if got := m.SelectedBytes(); got != 300 {
		t.Errorf("SelectedBytes = %d, want 300", got)
	}
	m.Toggle(0) // deselect DerivedData
	if got := m.SelectedBytes(); got != 200 {
		t.Errorf("SelectedBytes = %d, want 200", got)
	}
}

func TestToggleKeepIsNoop(t *testing.T) {
	m := New(sample())
	m.Toggle(2) // whatsapp is Keep
	if got := m.SelectedBytes(); got != 0 {
		t.Errorf("Keep toggle must be a no-op, SelectedBytes = %d", got)
	}
	if len(m.Selected()) != 0 {
		t.Error("Keep item must not appear in Selected()")
	}
}

func TestSelectedReturnsItems(t *testing.T) {
	m := New(sample())
	m.Toggle(1)
	sel := m.Selected()
	if len(sel) != 1 || sel[0].Label != "userdata" {
		t.Errorf("Selected() = %+v, want [userdata]", sel)
	}
}

func TestIsSelected(t *testing.T) {
	m := New(sample())
	if m.IsSelected(0) {
		t.Error("nothing selected initially")
	}
	m.Toggle(0)
	if !m.IsSelected(0) {
		t.Error("index 0 should be selected after Toggle")
	}
	m.Toggle(2) // Keep -> no-op
	if m.IsSelected(2) {
		t.Error("Keep item must never read as selected")
	}
}
