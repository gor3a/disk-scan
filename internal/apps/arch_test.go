package apps

import (
	"debug/macho"
	"testing"
)

func TestClassify(t *testing.T) {
	cases := []struct {
		name string
		cpus []macho.Cpu
		want Arch
	}{
		{"intel only", []macho.Cpu{macho.CpuAmd64}, ArchIntel},
		{"arm only", []macho.Cpu{macho.CpuArm64}, ArchAppleSilicon},
		{"universal", []macho.Cpu{macho.CpuAmd64, macho.CpuArm64}, ArchUniversal},
		{"empty", nil, ArchUnknown},
		{"i386 counts as intel", []macho.Cpu{macho.Cpu386}, ArchIntel},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := classify(c.cpus); got != c.want {
				t.Fatalf("classify(%v) = %v, want %v", c.cpus, got, c.want)
			}
		})
	}
}

func TestArchString(t *testing.T) {
	if ArchIntel.String() != "intel" || ArchAppleSilicon.String() != "appleSilicon" ||
		ArchUniversal.String() != "universal" || ArchUnknown.String() != "unknown" {
		t.Fatal("unexpected Arch.String() values")
	}
}
