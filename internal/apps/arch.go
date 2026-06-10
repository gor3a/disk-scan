// Package apps enumerates installed macOS applications and classifies each
// app binary's CPU architecture (Intel / Universal / Apple Silicon), so the
// GUI can flag Intel-only apps that run under Rosetta on Apple Silicon.
//
// The arch parsing (debug/macho) is byte-level and works on any OS, so the
// logic here is cross-platform and unit-tested on Linux CI. Only the install
// roots and the host-hardware check (apps_darwin.go) are darwin-specific.
package apps

import "debug/macho"

// Arch is an app binary's architecture classification.
type Arch int

const (
	ArchUnknown      Arch = iota
	ArchIntel             // x86_64 / i386 only — runs under Rosetta on Apple Silicon
	ArchAppleSilicon      // arm64 only — native
	ArchUniversal         // both — runs native
)

func (a Arch) String() string {
	switch a {
	case ArchIntel:
		return "intel"
	case ArchAppleSilicon:
		return "appleSilicon"
	case ArchUniversal:
		return "universal"
	default:
		return "unknown"
	}
}

// classify reduces the CPU types present in a (possibly fat) binary to an Arch.
func classify(cpus []macho.Cpu) Arch {
	hasIntel, hasArm := false, false
	for _, c := range cpus {
		switch c {
		case macho.CpuAmd64, macho.Cpu386:
			hasIntel = true
		case macho.CpuArm64:
			hasArm = true
		}
	}
	switch {
	case hasIntel && hasArm:
		return ArchUniversal
	case hasArm:
		return ArchAppleSilicon
	case hasIntel:
		return ArchIntel
	default:
		return ArchUnknown
	}
}

// readArchs returns the CPU types present in the Mach-O at path, handling both
// fat (universal) and thin binaries.
func readArchs(path string) ([]macho.Cpu, error) {
	if fat, err := macho.OpenFat(path); err == nil {
		defer fat.Close()
		cpus := make([]macho.Cpu, 0, len(fat.Arches))
		for _, a := range fat.Arches {
			cpus = append(cpus, a.Cpu)
		}
		return cpus, nil
	}
	f, err := macho.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return []macho.Cpu{f.Cpu}, nil
}

// ArchOf classifies the executable at path. Unreadable or non-Mach-O files
// (scripts, missing executables) classify as ArchUnknown.
func ArchOf(exePath string) Arch {
	cpus, err := readArchs(exePath)
	if err != nil {
		return ArchUnknown
	}
	return classify(cpus)
}
