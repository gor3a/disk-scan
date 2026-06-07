// Package serve runs the dscan engine as a headless JSON loop over stdio, for
// the Electron GUI. One JSON object per line in each direction.
package serve

import (
	"path/filepath"

	"github.com/gor3a/disk-scan/internal/engine"
	"github.com/gor3a/disk-scan/internal/rules"
)

// ItemDTO is the wire form of a rules.Item (string enums, stable id).
type ItemDTO struct {
	ID         string   `json:"id"`
	Path       string   `json:"path"`
	Label      string   `json:"label"`
	Bytes      int64    `json:"bytes"`
	Category   string   `json:"category"`
	Tier       string   `json:"tier"`   // SAFE|REVIEW|KEEP
	Method     string   `json:"method"` // remove|trash|command
	Source     string   `json:"source"` // catalog|heuristic
	Selectable bool     `json:"selectable"`
	Modified   int64    `json:"modified,omitempty"`
	Kind       string   `json:"kind,omitempty"`
	Command    []string `json:"command,omitempty"`
}

// Request is a command from the GUI (main → sidecar stdin).
type Request struct {
	Cmd         string   `json:"cmd"`         // scan|clean|cancel
	Kind        string   `json:"kind"`        // scan: "caches" (default) | "projects"
	Root        string   `json:"root"`        // scan projects: folder to search
	Excludes    []string `json:"excludes"`    // scan: skip these path prefixes
	System      bool     `json:"system"`      // scan: include system dirs
	IDs         []string `json:"ids"`         // clean: which items
	DryRun      bool     `json:"dryRun"`      // clean: preview only
	KillLockers bool     `json:"killLockers"` // clean: SIGTERM processes holding the paths first
}

// Event is an outbound message (sidecar → main stdout). Only the fields
// relevant to the event are populated; the rest are omitted.
type Event struct {
	Event       string    `json:"event"`
	Disk        *diskInfo `json:"disk,omitempty"`
	Item        *ItemDTO  `json:"item,omitempty"`
	Scanned     int       `json:"scanned,omitempty"`
	Phase       string    `json:"phase,omitempty"`
	Bytes       int64     `json:"bytes,omitempty"`
	Path        string    `json:"path,omitempty"`
	Reclaimable int64     `json:"reclaimable,omitempty"`
	Freed       int64     `json:"freed,omitempty"`
	Trashed     int64     `json:"trashed,omitempty"`
	Errors      []string  `json:"errors,omitempty"`
	Message     string    `json:"message,omitempty"`
}

type diskInfo struct {
	Used  int64 `json:"used"`
	Free  int64 `json:"free"`
	Total int64 `json:"total"`
}

func itemID(it rules.Item) string {
	if it.Path != "" {
		return it.Path
	}
	return "cmd:" + it.Label
}

func methodString(m rules.CleanMethod) string {
	switch m {
	case rules.Trash:
		return "trash"
	case rules.Command:
		return "command"
	default:
		return "remove"
	}
}

func sourceString(s rules.Source) string {
	if s == rules.Heuristic {
		return "heuristic"
	}
	return "catalog"
}

// projectDTO maps an engine.Project to the wire form. node_modules is its own
// "Projects" category and is regenerable, so SAFE/remove.
func projectDTO(p engine.Project) ItemDTO {
	return ItemDTO{
		ID:         p.Path,
		Path:       p.Path,
		Label:      filepath.Base(p.Dir),
		Bytes:      p.Bytes,
		Category:   "Projects",
		Tier:       "SAFE",
		Method:     "remove",
		Source:     "heuristic",
		Selectable: true,
		Modified:   p.Modified,
		Kind:       p.Kind,
	}
}

// ToDTO converts an engine item to its wire form.
func ToDTO(it rules.Item) ItemDTO {
	return ItemDTO{
		ID:         itemID(it),
		Path:       it.Path,
		Label:      it.Label,
		Bytes:      it.Bytes,
		Category:   it.Category.String(),
		Tier:       it.Tier.String(),
		Method:     methodString(it.EffectiveMethod()),
		Source:     sourceString(it.Source),
		Selectable: it.Selectable(),
		Command:    it.Command,
	}
}
