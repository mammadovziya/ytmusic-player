import { mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Track, Playlist } from './types';
import type { Lang } from './i18n';
import { getConfigDir, getMusicDir } from './platform';

const CONFIG_DIR = getConfigDir();
export const MUSIC_DIR = getMusicDir();
const FAVORITES_PATH = join(CONFIG_DIR, 'favorites.json');
const PLAYLISTS_PATH = join(CONFIG_DIR, 'playlists.json');
const DOWNLOADS_PATH = join(CONFIG_DIR, 'downloads.json');
const SETTINGS_PATH = join(CONFIG_DIR, 'settings.json');

export interface Settings {
  lang: Lang;
}

function ensureConfigDir() {
  mkdirSync(CONFIG_DIR, { recursive: true });
  mkdirSync(MUSIC_DIR, { recursive: true });
}

export function loadSettings(): Settings {
  try {
    const text = readFileSync(SETTINGS_PATH, 'utf8');
    return JSON.parse(text);
  } catch {
    return { lang: 'en' };
  }
}

export function saveSettings(settings: Settings) {
  ensureConfigDir();
  Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export function loadFavorites(): Track[] {
  try {
    const text = readFileSync(FAVORITES_PATH, 'utf8');
    return JSON.parse(text);
  } catch {
    return [];
  }
}

export function saveFavorites(favorites: Track[]) {
  ensureConfigDir();
  Bun.write(FAVORITES_PATH, JSON.stringify(favorites, null, 2));
}

export function isFavorite(favorites: Track[], id: string): boolean {
  return favorites.some(t => t.id === id);
}

export function toggleFavorite(favorites: Track[], track: Track): { favorites: Track[]; added: boolean } {
  const idx = favorites.findIndex(t => t.id === track.id);
  if (idx >= 0) {
    favorites.splice(idx, 1);
    saveFavorites(favorites);
    return { favorites, added: false };
  } else {
    favorites.push(track);
    saveFavorites(favorites);
    return { favorites, added: true };
  }
}

// ─── Playlists ──────────────────────────────────────────────────────────────

export function loadPlaylists(): Playlist[] {
  try {
    const text = readFileSync(PLAYLISTS_PATH, 'utf8');
    return JSON.parse(text);
  } catch {
    return [];
  }
}

export function savePlaylists(playlists: Playlist[]) {
  ensureConfigDir();
  Bun.write(PLAYLISTS_PATH, JSON.stringify(playlists, null, 2));
}

export function createPlaylist(playlists: Playlist[], name: string): Playlist {
  const playlist: Playlist = {
    id: Date.now().toString(36),
    name,
    tracks: [],
    createdAt: new Date().toISOString(),
  };
  playlists.push(playlist);
  savePlaylists(playlists);
  return playlist;
}

export function deletePlaylist(playlists: Playlist[], id: string): Playlist[] {
  const filtered = playlists.filter(p => p.id !== id);
  savePlaylists(filtered);
  return filtered;
}

export function addTrackToPlaylist(playlists: Playlist[], playlistId: string, track: Track): boolean {
  const playlist = playlists.find(p => p.id === playlistId);
  if (!playlist) return false;
  if (playlist.tracks.some(t => t.id === track.id)) return false;
  playlist.tracks.push(track);
  savePlaylists(playlists);
  return true;
}

export function renamePlaylist(playlists: Playlist[], id: string, newName: string) {
  const playlist = playlists.find(p => p.id === id);
  if (!playlist) return;
  playlist.name = newName;
  savePlaylists(playlists);
}

export function removeTrackFromPlaylist(playlists: Playlist[], playlistId: string, trackIdx: number) {
  const playlist = playlists.find(p => p.id === playlistId);
  if (!playlist) return;
  playlist.tracks.splice(trackIdx, 1);
  savePlaylists(playlists);
}

// ─── Downloads ──────────────────────────────────────────────────────────────

export function loadDownloads(): Track[] {
  try {
    const text = readFileSync(DOWNLOADS_PATH, 'utf8');
    return JSON.parse(text);
  } catch {
    return [];
  }
}

export function saveDownloads(downloads: Track[]) {
  ensureConfigDir();
  Bun.write(DOWNLOADS_PATH, JSON.stringify(downloads, null, 2));
}

export function isDownloaded(downloads: Track[], id: string): boolean {
  return downloads.some(t => t.id === id);
}

export function addDownloadRecord(downloads: Track[], track: Track): Track[] {
  if (!isDownloaded(downloads, track.id)) {
    downloads.push(track);
    saveDownloads(downloads);
  }
  return downloads;
}

export function deleteDownloadRecord(downloads: Track[], trackId: string): Track[] {
  const filtered = downloads.filter(t => t.id !== trackId);
  saveDownloads(filtered);
  return filtered;
}
