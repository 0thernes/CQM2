// CQM2 Hardware Telemetry & TouchDesigner / Unity / Blender OSC Streaming Bridge
package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"flag"
	"fmt"
	"math"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type GpuMetrics struct {
	Available     bool    `json:"available"`
	Name          string  `json:"name"`
	TempC         float64 `json:"tempC"`
	PowerWatts    float64 `json:"powerWatts"`
	MemUsedMiB    float64 `json:"memUsedMiB"`
	MemTotalMiB   float64 `json:"memTotalMiB"`
	UtilGpuPct    float64 `json:"utilGpuPct"`
	DriverVersion string  `json:"driverVersion"`
}

type TelemetrySnapshot struct {
	TimestampUnixMs int64      `json:"timestampUnixMs"`
	HostOS          string     `json:"hostOs"`
	HostArch        string     `json:"hostArch"`
	LogicalCores    int        `json:"logicalCores"`
	Gpu             GpuMetrics `json:"gpu"`
	OscTarget       string     `json:"oscTarget"`
}

func queryNvidiaSmi() GpuMetrics {
	ctxCmd := exec.Command(
		"nvidia-smi",
		"--query-gpu=name,temperature.gpu,power.draw,memory.used,memory.total,utilization.gpu,driver_version",
		"--format=csv,noheader,nounits",
	)
	out, err := ctxCmd.Output()
	if err != nil {
		return GpuMetrics{Available: false}
	}
	line := strings.TrimSpace(string(out))
	if idx := strings.IndexByte(line, '\n'); idx >= 0 {
		line = strings.TrimSpace(line[:idx])
	}
	parts := strings.Split(line, ",")
	if len(parts) < 7 {
		return GpuMetrics{Available: false}
	}
	parseF := func(s string) float64 {
		v, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
		return v
	}
	return GpuMetrics{
		Available:     true,
		Name:          strings.TrimSpace(parts[0]),
		TempC:         parseF(parts[1]),
		PowerWatts:    parseF(parts[2]),
		MemUsedMiB:    parseF(parts[3]),
		MemTotalMiB:   parseF(parts[4]),
		UtilGpuPct:    parseF(parts[5]),
		DriverVersion: strings.TrimSpace(parts[6]),
	}
}

// Encodes a standard Open Sound Control (OSC 1.0) packet with float32 args for TouchDesigner / Unity
func buildOscFloatPacket(address string, values ...float32) []byte {
	var buf bytes.Buffer
	writeOscString := func(s string) {
		buf.WriteString(s)
		buf.WriteByte(0)
		for buf.Len()%4 != 0 {
			buf.WriteByte(0)
		}
	}
	writeOscString(address)
	tags := "," + strings.Repeat("f", len(values))
	writeOscString(tags)
	for _, v := range values {
		var b [4]byte
		binary.BigEndian.PutUint32(b[:], math.Float32bits(v))
		buf.Write(b[:])
	}
	return buf.Bytes()
}

func collectSnapshot(oscTarget string) TelemetrySnapshot {
	return TelemetrySnapshot{
		TimestampUnixMs: time.Now().UnixMilli(),
		HostOS:          runtime.GOOS,
		HostArch:        runtime.GOARCH,
		LogicalCores:    runtime.NumCPU(),
		Gpu:             queryNvidiaSmi(),
		OscTarget:       oscTarget,
	}
}

func main() {
	once := flag.Bool("once", false, "Print a single JSON hardware snapshot and exit")
	httpAddr := flag.String("http", "127.0.0.1:4201", "Local HTTP telemetry bind address")
	oscTarget := flag.String("osc", "127.0.0.1:9000", "UDP OSC target for TouchDesigner / Unity")
	flag.Parse()

	if *once {
		snap := collectSnapshot(*oscTarget)
		enc, _ := json.Marshal(snap)
		fmt.Println(string(enc))
		return
	}

	udpConn, _ := net.Dial("udp", *oscTarget)
	if udpConn != nil {
		defer udpConn.Close()
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/telemetry", func(w http.ResponseWriter, r *http.Request) {
		snap := collectSnapshot(*oscTarget)
		if udpConn != nil && snap.Gpu.Available {
			pkt := buildOscFloatPacket("/cqm2/hw",
				float32(snap.Gpu.TempC),
				float32(snap.Gpu.PowerWatts),
				float32(snap.Gpu.MemUsedMiB),
				float32(snap.Gpu.UtilGpuPct),
			)
			_, _ = udpConn.Write(pkt)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:4200")
		_ = json.NewEncoder(w).Encode(snap)
	})

	srv := &http.Server{
		Addr:              *httpAddr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	fmt.Printf("[CQM2-Go-Telemetry] Listening on http://%s/telemetry (OSC -> %s)\n", *httpAddr, *oscTarget)
	_ = srv.ListenAndServe()
}
