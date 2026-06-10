package apps

import (
	"bytes"
	"debug/macho"
	"encoding/binary"
	"os"
	"path/filepath"
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

// thinMachO returns the bytes of a minimal 64-bit thin Mach-O (header only,
// zero load commands) for the given CPU — enough for debug/macho to read .Cpu.
func thinMachO(cpu macho.Cpu) []byte {
	var b bytes.Buffer
	w := func(v uint32) { _ = binary.Write(&b, binary.LittleEndian, v) }
	w(0xfeedfacf) // MH_MAGIC_64
	w(uint32(cpu))
	w(0x80000000) // cpusubtype (CPU_SUBTYPE_LIB64; value irrelevant to .Cpu)
	w(2)          // filetype MH_EXECUTE
	w(0)          // ncmds
	w(0)          // sizeofcmds
	w(0)          // flags
	w(0)          // reserved (64-bit)
	return b.Bytes()
}

// fatMachO wraps thin slices in a big-endian fat header (FAT_MAGIC), each
// payload 4096-aligned so debug/macho.OpenFat accepts the offsets.
func fatMachO(cpus []macho.Cpu) []byte {
	const align = 12 // 2^12 = 4096
	const step = 1 << align
	var hdr bytes.Buffer
	wb := func(v uint32) { _ = binary.Write(&hdr, binary.BigEndian, v) }
	wb(0xcafebabe)
	wb(uint32(len(cpus)))
	payloads := make([][]byte, len(cpus))
	offset := uint32(step)
	for i, c := range cpus {
		payloads[i] = thinMachO(c)
		wb(uint32(c))                // cputype
		wb(0x80000000)               // cpusubtype
		wb(offset)                   // offset
		wb(uint32(len(payloads[i]))) // size
		wb(align)                    // align
		offset += step
	}
	out := make([]byte, offset)
	copy(out, hdr.Bytes())
	for i, p := range payloads {
		copy(out[uint32(step)*uint32(i+1):], p)
	}
	return out
}

func TestArchOf(t *testing.T) {
	dir := t.TempDir()
	write := func(name string, data []byte) string {
		p := filepath.Join(dir, name)
		if err := os.WriteFile(p, data, 0o755); err != nil {
			t.Fatal(err)
		}
		return p
	}
	if got := ArchOf(write("intel", thinMachO(macho.CpuAmd64))); got != ArchIntel {
		t.Errorf("intel: got %v", got)
	}
	if got := ArchOf(write("arm", thinMachO(macho.CpuArm64))); got != ArchAppleSilicon {
		t.Errorf("arm: got %v", got)
	}
	if got := ArchOf(write("fat", fatMachO([]macho.Cpu{macho.CpuAmd64, macho.CpuArm64}))); got != ArchUniversal {
		t.Errorf("universal: got %v", got)
	}
	if got := ArchOf(write("script", []byte("#!/bin/sh\necho hi\n"))); got != ArchUnknown {
		t.Errorf("non-macho: got %v", got)
	}
	if got := ArchOf(filepath.Join(dir, "missing")); got != ArchUnknown {
		t.Errorf("missing: got %v", got)
	}
}
