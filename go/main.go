// CQM2 v2.1.0 Hardware Telemetry & TouchDesigner / Unity / Blender OSC Streaming Bridge
// Runs a background 1 Hz `nvidia-smi` poller (zero per-request process spawns) and a continuous
// 20 Hz UDP OSC 1.0 emitter broadcasting `/cqm2/hw`, `/cqm2/asmodenius/pci`, `/cqm2/hoggar/violated_hex`,
// and `/cqm2/xylos/indicators` to TouchDesigner / Unity / Blender!
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
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
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

type SimBridgeMetrics struct {
	Tick              int64   `json:"tick"`
	AsmodeniusPci     float64 `json:"asmodeniusPci"`
	ViolatedHexLines  int     `json:"violatedHexLines"`
	XylosVeridicalTag float64 `json:"xylosVeridicalTag"`
	PopulationAlive   int     `json:"populationAlive"`
}

type TelemetrySnapshot struct {
	TimestampUnixMs int64            `json:"timestampUnixMs"`
	HostOS          string           `json:"hostOs"`
	HostArch        string           `json:"hostArch"`
	LogicalCores    int              `json:"logicalCores"`
	Gpu             GpuMetrics       `json:"gpu"`
	Sim             SimBridgeMetrics `json:"sim"`
	OscTarget       string           `json:"oscTarget"`
	OscPacketsSent  uint64           `json:"oscPacketsSent"`
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

func resolveOscTarget(flagVal string) string {
	if envTarget := strings.TrimSpace(os.Getenv("CQM2_OSC_TARGET")); envTarget != "" {
		return envTarget
	}
	if envPort := strings.TrimSpace(os.Getenv("CQM2_OSC_PORT")); envPort != "" {
		return "127.0.0.1:" + envPort
	}
	return flagVal
}

func main() {
	once := flag.Bool("once", false, "Print a single JSON hardware snapshot and exit")
	httpAddr := flag.String("http", "127.0.0.1:4201", "Local HTTP telemetry bind address")
	oscFlag := flag.String("osc", "127.0.0.1:9000", "UDP OSC target for TouchDesigner / Unity")
	flag.Parse()

	oscTarget := resolveOscTarget(*oscFlag)
	var mu sync.RWMutex
	cachedGpu := queryNvidiaSmi()
	simState := SimBridgeMetrics{
		Tick:              0,
		AsmodeniusPci:     0.44,
		ViolatedHexLines:  63,
		XylosVeridicalTag: 0.78,
		PopulationAlive:   128,
	}
	var packetsSent uint64

	makeSnapshot := func() TelemetrySnapshot {
		mu.RLock()
		defer mu.RUnlock()
		return TelemetrySnapshot{
			TimestampUnixMs: time.Now().UnixMilli(),
			HostOS:          runtime.GOOS,
			HostArch:        runtime.GOARCH,
			LogicalCores:    runtime.NumCPU(),
			Gpu:             cachedGpu,
			Sim:             simState,
			OscTarget:       oscTarget,
			OscPacketsSent:  packetsSent,
		}
	}

	if *once {
		snap := makeSnapshot()
		enc, _ := json.Marshal(snap)
		fmt.Println(string(enc))
		return
	}

	// Background 1 Hz GPU sensor cache (never spawns `nvidia-smi` inside HTTP handlers!)
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			g := queryNvidiaSmi()
			mu.Lock()
			cachedGpu = g
			mu.Unlock()
		}
	}()

	udpConn, _ := net.Dial("udp", oscTarget)
	if udpConn != nil {
		defer udpConn.Close()
		// Continuous 20 Hz autonomous OSC broadcast loop for TouchDesigner / Unity / Blender
		go func() {
			ticker := time.NewTicker(50 * time.Millisecond)
			defer ticker.Stop()
			for range ticker.C {
				mu.RLock()
				g := cachedGpu
				s := simState
				mu.RUnlock()

				if g.Available {
					_, _ = udpConn.Write(buildOscFloatPacket("/cqm2/hw",
						float32(g.TempC),
						float32(g.PowerWatts),
						float32(g.MemUsedMiB),
						float32(g.UtilGpuPct),
					))
				}
				_, _ = udpConn.Write(buildOscFloatPacket("/cqm2/asmodenius/pci", float32(s.AsmodeniusPci), float32(s.PopulationAlive)))
				_, _ = udpConn.Write(buildOscFloatPacket("/cqm2/hoggar/violated_hex", float32(s.ViolatedHexLines)))
				_, _ = udpConn.Write(buildOscFloatPacket("/cqm2/xylos/indicators", float32(s.XylosVeridicalTag)))

				mu.Lock()
				packetsSent += 4
				mu.Unlock()
			}
		}()
	}

	mux := http.NewServeMux()
	setCors := func(w http.ResponseWriter) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Cross-Origin-Resource-Policy", "cross-origin")
	}

	mux.HandleFunc("/telemetry", func(w http.ResponseWriter, r *http.Request) {
		setCors(w)
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", "GET")
			w.WriteHeader(http.StatusMethodNotAllowed)
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "Method not allowed"})
			return
		}
		_ = json.NewEncoder(w).Encode(makeSnapshot())
	})

	mux.HandleFunc("/state", func(w http.ResponseWriter, r *http.Request) {
		setCors(w)
		if r.Method != http.MethodPost {
			w.Header().Set("Allow", "POST")
			w.WriteHeader(http.StatusMethodNotAllowed)
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "Method not allowed"})
			return
		}
		var next SimBridgeMetrics
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&next); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "Invalid JSON"})
			return
		}
		mu.Lock()
		simState = next
		mu.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	})

	srv := &http.Server{
		Addr:              *httpAddr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	fmt.Printf("[CQM2-Go-Telemetry] Listening on http://%s/telemetry (OSC -> %s)\n", *httpAddr, oscTarget)
	_ = srv.ListenAndServe()
}
