package main

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/gor3a/disk-scan/internal/rules"
	"github.com/gor3a/disk-scan/internal/tui"
)

// stage is which screen the TUI is showing.
type stage int

const (
	stageList    stage = iota // browse + toggle items
	stageConfirm              // confirm before cleaning
)

type programModel struct {
	model     *tui.Model
	cursor    int
	stage     stage
	confirmed bool
}

func newProgram(items []rules.Item) *programModel {
	return &programModel{model: tui.New(items)}
}

func (m *programModel) Init() tea.Cmd { return nil }

func (m *programModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	key, ok := msg.(tea.KeyMsg)
	if !ok {
		return m, nil
	}
	if key.String() == "ctrl+c" {
		return m, tea.Quit // always cancel, never confirm
	}
	if m.stage == stageConfirm {
		switch key.String() {
		case "enter", "y":
			m.confirmed = true
			return m, tea.Quit
		case "q", "esc", "n":
			m.stage = stageList // back to the list, nothing cleaned
		}
		return m, nil
	}
	// stageList
	switch key.String() {
	case "q":
		return m, tea.Quit
	case "up", "k":
		if m.cursor > 0 {
			m.cursor--
		}
	case "down", "j":
		if m.cursor < len(m.model.Items())-1 {
			m.cursor++
		}
	case " ":
		m.model.Toggle(m.cursor)
	case "enter":
		m.stage = stageConfirm // gate: confirm before cleaning
	}
	return m, nil
}

func (m *programModel) View() string {
	if m.stage == stageConfirm {
		return m.confirmView()
	}
	out := fmt.Sprintf("dscan — space to toggle, enter to review, q to quit\nSELECTED: %s\n\n", humized(m.model.SelectedBytes()))
	for i, it := range m.model.Items() {
		cursor := "  "
		if i == m.cursor {
			cursor = "> "
		}
		check := "[ ]"
		switch {
		case !it.Selectable():
			check = "[-]"
		case m.model.IsSelected(i):
			check = "[x]"
		}
		out += fmt.Sprintf("%s%s %-32s %10s  %s\n", cursor, check, it.Label, humized(it.Bytes), it.Tier)
	}
	return out
}

// confirmView summarizes what will happen before any deletion.
func (m *programModel) confirmView() string {
	sel := m.model.Selected()
	var rm, tr, run int
	for _, it := range sel {
		switch it.EffectiveMethod() {
		case rules.Trash:
			tr++
		case rules.Command:
			run++
		default:
			rm++
		}
	}
	out := fmt.Sprintf("Clean %d item(s), freeing %s?\n\n", len(sel), humized(m.model.SelectedBytes()))
	out += fmt.Sprintf("  %d delete (caches/build — removed directly)\n", rm)
	out += fmt.Sprintf("  %d trash  (user data — recoverable from Trash)\n", tr)
	out += fmt.Sprintf("  %d tool   (run a cleanup command)\n\n", run)
	out += "press enter/y to clean · n/q to go back\n"
	return out
}
