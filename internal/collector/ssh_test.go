package collector

import "testing"

// parseTempValue tests ----------------------------------------------------------------

func TestParseTempValue_Normal(t *testing.T) {
	line := "Package id 0:  +51.0°C  (high = +80.0°C, crit = +100.0°C)"
	got := parseTempValue(line)
	if got != 51.0 {
		t.Errorf("expected 51.0, got %f", got)
	}
}

func TestParseTempValue_CoreLine(t *testing.T) {
	line := "Core 3:         +47.0°C  (high = +80.0°C, crit = +100.0°C)"
	got := parseTempValue(line)
	if got != 47.0 {
		t.Errorf("expected 47.0, got %f", got)
	}
}

func TestParseTempValue_NegativeTemp(t *testing.T) {
	// Negative temperatures (e.g. on some environmental sensors) do not start with +
	// The function is documented to return 0 for lines without a leading '+'.
	line := "temp1:        -5.0°C"
	got := parseTempValue(line)
	if got != 0 {
		t.Errorf("expected 0 for negative sensor line (no '+'), got %f", got)
	}
}

func TestParseTempValue_MissingPlus(t *testing.T) {
	line := "Some label: 55.0°C"
	got := parseTempValue(line)
	if got != 0 {
		t.Errorf("expected 0 when '+' is absent, got %f", got)
	}
}

func TestParseTempValue_EmptyString(t *testing.T) {
	got := parseTempValue("")
	if got != 0 {
		t.Errorf("expected 0 for empty string, got %f", got)
	}
}

func TestParseTempValue_MissingDegreeSign(t *testing.T) {
	// Falls back to whitespace/paren separator
	line := "Package id 0:  +62.5 (high = +80.0)"
	got := parseTempValue(line)
	if got != 62.5 {
		t.Errorf("expected 62.5, got %f", got)
	}
}

func TestParseTempValue_TrailingSpaceNoSuffix(t *testing.T) {
	// Only a '+' followed by a number and then end-of-string — no suffix at all
	// This should return 0 because there is no terminator after the digits.
	line := "+99.9"
	got := parseTempValue(line)
	// No "°", " ", "(", or tab after digits → end < 0 → returns 0
	if got != 0 {
		t.Errorf("expected 0 when no terminator present, got %f", got)
	}
}

// cmdConstants tests -----------------------------------------------------------------

func TestCmdConstants_NotEmpty(t *testing.T) {
	cmds := map[string]string{
		"cmdCPUUsage":     cmdCPUUsage,
		"cmdRAMUsage":     cmdRAMUsage,
		"cmdDiskUsage":    cmdDiskUsage,
		"cmdLoadAvg":      cmdLoadAvg,
		"cmdUptime":       cmdUptime,
		"cmdSwapUsage":    cmdSwapUsage,
		"cmdProcCount":    cmdProcCount,
		"cmdSensors":      cmdSensors,
		"cmdNginxDomains": cmdNginxDomains,
	}
	for name, val := range cmds {
		if val == "" {
			t.Errorf("constant %s must not be empty", name)
		}
	}
}
