// Package rules defines the data model for scannable/cleanable disk items and
// the OS-aware catalog that classifies them. It has no terminal dependency so a
// GUI can reuse it.
package rules

// Category groups items for display.
type Category int

const (
	Caches Category = iota
	BuildArtifacts
	PackageStores
	Simulators
	LargeFiles
	AppData
)

func (c Category) String() string {
	switch c {
	case Caches:
		return "Caches"
	case BuildArtifacts:
		return "Build artifacts"
	case PackageStores:
		return "Package stores"
	case Simulators:
		return "Simulators & emulators"
	case LargeFiles:
		return "Large files"
	case AppData:
		return "App data"
	default:
		return "Other"
	}
}

// Tier expresses cleanup safety.
type Tier int

const (
	Safe   Tier = iota // regenerates automatically; hard-delete is fine
	Review             // real user data; needs judgment; trash by default
	Keep               // protected; never selectable
)

func (t Tier) String() string {
	switch t {
	case Safe:
		return "SAFE"
	case Review:
		return "REVIEW"
	case Keep:
		return "KEEP"
	default:
		return "?"
	}
}

// CleanMethod is how an item is reclaimed.
type CleanMethod int

const (
	methodDefault CleanMethod = iota // unset -> derive from Tier
	Remove                           // rm -rf
	Trash                            // move to OS trash
	Command                          // run Item.Command instead of deleting a path
)

// Source records how an item was discovered.
type Source int

const (
	CatalogSource Source = iota
	Heuristic
)

// Item is one scannable/cleanable thing.
type Item struct {
	Path     string
	Label    string
	Bytes    int64
	Category Category
	Tier     Tier
	Method   CleanMethod
	Command  []string
	Source   Source
}

// Selectable reports whether the user may select this item for cleaning.
func (i Item) Selectable() bool { return i.Tier != Keep }

// EffectiveMethod resolves the method, deriving from Tier when unset.
func (i Item) EffectiveMethod() CleanMethod {
	if i.Method != methodDefault {
		return i.Method
	}
	if i.Tier == Review {
		return Trash
	}
	return Remove
}
