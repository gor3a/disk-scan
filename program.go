package main

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/gor3a/disk-scan/internal/rules"
	"github.com/gor3a/disk-scan/internal/tui"
)

type programModel struct {
	model     *tui.Model
	cursor    int
	confirmed bool
}

func newProgram(items []rules.Item) *programModel {
	return &programModel{model: tui.New(items)}
}

func (m *programModel) Init() tea.Cmd { return nil }

func (m *programModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if key, ok := msg.(tea.KeyMsg); ok {
		switch key.String() {
		case "q", "ctrl+c":
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
			m.confirmed = true
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m *programModel) View() string {
	var b lipgloss.Style
	_ = b
	out := fmt.Sprintf("dscan — space to toggle, enter to clean, q to quit\nSELECTED: %s\n\n", humized(m.model.SelectedBytes()))
	for i, it := range m.model.Items() {
		cursor := "  "
		if i == m.cursor {
			cursor = "> "
		}
		check := "[ ]"
		if !it.Selectable() {
			check = "[-]"
		}
		out += fmt.Sprintf("%s%s %-32s %10s  %s\n", cursor, check, it.Label, humized(it.Bytes), it.Tier)
	}
	return out
}

// cursor lives on programModel to keep tui.Model free of view concerns.
