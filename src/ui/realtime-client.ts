/**
 * CQM2 v2.1.0 Local Workstation WebSocket Client (`src/ui/realtime-client.ts`).
 * Connects ONLY after `/api/v1/hardware` confirms Local Quad-Silicon Server mode is active
 * (never opens speculative sockets on static GitHub Pages deployments), using capped exponential backoff.
 */

export interface RealtimeServerPacket {
  type: string;
  tick?: number;
  merkleRootHex?: string;
  aliveCount?: number;
  [key: string]: unknown;
}

export class Cqm2RealtimeClient {
  private ws: WebSocket | null = null;
  private closedExplicitly = false;
  private retryDelayMs = 500;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onPacket: (pkt: RealtimeServerPacket) => void;

  public constructor(onPacket: (pkt: RealtimeServerPacket) => void) {
    this.onPacket = onPacket;
  }

  public connect(): void {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
    this.closedExplicitly = false;
    this.openSocket();
  }

  private openSocket(): void {
    if (this.closedExplicitly || typeof window === 'undefined') return;
    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws`;
      const sock = new WebSocket(url);
      this.ws = sock;

      sock.onopen = () => {
        this.retryDelayMs = 500;
      };

      sock.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return;
        try {
          const parsed = JSON.parse(ev.data) as RealtimeServerPacket;
          if (parsed && typeof parsed.type === 'string') {
            this.onPacket(parsed);
          }
        } catch {
          // Ignore malformed frame
        }
      };

      sock.onclose = () => {
        this.ws = null;
        if (!this.closedExplicitly) {
          const wait = this.retryDelayMs;
          this.retryDelayMs = Math.min(8000, Math.round(this.retryDelayMs * 1.8));
          this.retryTimer = setTimeout(() => this.openSocket(), wait);
        }
      };

      sock.onerror = () => {
        // Handled cleanly in onclose backoff
      };
    } catch {
      // Non-fatal in sandboxed contexts
    }
  }

  public sendJson(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public close(): void {
    this.closedExplicitly = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    this.ws = null;
  }
}
