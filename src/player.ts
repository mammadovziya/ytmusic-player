import { createConnection, type Socket } from 'net';
import { EventEmitter } from 'events';
import { unlinkSync } from 'fs';
import { getMpvIpcPath, isWindows, resolveCommand } from './platform';

export interface PlayerState {
  title: string;
  paused: boolean;
  timePos: number;
  duration: number;
  volume: number;
  repeatMode: 'off' | 'one' | 'all';
}

export class Player extends EventEmitter {
  private readonly ipcPath = getMpvIpcPath();
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private socket: Socket | null = null;
  private buf = '';
  private reqId = 0;
  private pending = new Map<number, (r: any) => void>();

  state: PlayerState = {
    title: '',
    paused: false,
    timePos: 0,
    duration: 0,
    volume: 100,
    repeatMode: 'off',
  };

  async start() {
    this.cleanupIpcPath();
    const mpv = resolveCommand('mpv') ?? 'mpv';

    this.proc = Bun.spawn(
      [mpv, '--no-video', '--no-terminal', `--input-ipc-server=${this.ipcPath}`, '--idle=yes'],
      { stderr: 'ignore', stdout: 'ignore' }
    );

    await this.connect();
    await this.observe();
  }

  private cleanupIpcPath() {
    if (isWindows) return;

    try {
      unlinkSync(this.ipcPath);
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error
        ? (error as { code?: string }).code
        : undefined;
      if (code !== 'ENOENT') throw error;
    }
  }

  private async connect(timeout = 5000): Promise<void> {
    const deadline = Date.now() + timeout;
    let lastError: unknown;

    while (Date.now() < deadline) {
      try {
        await this.connectOnce();
        return;
      } catch (error) {
        lastError = error;
      }
      await Bun.sleep(50);
    }

    const detail = lastError instanceof Error ? ` Last error: ${lastError.message}` : '';
    throw new Error(`mpv IPC endpoint did not become ready within ${timeout}ms: ${this.ipcPath}.${detail}`);
  }

  private connectOnce(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = createConnection(this.ipcPath);
      const fail = (error: Error) => {
        socket.destroy();
        reject(error);
      };

      socket.once('error', fail);
      socket.once('connect', () => {
        socket.off('error', fail);
        socket.on('error', () => {});
        socket.on('data', (d) => this.onData(d.toString()));
        this.socket = socket;
        resolve();
      });
    });
  }

  private async observe() {
    await this.send('observe_property', 1, 'media-title');
    await this.send('observe_property', 2, 'pause');
    await this.send('observe_property', 3, 'time-pos');
    await this.send('observe_property', 4, 'duration');
    await this.send('observe_property', 5, 'volume');
  }

  private onData(data: string) {
    this.buf += data;
    const lines = this.buf.split('\n');
    this.buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);

        if (msg.request_id !== undefined) {
          this.pending.get(msg.request_id)?.(msg);
          this.pending.delete(msg.request_id);
        }

        if (msg.event === 'property-change') {
          this.onPropChange(msg.name, msg.data);
        } else if (msg.event === 'end-file') {
          this.emit('end-file', msg);
        } else if (msg.event === 'start-file') {
          this.emit('start-file');
        }
      } catch {}
    }
  }

  private onPropChange(name: string, value: any) {
    if (value == null) return;
    switch (name) {
      case 'media-title': this.state.title = value; break;
      case 'pause': this.state.paused = value; break;
      case 'time-pos': this.state.timePos = value; break;
      case 'duration': this.state.duration = value; break;
      case 'volume': this.state.volume = Math.round(value); break;
    }
    this.emit('state');
  }

  private send(...args: any[]): Promise<any> {
    return new Promise((resolve) => {
      const id = ++this.reqId;
      this.pending.set(id, resolve);
      this.socket!.write(JSON.stringify({ command: args, request_id: id }) + '\n');
    });
  }

  async loadTrack(url: string) {
    await this.send('loadfile', url, 'replace');
  }

  async togglePause() { await this.send('cycle', 'pause'); }
  async seek(secs: number) { await this.send('seek', secs, 'relative'); }

  async quit() {
    try { await this.send('quit'); } catch {}
    this.socket?.destroy();
    this.socket = null;
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
    this.cleanupIpcPath();
  }

  async setVolume(level: number) {
    const clamped = Math.max(0, Math.min(100, level));
    await this.send('set_property', 'volume', clamped);
  }

  async getVolume() {
    const result = await this.send('get_property', 'volume');
    return result?.data ?? 100;
  }
  
  async setRepeatMode(mode: 'off' | 'one' | 'all') {
    this.state.repeatMode = mode;
    if (mode === 'one') {
      await this.send('set_property', 'loop-file', 'inf');
      await this.send('set_property', 'loop-playlist', 'no');
    } else if (mode === 'all') {
      await this.send('set_property', 'loop-file', 'no');
      await this.send('set_property', 'loop-playlist', 'inf');
    } else {
      await this.send('set_property', 'loop-file', 'no');
      await this.send('set_property', 'loop-playlist', 'no');
    }
    this.emit('state');
  }
}
