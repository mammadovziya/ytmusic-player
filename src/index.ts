import { search, fetchMix } from './search';
import { Player } from './player';
import { renderSearch, renderResults, renderPlayer, renderFavorites, clearScreen, renderPlaylistList, renderPlaylistDetail, renderPlaylistPicker, renderNewPlaylistInput, renderRenamePlaylistInput, renderLanguagePicker, renderDownloads } from './ui';
import { loadFavorites, isFavorite, toggleFavorite, loadPlaylists, createPlaylist, deletePlaylist, renamePlaylist, addTrackToPlaylist, removeTrackFromPlaylist, loadSettings, saveSettings, loadDownloads, isDownloaded, addDownloadRecord, MUSIC_DIR, deleteDownloadRecord } from './config';
import { join } from 'path';
import { statSync } from 'fs';
import { setLang, getLang, t, LANGS } from './i18n';
import type { Playlist } from './types';
import type { Track } from './types';
import { resolveCommand } from './platform';
import { ensureRuntimeDependencies } from './dependencies';
import { getYtdlpPrivacyArgs } from './privacy';

// Arrow keys & special keys
const UP = '\x1B[A';
const DOWN = '\x1B[B';
const LEFT = '\x1B[D';
const RIGHT = '\x1B[C';
const VOLUME_STEP = 5;
const VERSION = '0.3.4';

// Version handling
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

type AppState = 'search-input' | 'search-results' | 'playing' | 'favorites' | 'playlist-list' | 'playlist-detail' | 'playlist-picker' | 'new-playlist' | 'rename-playlist' | 'language-picker' | 'downloads' | 'help' | 'queue-view' | 'track-info';

let appState: AppState = 'search-input';
let searchMode: 'typing' | 'command' = 'typing';
let searchQuery = '';
let results: Track[] = [];
let selectedIdx = 0;
let queue: Track[] = [];
let history: Track[] = [];
let fetchingMix = false;
let currentTrack: Track | null = null;
let favorites: Track[] = [];
let favSelectedIdx = 0;
let downloads: Track[] = [];
let dlSelectedIdx = 0;
let downloadingTracks = new Set<string>();
let downloadProcs = new Set<ReturnType<typeof Bun.spawn>>();
let playlists: Playlist[] = [];
let plSelectedIdx = 0;
let plDetailIdx = 0;
let currentPlaylist: Playlist | null = null;
let plPickerIdx = 0;
let newPlaylistName = '';
let renamePlaylistName = '';
let renamingPlaylistId = '';
let prePlaylistState: AppState = 'playing';
let preLanguageState: AppState = 'playing';
let preHelpState: AppState = 'playing';
let preQueueState: AppState = 'playing';
let preTrackInfoState: AppState = 'playing';
let preListViewState: AppState = 'search-input';
let langPickerIdx = 0;
let shuffleMode = false;
let volume = 100;
let renderTimer: ReturnType<typeof setInterval> | null = null;

