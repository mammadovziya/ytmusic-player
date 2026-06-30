import { accessSync, constants, existsSync, readdirSync, statSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { delimiter, join } from 'path';

const APP_DIR = 'ytmusic-cli';

export const isWindows = process.platform === 'win32';

export function getConfigDir(): string {
  if (isWindows) {
    const base = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(base, APP_DIR);
  }

  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, APP_DIR);
}

export function getMusicDir(): string {
  return join(homedir(), 'Music', APP_DIR);
}

export function getMpvIpcPath(): string {
  if (isWindows) {
    return `\\\\.\\pipe\\ytmusic-player-mpv-${process.pid}`;
  }

  return join(tmpdir(), `ytmusic-player-mpv-${process.pid}.sock`);
}

export function refreshExecutablePath() {
  if (!isWindows) return;

  const currentPath = process.env.Path || process.env.PATH || '';
  const extraPaths = [
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links') : '',
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps') : '',
    process.env.APPDATA ? join(process.env.APPDATA, 'npm') : '',
    'C:\\Program Files\\MPV Player',
  ].filter(Boolean);

  process.env.PATH = Array.from(new Set(
    [...currentPath.split(delimiter), ...extraPaths].filter(Boolean)
  )).join(delimiter);
}

export function commandExists(command: string): boolean {
  return resolveCommand(command) !== null;
}

export function resolveCommand(command: string): string | null {
  const hasPathSeparator = command.includes('/') || command.includes('\\');
  const searchDirs = hasPathSeparator
    ? ['']
    : (process.env.PATH || '').split(delimiter).filter(Boolean);
  const names = getCommandNames(command);

  for (const dir of searchDirs) {
    for (const name of names) {
      const candidate = dir ? join(dir, name) : name;
      if (isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  return isWindows ? findWindowsCommand(command) : null;
}

function getCommandNames(command: string): string[] {
  if (!isWindows || /\.[^\\/]+$/.test(command)) {
    return [command];
  }

  const pathExt = process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD';
  const extensions = new Set(pathExt.split(';').map(ext => ext.toLowerCase()).filter(Boolean));
  const preferredExtensions = ['.exe', '.cmd', '.bat', ...extensions].filter(ext => ext !== '.com');
  const orderedExtensions = Array.from(new Set(preferredExtensions));

  return [command, ...orderedExtensions.map(ext => `${command}${ext}`)];
}

function findWindowsCommand(command: string): string | null {
  const executable = command.endsWith('.exe') ? command : `${command}.exe`;
  const bases = [
    process.env.APPDATA ? join(process.env.APPDATA, 'npm') : '',
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links') : '',
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps') : '',
    'C:\\Program Files\\MPV Player',
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages') : '',
  ].filter(Boolean);

  for (const base of bases) {
    const direct = join(base, executable);
    if (isExecutable(direct)) return direct;

    const found = findFile(base, executable, 4);
    if (found) return found;
  }

  return null;
}

function findFile(dir: string, fileName: string, depth: number): string | null {
  if (depth < 0 || !existsSync(dir)) return null;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (entry.toLowerCase() === fileName.toLowerCase() && isExecutable(fullPath)) {
      return fullPath;
    }
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    try {
      if (statSync(fullPath).isDirectory()) {
        const found = findFile(fullPath, fileName, depth - 1);
        if (found) return found;
      }
    } catch {}
  }

  return null;
}

function isExecutable(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, isWindows ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
