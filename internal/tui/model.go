// Package tui holds the interactive checklist. The selection logic lives in
// Model and is tested headless; Bubble Tea view/update wiring is thin.
package tui

import "github.com/gor3a/disk-scan/internal/rules"

// Model is the pure, testable selection state.
type Model struct {
	items    []rules.Item
	selected map[int]bool
	cursor   int
}

// New builds a Model over the scanned items.
func New(items []rules.Item) *Model {
	return &Model{items: items, selected: map[int]bool{}}
}

// Toggle flips selection for the item at index i. No-op for Keep items.
func (m *Model) Toggle(i int) {
	if i < 0 || i >= len(m.items) {
		return
	}
	if !m.items[i].Selectable() {
		return
	}
	if m.selected[i] {
		delete(m.selected, i)
	} else {
		m.selected[i] = true
	}
}

// IsSelected reports whether the item at index i is currently selected.
func (m *Model) IsSelected(i int) bool { return m.selected[i] }

// SelectedBytes is the running freed-space total of selected items.
func (m *Model) SelectedBytes() int64 {
	var total int64
	for i := range m.selected {
		total += m.items[i].Bytes
	}
	return total
}

// Selected returns the chosen items.
func (m *Model) Selected() []rules.Item {
	var out []rules.Item
	for i := range m.selected {
		out = append(out, m.items[i])
	}
	return out
}

// Items exposes all items (for rendering).
func (m *Model) Items() []rules.Item { return m.items }