function shuffleArray(arr: Track[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

const player = new Player();

// ─── Checks ────────────────────────────────────────────────────────────────

// ─── Player events ─────────────────────────────────────────────────────────

// State updates are handled by player internally.
// Rendering is driven by the 1-second timer in startPlaying to avoid flicker.

player.on('end-file', async (event: { reason: string }) => {
  // Only auto-advance on natural end (eof), not on manual skip/replace
  if (event.reason !== 'eof' || appState !== 'playing') return;

  if (queue.length > 0) {
    if (currentTrack) history.push(currentTrack);
    const next = queue.shift()!;
    currentTrack = next;
    await player.loadTrack(next.url);

    // Refill mix when queue gets low
    if (queue.length < 5) {
      refillQueue(next.id);
    }
  }
});

// ─── Queue helpers ──────────────────────────────────────────────────────────

function refillQueue(fromId: string) {
  fetchingMix = true;
  const existingIds = new Set(queue.map(t => t.id));
  fetchMix(fromId, 20)
    .then(tracks => {
      const newTracks = tracks.filter(t => t.id !== fromId && !existingIds.has(t.id));
      if (shuffleMode) shuffleArray(newTracks);
      queue.push(...newTracks);
    })
    .catch(() => {})
    .finally(() => { fetchingMix = false; });
}

// ─── State transitions ─────────────────────────────────────────────────────

function goToSearch() {
  appState = 'search-input';
  searchQuery = '';
  searchMode = 'typing';
  if (renderTimer) { clearInterval(renderTimer); renderTimer = null; }
  renderSearch('', '', searchMode);
}

function renderCurrentScreen() {
  switch (appState) {
    case 'search-input':
      renderSearch(searchQuery, '', searchMode);
      break;
    case 'search-results':
      renderResults(results, selectedIdx, new Set(favorites.map(t => t.id)), new Set(downloads.map(t => t.id)), downloadingTracks);
      break;
    case 'playing':
      if (currentTrack) {
        renderPlayer(player.state, currentTrack!, queue, fetchingMix, isFavorite(favorites, currentTrack.id), shuffleMode, volume, isDownloaded(downloads, currentTrack.id), downloadingTracks.has(currentTrack.id));
      } else {
        goToSearch();
      }
      break;
    case 'favorites':
      renderFavorites(favorites, favSelectedIdx, new Set(downloads.map(t => t.id)), downloadingTracks);
      break;
    case 'downloads':
      renderDownloads(downloads, dlSelectedIdx, new Set(favorites.map(t => t.id)));
      break;
    case 'playlist-list':
      renderPlaylistList(playlists, plSelectedIdx, downloads.length, favorites.length);
      break;
    case 'playlist-detail':
      if (currentPlaylist) renderPlaylistDetail(currentPlaylist, plDetailIdx, new Set(favorites.map(t => t.id)), new Set(downloads.map(t => t.id)), downloadingTracks);
      break;
    case 'playlist-picker':
      if (currentTrack) renderPlaylistPicker(playlists, plPickerIdx, currentTrack.title);
      break;
    case 'new-playlist':
      renderNewPlaylistInput(newPlaylistName);
      break;
    case 'rename-playlist':
      renderRenamePlaylistInput(renamePlaylistName);
      break;
    case 'language-picker':
      renderLanguagePicker(LANGS, langPickerIdx);
      break;
    case 'help':
      import('./ui').then(ui => ui.renderHelp());
      break;
    case 'queue-view':
      import('./ui').then(ui => ui.renderQueue(queue, currentTrack || undefined));
      break;
    case 'track-info':
      if (currentTrack) import('./ui').then(ui => ui.renderTrackInfo(currentTrack!));
      break;
  }
}

async function startPlaying(track: Track, remainingTracks?: Track[]) {
  appState = 'playing';
  if (currentTrack) history.push(currentTrack);
  queue = [];
  currentTrack = track;

  // Check if downloaded
  let playUrl = track.url;
  if (isDownloaded(downloads, track.id)) {
    const localPath = join(MUSIC_DIR, `${track.id}.mp3`);
    try {
      if (statSync(localPath).isFile()) {
        playUrl = localPath;
      }
    } catch {}
  }

  await player.loadTrack(playUrl);

  // Refresh display every second for smooth progress bar
  if (renderTimer) clearInterval(renderTimer);
  renderTimer = setInterval(() => {
    if (appState === 'playing' && currentTrack) renderPlayer(player.state, currentTrack!, queue, fetchingMix, isFavorite(favorites, currentTrack.id), shuffleMode, volume, isDownloaded(downloads, currentTrack.id), downloadingTracks.has(currentTrack.id));
  }, 1000);

  if (remainingTracks && remainingTracks.length > 0) {
    queue = [...remainingTracks];
    if (shuffleMode) shuffleArray(queue);
    fetchingMix = false;
  } else {
    // Fetch mix in background
    fetchingMix = true;
    fetchMix(track.id, 25)
      .then(mixTracks => {
        queue = mixTracks.filter(t => t.id !== track.id).slice(0, 22);
        if (shuffleMode) shuffleArray(queue);
      })
      .catch(() => {})
      .finally(() => { fetchingMix = false; });
  }

  renderPlayer(player.state, currentTrack!, queue, fetchingMix, isFavorite(favorites, currentTrack.id), shuffleMode, volume, isDownloaded(downloads, currentTrack.id), downloadingTracks.has(currentTrack.id));
}

// ─── Key handlers ───────────────────────────────────────────────────────────

async function handleKey(key: string) {
  if (key === '\x03') {  // Ctrl+C
    await cleanup();
    process.exit(0);
  }

  if (key === 'g' || key === 'G') {
    if (
      appState !== 'language-picker' && 
      appState !== 'new-playlist' && 
      appState !== 'rename-playlist' &&
      !(appState === 'search-input' && searchMode === 'typing')
    ) {
      preLanguageState = appState;
      appState = 'language-picker';
      langPickerIdx = LANGS.indexOf(getLang() as any);
      if (langPickerIdx === -1) langPickerIdx = 0;
      if (renderTimer) { clearInterval(renderTimer); renderTimer = null; }
      renderLanguagePicker(LANGS, langPickerIdx);
      return;
    }
  }

  if (key === 'h' || key === 'H') {
    const isTextInput =
      appState === 'new-playlist' ||
      appState === 'rename-playlist' ||
      (appState === 'search-input' && searchMode === 'typing');

    if (appState !== 'help' && !isTextInput) {
      preHelpState = appState;
      appState = 'help';
      if (renderTimer) { clearInterval(renderTimer); renderTimer = null; }
      import('./ui').then(ui => ui.renderHelp());
      return;
    }
  }

  if (appState === 'search-input') await onSearchInput(key);
  else if (appState === 'search-results') await onResultsKey(key);
  else if (appState === 'playing') await onPlayingKey(key);
  else if (appState === 'favorites') await onFavoritesKey(key);
  else if (appState === 'downloads') await onDownloadsKey(key);
  else if (appState === 'playlist-list') await onPlaylistListKey(key);
  else if (appState === 'playlist-detail') await onPlaylistDetailKey(key);
  else if (appState === 'playlist-picker') await onPlaylistPickerKey(key);
  else if (appState === 'new-playlist') onNewPlaylistKey(key);
  else if (appState === 'rename-playlist') onRenamePlaylistKey(key);
  else if (appState === 'language-picker') onLanguagePickerKey(key);
  else if (appState === 'help') onHelpKey(key);
  else if (appState === 'queue-view') onQueueKey(key);
  else if (appState === 'track-info') onTrackInfoKey(key);
}

async function onSearchInput(key: string) {
  // Command mode: shortcuts active, any character key returns to typing mode
  if (searchMode === 'command') {
    if (key === '\x1B') {
      // Stay in command mode on Escape
      return;
    }
    // Handle L (favorites) shortcut
    if ((key === 'l' || key === 'L') && !searchQuery) {
      preListViewState = 'search-input';
      appState = 'favorites';
      favSelectedIdx = 0;
      renderFavorites(favorites, favSelectedIdx, new Set(downloads.map(t => t.id)), downloadingTracks);
      return;
    }
    // Handle O (playlist) shortcut
    if ((key === 'o' || key === 'O') && !searchQuery) {
      preListViewState = 'search-input';
      appState = 'playlist-list';
      plSelectedIdx = 0;
      renderPlaylistList(playlists, plSelectedIdx, downloads.length, favorites.length);
      return;
    }
    if ((key === 'd' || key === 'D') && !searchQuery) {
      preListViewState = 'search-input';
      appState = 'downloads';
      dlSelectedIdx = 0;
      renderDownloads(downloads, dlSelectedIdx, new Set(favorites.map(t => t.id)));
      return;
    }
    // Any character key switches back to typing mode
    if (key.length === 1 && key >= ' ') {
      searchMode = 'typing';
      searchQuery += key;
      renderSearch(searchQuery, '', searchMode);
      return;
    }
    return;
  }

  // Typing mode: Escape switches to command mode
  if (key === '\x1B') {
    searchMode = 'command';
    searchQuery = '';
    renderSearch(searchQuery, '', searchMode);
    return;
  }
  if (key === '\r' || key === '\n') {
    if (!searchQuery.trim()) return;
    renderSearch(t('searching'), `"${searchQuery}"`, searchMode);
    try {
      results = await search(searchQuery);
      if (results.length === 0) {
        renderSearch('', t('noResults'), searchMode);
        return;
      }
      appState = 'search-results';
      selectedIdx = 0;
      renderResults(results, selectedIdx, new Set(favorites.map(t => t.id)), new Set(downloads.map(t => t.id)), downloadingTracks);
    } catch {
      renderSearch('', t('ytdlpError'), searchMode);
    }
  } else if (key === '\x7F' || key === '\b') {
    searchQuery = searchQuery.slice(0, -1);
    renderSearch(searchQuery, '', searchMode);
  } else if (key.length === 1 && key >= ' ') {
    searchQuery += key;
    renderSearch(searchQuery, '', searchMode);
  }
}

async function onResultsKey(key: string) {
  if (key === UP) {
    selectedIdx = Math.max(0, selectedIdx - 1);
    renderResults(results, selectedIdx, new Set(favorites.map(t => t.id)), new Set(downloads.map(t => t.id)), downloadingTracks);
  } else if (key === DOWN) {
    selectedIdx = Math.min(results.length - 1, selectedIdx + 1);
    renderResults(results, selectedIdx, new Set(favorites.map(t => t.id)), new Set(downloads.map(t => t.id)), downloadingTracks);
  } else if (key === '\r' || key === '\n') {
    await startPlaying(results[selectedIdx]!);
  } else if (key === 'f' || key === 'F') {
    if (results.length > 0) {
      const tr = results[selectedIdx]!;
      const result = toggleFavorite(favorites, tr);
      favorites = result.favorites;
      renderResults(results, selectedIdx, new Set(favorites.map(t => t.id)), new Set(downloads.map(t => t.id)), downloadingTracks);
    }
  } else if (key === 'w' || key === 'W') {
    if (results.length > 0) {
      const tr = results[selectedIdx]!;
      toggleDownloadTrack(tr);
    }
  } else if (key === 'q' || key === 'Q' || key === '\x1B') {
    goToSearch();
  } else if (key === 'l' || key === 'L') {
    preListViewState = 'search-results';
    appState = 'favorites';
    favSelectedIdx = 0;
    renderFavorites(favorites, favSelectedIdx, new Set(downloads.map(t => t.id)), downloadingTracks);
  } else if (key === 'o' || key === 'O') {
    preListViewState = 'search-results';
    appState = 'playlist-list';
    plSelectedIdx = 0;
    renderPlaylistList(playlists, plSelectedIdx, downloads.length, favorites.length);
  } else if (key === 'd' || key === 'D') {
    preListViewState = 'search-results';
    appState = 'downloads';
    dlSelectedIdx = 0;
    renderDownloads(downloads, dlSelectedIdx, new Set(favorites.map(t => t.id)));
  }
}

async function onPlayingKey(key: string) {
  switch (key) {
    case ' ':
      await player.togglePause();
      break;
    case 'n':
    case 'N':
      if (queue.length > 0) {
        if (currentTrack) history.push(currentTrack);
        const next = queue.shift()!;
        currentTrack = next;
        await player.loadTrack(next.url);
        if (queue.length < 5) refillQueue(next.id);
      }
      break;
    case 'p':
    case 'P':
      if (history.length > 0) {
        if (currentTrack) queue.unshift(currentTrack);
        const prev = history.pop()!;
        currentTrack = prev;
        await player.loadTrack(prev.url);
      }
      break;
    case LEFT:
      await player.seek(-10);
      break;
    case RIGHT:
      await player.seek(10);
      break;
    case 'f':
    case 'F':
      if (currentTrack) {
        const result = toggleFavorite(favorites, currentTrack);
        favorites = result.favorites;
        renderPlayer(player.state, currentTrack!, queue, fetchingMix, isFavorite(favorites, currentTrack.id), shuffleMode, volume, isDownloaded(downloads, currentTrack.id), downloadingTracks.has(currentTrack.id));
      }
      break;
    case 'l':
    case 'L':
      if (favorites.length > 0) {
        preListViewState = appState;
        appState = 'favorites';
        favSelectedIdx = 0;
        if (renderTimer) { clearInterval(renderTimer); renderTimer = null; }
        renderFavorites(favorites, favSelectedIdx, new Set(downloads.map(t => t.id)), downloadingTracks);
      }
      break;
    case 'a':
    case 'A':
      if (currentTrack) {
        prePlaylistState = 'playing';
        appState = 'playlist-picker';
        plPickerIdx = 0;
        if (renderTimer) { clearInterval(renderTimer); renderTimer = null; }
        renderPlaylistPicker(playlists, plPickerIdx, currentTrack.title);
      }
      break;
    case 'i':
    case 'I':
      if (currentTrack) {
        preTrackInfoState = appState;
        appState = 'track-info';
        if (renderTimer) { clearInterval(renderTimer); renderTimer = null; }
        import('./ui').then(ui => ui.renderTrackInfo(currentTrack!));
      }
      break;
    case 'o':
    case 'O':
      preListViewState = appState;
      appState = 'playlist-list';
      plSelectedIdx = 0;
      if (renderTimer) { clearInterval(renderTimer); renderTimer = null; }
      renderPlaylistList(playlists, plSelectedIdx, downloads.length, favorites.length);
      break;
    case 'x':
    case 'X':
      shuffleMode = !shuffleMode;
      if (shuffleMode && queue.length > 0) shuffleArray(queue);
      renderPlayer(player.state, currentTrack!, queue, fetchingMix, isFavorite(favorites, currentTrack!.id), shuffleMode, volume, isDownloaded(downloads, currentTrack!.id), downloadingTracks.has(currentTrack!.id));
      break;
    case 'd':
    case 'D':
      preListViewState = appState;
      appState = 'downloads';
      dlSelectedIdx = 0;
      if (renderTimer) { clearInterval(renderTimer); renderTimer = null; }
      renderDownloads(downloads, dlSelectedIdx, new Set(favorites.map(t => t.id)));
      break;
    case 's':
    case 'S':
      goToSearch();
      break;
    case '+':
    case '=':
      volume = Math.min(100, volume + VOLUME_STEP);
      await player.setVolume(volume);
      renderPlayer(player.state, currentTrack!, queue, fetchingMix, isFavorite(favorites, currentTrack!.id), shuffleMode, volume, isDownloaded(downloads, currentTrack!.id), downloadingTracks.has(currentTrack!.id));
      break;
    case '-':
    case '_':
      volume = Math.max(0, volume - VOLUME_STEP);
      await player.setVolume(volume);
      renderPlayer(player.state, currentTrack!, queue, fetchingMix, isFavorite(favorites, currentTrack!.id), shuffleMode, volume, isDownloaded(downloads, currentTrack!.id), downloadingTracks.has(currentTrack!.id));
      break;
    case 'w':
    case 'W':
      if (currentTrack) {
        toggleDownloadTrack(currentTrack);
      }
      break;
    case 'r':
    case 'R':
      {
        const modes: ('off' | 'one' | 'all')[] = ['off', 'one', 'all'];
        const cur = modes.indexOf(player.state.repeatMode);
        const next = modes[(cur + 1) % modes.length]!;
        await player.setRepeatMode(next);
        renderPlayer(player.state, currentTrack!, queue, fetchingMix, isFavorite(favorites, currentTrack!.id), shuffleMode, volume, isDownloaded(downloads, currentTrack!.id), downloadingTracks.has(currentTrack!.id));
      }
      break;
    case 'u':
    case 'U':
      preQueueState = appState;
      appState = 'queue-view';
      if (renderTimer) { clearInterval(renderTimer); renderTimer = null; }
      import('./ui').then(ui => ui.renderQueue(queue, currentTrack || undefined));
      break;
    case 'q':
    case 'Q':
    case '\x1B': // Added ESC handling
      await cleanup();
      process.exit(0);
      break;
  }
}

function onHelpKey(key: string) {
  if (key === 'q' || key === 'Q' || key === '\x1B' || key === 'h' || key === 'H') {
    appState = preHelpState;
    if (appState === 'playing') {
      startRenderTimer();
    }
    renderCurrentScreen();
  }
}

function onQueueKey(key: string) {
  if (key === 'q' || key === 'Q' || key === '\x1B' || key === 'u' || key === 'U') {
    appState = preQueueState;
    if (appState === 'playing') {
      startRenderTimer();
    }
    renderCurrentScreen();
  }
}

function onTrackInfoKey(key: string) {
  if (key === 'q' || key === 'Q' || key === '\x1B' || key === 'i' || key === 'I') {
    appState = preTrackInfoState;
    if (appState === 'playing') {
      startRenderTimer();
    }
    renderCurrentScreen();
  }
}

function startRenderTimer() {
  if (renderTimer) clearInterval(renderTimer);
  renderTimer = setInterval(() => {
    if (appState === 'playing' && currentTrack) {
      renderPlayer(player.state, currentTrack!, queue, fetchingMix, isFavorite(favorites, currentTrack.id), shuffleMode, volume, isDownloaded(downloads, currentTrack.id), downloadingTracks.has(currentTrack.id));
    }
  }, 1000);
}


function toggleDownloadTrack(dlTrack: Track) {
  if (isDownloaded(downloads, dlTrack.id)) {
    downloads = deleteDownloadRecord(downloads, dlTrack.id);
    try {
      import('fs').then(fs => fs.unlinkSync(join(MUSIC_DIR, `${dlTrack.id}.mp3`)));
    } catch {}
    renderCurrentScreen();
  } else if (!downloadingTracks.has(dlTrack.id)) {
    downloadingTracks.add(dlTrack.id);
    renderCurrentScreen();
    
    const ytdlp = resolveCommand('yt-dlp') ?? 'yt-dlp';
    const proc = Bun.spawn([ytdlp, ...getYtdlpPrivacyArgs(), '-x', '--audio-format', 'mp3', '-o', join(MUSIC_DIR, `${dlTrack.id}.mp3`), dlTrack.url], {
      stdout: 'ignore',
      stderr: 'ignore',
      onExit(p, exitCode) {
        downloadProcs.delete(proc);
        downloadingTracks.delete(dlTrack.id);
        if (exitCode === 0) {
          downloads = addDownloadRecord(downloads, dlTrack);
        }
        renderCurrentScreen();
      }
    });
    downloadProcs.add(proc);
  }
}

async function onFavoritesKey(key: string) {
  if (key === UP) {
    favSelectedIdx = Math.max(0, favSelectedIdx - 1);
    renderFavorites(favorites, favSelectedIdx, new Set(downloads.map(t => t.id)), downloadingTracks);
  } else if (key === DOWN) {
    favSelectedIdx = Math.min(favorites.length - 1, favSelectedIdx + 1);
    renderFavorites(favorites, favSelectedIdx, new Set(downloads.map(t => t.id)), downloadingTracks);
  } else if (key === '\r' || key === '\n') {
    await startPlaying(favorites[favSelectedIdx]!);
  } else if (key === 'f' || key === 'F') {
    if (favorites.length > 0) {
      const tr = favorites[favSelectedIdx]!;
      const result = toggleFavorite(favorites, tr);
      favorites = result.favorites;
      if (favorites.length === 0) {
        appState = 'search-input';
        goToSearch();
      } else {
        favSelectedIdx = Math.min(favSelectedIdx, favorites.length - 1);
        renderFavorites(favorites, favSelectedIdx, new Set(downloads.map(t => t.id)), downloadingTracks);
      }
    }
  } else if (key === 'w' || key === 'W') {
    if (favorites.length > 0) {
      toggleDownloadTrack(favorites[favSelectedIdx]!);
    }
  } else if (key === 'q' || key === 'Q' || key === '\x1B') { // Added ESC handling
    returnToPlayer();
  }
}

// ─── Playlist handlers ──────────────────────────────────────────────────────

function returnToPlayer() {
  if (preListViewState === 'search-input') {
    goToSearch();
    return;
  }
  
  if (currentTrack) {
    appState = 'playing';
    renderTimer = setInterval(() => {
      if (appState === 'playing') renderPlayer(player.state, currentTrack!, queue, fetchingMix, isFavorite(favorites, currentTrack!.id), shuffleMode, volume, isDownloaded(downloads, currentTrack!.id), downloadingTracks.has(currentTrack!.id));
    }, 1000);
    renderPlayer(player.state, currentTrack!, queue, fetchingMix, isFavorite(favorites, currentTrack.id), shuffleMode, volume, isDownloaded(downloads, currentTrack.id), downloadingTracks.has(currentTrack.id));
  } else {
    goToSearch();
  }
}

async function onDownloadsKey(key: string) {
  if (key === UP) {
    dlSelectedIdx = Math.max(0, dlSelectedIdx - 1);
    renderDownloads(downloads, dlSelectedIdx, new Set(favorites.map(t => t.id)));
  } else if (key === DOWN) {
    dlSelectedIdx = Math.min(downloads.length - 1, dlSelectedIdx + 1);
    renderDownloads(downloads, dlSelectedIdx, new Set(favorites.map(t => t.id)));
  } else if (key === '\r' || key === '\n') {
    await startPlaying(downloads[dlSelectedIdx]!);
  } else if (key === 'f' || key === 'F') {
    if (downloads.length > 0) {
      const tr = downloads[dlSelectedIdx]!;
      const result = toggleFavorite(favorites, tr);
      favorites = result.favorites;
      renderDownloads(downloads, dlSelectedIdx, new Set(favorites.map(t => t.id)));
    }
  } else if (key === 'd' || key === 'D' || key === 'w' || key === 'W') {
    if (downloads.length > 0) {
      const tr = downloads[dlSelectedIdx]!;
      downloads = deleteDownloadRecord(downloads, tr.id);
      try {
        import('fs').then(fs => fs.unlinkSync(join(MUSIC_DIR, `${tr.id}.mp3`)));
      } catch {}
      if (downloads.length === 0) {
        appState = 'search-input';
        goToSearch();
      } else {
        dlSelectedIdx = Math.min(dlSelectedIdx, downloads.length - 1);
        renderDownloads(downloads, dlSelectedIdx, new Set(favorites.map(t => t.id)));
      }
    }
  } else if (key === 'q' || key === 'Q' || key === '\x1B') { // Added ESC handling
    returnToPlayer();
  }
}

async function onPlaylistListKey(key: string) {
  if (key === UP) {
    plSelectedIdx = Math.max(0, plSelectedIdx - 1);
    renderPlaylistList(playlists, plSelectedIdx, downloads.length, favorites.length);
  } else if (key === DOWN) {
    plSelectedIdx = Math.min(playlists.length + 1, plSelectedIdx + 1);
    renderPlaylistList(playlists, plSelectedIdx, downloads.length, favorites.length);
  } else if (key === '\r' || key === '\n') {
    if (plSelectedIdx === 0) {
      appState = 'downloads';
      dlSelectedIdx = 0;
      renderDownloads(downloads, dlSelectedIdx, new Set(favorites.map(t => t.id)));
    } else if (plSelectedIdx === 1) {
      if (favorites.length > 0) {
        appState = 'favorites';
        favSelectedIdx = 0;
        renderFavorites(favorites, favSelectedIdx, new Set(downloads.map(t => t.id)), downloadingTracks);
      }
    } else if (playlists.length > 0) {
      currentPlaylist = playlists[plSelectedIdx - 2]!;
      appState = 'playlist-detail';
      plDetailIdx = 0;
      renderPlaylistDetail(currentPlaylist, plDetailIdx, new Set(favorites.map(t => t.id)), new Set(downloads.map(t => t.id)), downloadingTracks);
    }
  } else if (key === 'c' || key === 'C') {
    prePlaylistState = 'playlist-list';
    appState = 'new-playlist';
    newPlaylistName = '';
    renderNewPlaylistInput(newPlaylistName);
  } else if (key === 'r' || key === 'R') {
    if (plSelectedIdx > 1 && playlists.length > 0) {
      const pl = playlists[plSelectedIdx - 2]!;
      renamingPlaylistId = pl.id;
      renamePlaylistName = pl.name;
      appState = 'rename-playlist';
      renderRenamePlaylistInput(renamePlaylistName);
    }
  } else if (key === 'd' || key === 'D') {
    if (plSelectedIdx > 1 && playlists.length > 0) {
      playlists = deletePlaylist(playlists, playlists[plSelectedIdx - 2]!.id);
      plSelectedIdx = Math.min(plSelectedIdx, playlists.length + 1);
      renderPlaylistList(playlists, plSelectedIdx, downloads.length, favorites.length);
    }
  } else if (key === 'w' || key === 'W') {
    if (plSelectedIdx === 1) {
      for (const track of favorites) {
        if (!isDownloaded(downloads, track.id) && !downloadingTracks.has(track.id)) {
          toggleDownloadTrack(track);
        }
      }
    } else if (plSelectedIdx > 1 && playlists.length > 0) {
      const pl = playlists[plSelectedIdx - 2]!;
      for (const track of pl.tracks) {
        if (!isDownloaded(downloads, track.id) && !downloadingTracks.has(track.id)) {
          toggleDownloadTrack(track);
        }
      }
    }
  } else if (key === 'q' || key === 'Q' || key === '\x1B') { // Added ESC handling
    returnToPlayer();
  }
}

async function onPlaylistDetailKey(key: string) {
  if (!currentPlaylist) return;

  if (key === UP) {
    plDetailIdx = Math.max(0, plDetailIdx - 1);
    renderPlaylistDetail(currentPlaylist, plDetailIdx, new Set(favorites.map(t => t.id)), new Set(downloads.map(t => t.id)), downloadingTracks);
  } else if (key === DOWN) {
    plDetailIdx = Math.min(currentPlaylist.tracks.length - 1, plDetailIdx + 1);
    renderPlaylistDetail(currentPlaylist, plDetailIdx, new Set(favorites.map(t => t.id)), new Set(downloads.map(t => t.id)), downloadingTracks);
  } else if ((key === '\r' || key === '\n') && currentPlaylist.tracks.length > 0) {
    const after = currentPlaylist.tracks.slice(plDetailIdx + 1);
    const before = currentPlaylist.tracks.slice(0, plDetailIdx);
    await startPlaying(currentPlaylist.tracks[plDetailIdx]!, [...after, ...before]);
  } else if ((key === 'd' || key === 'D') && currentPlaylist.tracks.length > 0) {
    removeTrackFromPlaylist(playlists, currentPlaylist.id, plDetailIdx);
    plDetailIdx = Math.min(plDetailIdx, currentPlaylist.tracks.length - 1);
    renderPlaylistDetail(currentPlaylist, plDetailIdx, new Set(favorites.map(t => t.id)), new Set(downloads.map(t => t.id)), downloadingTracks);
  } else if (key === 'f' || key === 'F') {
    if (currentPlaylist.tracks.length > 0) {
      const tr = currentPlaylist.tracks[plDetailIdx]!;
      const result = toggleFavorite(favorites, tr);
      favorites = result.favorites;
      renderPlaylistDetail(currentPlaylist, plDetailIdx, new Set(favorites.map(t => t.id)), new Set(downloads.map(t => t.id)), downloadingTracks);
    }
  } else if (key === 'w' || key === 'W') {
    if (currentPlaylist.tracks.length > 0) {
      toggleDownloadTrack(currentPlaylist.tracks[plDetailIdx]!);
    }
  } else if (key === 'q' || key === 'Q' || key === '\x1B') {
    appState = 'playlist-list';
    renderPlaylistList(playlists, plSelectedIdx, downloads.length, favorites.length);
  }
}

async function onPlaylistPickerKey(key: string) {
  if (key === UP) {
    plPickerIdx = Math.max(0, plPickerIdx - 1);
    renderPlaylistPicker(playlists, plPickerIdx, currentTrack?.title || '');
  } else if (key === DOWN) {
    plPickerIdx = Math.min(playlists.length - 1, plPickerIdx + 1);
    renderPlaylistPicker(playlists, plPickerIdx, currentTrack?.title || '');
  } else if ((key === '\r' || key === '\n') && playlists.length > 0 && currentTrack) {
    addTrackToPlaylist(playlists, playlists[plPickerIdx]!.id, currentTrack);
    returnToPlayer();
  } else if (key === 'c' || key === 'C') {
    prePlaylistState = 'playlist-picker';
    appState = 'new-playlist';
    newPlaylistName = '';
    renderNewPlaylistInput(newPlaylistName);
  } else if (key === 'q' || key === 'Q' || key === '\x1B') { // Added ESC handling
    returnToPlayer();
  }
}

function onNewPlaylistKey(key: string) {
  if (key === '\x1B') {
    // Esc - go back
    if (prePlaylistState === 'playlist-picker') {
      appState = 'playlist-picker';
      renderPlaylistPicker(playlists, plPickerIdx, currentTrack?.title || '');
    } else {
      appState = 'playlist-list';
      renderPlaylistList(playlists, plSelectedIdx, downloads.length, favorites.length);
    }
  } else if (key === '\r' || key === '\n') {
    if (!newPlaylistName.trim()) return;
    createPlaylist(playlists, newPlaylistName.trim());
    if (prePlaylistState === 'playlist-picker') {
      plPickerIdx = playlists.length - 1;
      appState = 'playlist-picker';
      renderPlaylistPicker(playlists, plPickerIdx, currentTrack?.title || '');
    } else {
      plSelectedIdx = playlists.length - 1;
      appState = 'playlist-list';
      renderPlaylistList(playlists, plSelectedIdx, downloads.length, favorites.length);
    }
  } else if (key === '\x7F' || key === '\b') {
    newPlaylistName = newPlaylistName.slice(0, -1);
    renderNewPlaylistInput(newPlaylistName);
  } else if (key.length === 1 && key >= ' ') {
    newPlaylistName += key;
    renderNewPlaylistInput(newPlaylistName);
  }
}

function onRenamePlaylistKey(key: string) {
  if (key === '\x1B') {
    appState = 'playlist-list';
    renderPlaylistList(playlists, plSelectedIdx, downloads.length, favorites.length);
  } else if (key === '\r' || key === '\n') {
    if (!renamePlaylistName.trim()) return;
    renamePlaylist(playlists, renamingPlaylistId, renamePlaylistName.trim());
    appState = 'playlist-list';
    renderPlaylistList(playlists, plSelectedIdx, downloads.length, favorites.length);
  } else if (key === '\x7F' || key === '\b') {
    renamePlaylistName = renamePlaylistName.slice(0, -1);
    renderRenamePlaylistInput(renamePlaylistName);
  } else if (key.length === 1 && key >= ' ') {
    renamePlaylistName += key;
    renderRenamePlaylistInput(renamePlaylistName);
  }
}

function onLanguagePickerKey(key: string) {
  if (key === UP) {
    langPickerIdx = Math.max(0, langPickerIdx - 1);
    renderLanguagePicker(LANGS, langPickerIdx);
  } else if (key === DOWN) {
    langPickerIdx = Math.min(LANGS.length - 1, langPickerIdx + 1);
    renderLanguagePicker(LANGS, langPickerIdx);
  } else if (key === '\r' || key === '\n') {
    const next = LANGS[langPickerIdx]!;
    setLang(next as any);
    saveSettings({ lang: next as any });
    
    appState = preLanguageState;
    if (appState === 'playing' && currentTrack) {
        if (renderTimer) clearInterval(renderTimer);
        renderTimer = setInterval(() => {
            if (appState === 'playing' && currentTrack) renderPlayer(player.state, currentTrack!, queue, fetchingMix, isFavorite(favorites, currentTrack.id), shuffleMode, volume, isDownloaded(downloads, currentTrack.id), downloadingTracks.has(currentTrack.id));
        }, 1000);
    }
    renderCurrentScreen();
  } else if (key === '\x1B' || key === 'q' || key === 'Q') {
    appState = preLanguageState;
    if (appState === 'playing' && currentTrack) {
        if (renderTimer) clearInterval(renderTimer);
        renderTimer = setInterval(() => {
            if (appState === 'playing' && currentTrack) renderPlayer(player.state, currentTrack!, queue, fetchingMix, isFavorite(favorites, currentTrack.id), shuffleMode, volume, isDownloaded(downloads, currentTrack.id), downloadingTracks.has(currentTrack.id));
        }, 1000);
    }
    renderCurrentScreen();
  }
}

// ─── Cleanup & init ─────────────────────────────────────────────────────────

let isCleaningUp = false;
async function cleanup() {
  if (isCleaningUp) return;
  isCleaningUp = true;
  if (renderTimer) clearInterval(renderTimer);
  process.stdin.setRawMode(false);
  clearScreen();
  await player.quit();
  for (const proc of downloadProcs) {
    try { proc.kill(); } catch {}
  }
  process.stdout.write(chalk_reset());
}

// Simple reset without importing chalk just for this
function chalk_reset() { return '\x1B[0m\n'; }

async function main() {
  await ensureRuntimeDependencies();

  const settings = loadSettings();
  setLang(settings.lang);

  await player.start();
  favorites = loadFavorites();
  playlists = loadPlaylists();
  downloads = loadDownloads();

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', handleKey);

  const handleExit = async () => {
    await cleanup();
    process.exit(0);
  };
  
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
  process.on('SIGHUP', handleExit); // Terminal closed
  process.on('SIGUSR2', handleExit); // For nodemon/bun --watch reloads

  // Catch unexpected crashes to cleanup terminal
  process.on('uncaughtException', async (err) => {
    await cleanup();
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });

  await goToSearch();
}

main().catch(async (e) => {
  await cleanup();
  console.error(e);
  process.exit(1);
});
