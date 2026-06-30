import chalk from 'chalk';
import { t, getLang, langNames } from './i18n';
import type { PlayerState } from './player';
import type { Track, Playlist } from './types';

function fmt(sec: number): string {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function bar(pos: number, total: number, width = 40): string {
  if (!total || isNaN(pos)) return chalk.dim('─'.repeat(width));
  const pct = Math.min(pos / total, 1);
  const filled = Math.floor(pct * width);
  const empty = Math.max(0, width - filled - 1);
  if (filled === width) return chalk.blueBright('━'.repeat(width));
  return chalk.blueBright('━'.repeat(filled)) + chalk.white('●') + chalk.dim('─'.repeat(empty));
}

function clip(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function actionText(label: string): string {
  const parts = label.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : label;
}

export function clearScreen() {
  process.stdout.write('\x1B[H\x1B[J');
}

export function renderSearch(query: string, hint = '', searchMode: 'typing' | 'command' = 'typing') {
  const lines: string[] = [];
  lines.push('');
  
  const pathPart = chalk.blueBright('~/Music/');
  const appPart = chalk.white.bold(t('appName'));
  const langPart = chalk.dim(` [${langNames[getLang()]}]`);
  lines.push(`  ${pathPart}${appPart}${langPart}`);
  lines.push('');
  
  if (hint) {
    lines.push(chalk.dim(`  // ${hint.replace(/Search:/, '').trim()}`));
    lines.push('');
  } else {
    lines.push(chalk.dim(`  // ${t('hintSearch')}`));
    lines.push('');
  }
  
  const rawMode = searchMode === 'command' ? t('inCommandMode') : t('inTypingMode');
  const cleanMode = rawMode.replace(/[ \[\]]/g, '');
  const badgeColor = searchMode === 'command' ? chalk.bgYellow.black : chalk.bgBlueBright.black;
  const arrowColor = searchMode === 'command' ? chalk.yellow : chalk.blueBright;
  
  const badge = badgeColor(` ${cleanMode} `);
  const promptArrow = arrowColor('❯');
  const cursor = searchMode === 'command' ? chalk.yellow('█') : chalk.blueBright('█');

  lines.push(`  ${badge} ${promptArrow} ${chalk.blueBright(t('searchLabel'))} ${chalk.white.bold(query)}${cursor}`);

  if (!query) {
    lines.push('');
    if (searchMode === 'command') {
      const items: string[] = [
        t('favoritesKey'),
        t('playlistsKey'),
        t('downloadsKey'),
        t('languageKey')
      ];
      lines.push(chalk.dim(`  ${items.join('    ')}`));
    } else {
      lines.push(chalk.dim(`  ${t('escapeHint')}`));
    }
  }
  lines.push('');
  process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
}

export function renderResults(tracks: Track[], selected: number, favoriteIds: Set<string>, downloadIds: Set<string>, downloadingIds: Set<string>) {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.blueBright.bold(`  ${t('appName')}`) + chalk.dim(` (${langNames[getLang()]})`) + chalk.dim(`  ─  ${t('searchTitle')}`));
  lines.push('');

  const frame = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][Math.floor(Date.now() / 150) % 10];

  for (let i = 0; i < tracks.length; i++) {
    const tck = tracks[i]!;
    const title = clip(tck.title, 48);
    const dur = tck.duration ? chalk.dim(` [${fmt(tck.duration)}]`) : '';
    const uploader = tck.uploader ? chalk.dim.italic(`  ${clip(tck.uploader, 22)}`) : '';

    const isFav = favoriteIds.has(tck.id);
    const isDl = downloadIds.has(tck.id);
    const isDling = downloadingIds.has(tck.id);

    const fIcon = isFav ? chalk.redBright('♥ ') : '  ';
    const dIcon = isDling ? chalk.yellow(`${frame} `) : (isDl ? chalk.greenBright('↓ ') : '  ');
    const prefix = `${fIcon}${dIcon}`;

    if (i === selected) {
      lines.push(chalk.bgBlue.white.bold(`  ▶ ${isFav ? '♥ ' : '  '}${isDling ? frame + ' ' : (isDl ? '↓ ' : '  ')}${(i + 1).toString().padStart(2)}. ${title.padEnd(42)}`) + dur);
    } else {
      lines.push(`  ${prefix}` + chalk.dim(`${(i + 1).toString().padStart(2)}. `) + chalk.white(title) + dur + uploader);
    }
  }

  lines.push('');
  const actionKey = tracks[selected] && downloadIds.has(tracks[selected]!.id) ? t('removeDownloadKey') : t('downloadKey');
  lines.push(chalk.dim(`  ${t('navigateKey')}    ${t('playKey')}    ${t('favorite')}    ${actionKey}    ${t('backKey')}`));
  lines.push('');
  process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
}

const CLR = '\x1B[K'; // clear to end of line

export function renderPlayer(state: PlayerState, currentTrack: Track, queue: Track[], fetchingMix: boolean, favorite = false, shuffle = false, volume = 100, downloaded = false, downloading = false) {
  const favIcon = favorite ? chalk.redBright(' ♥') : '';
  const frame = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][Math.floor(Date.now() / 150) % 10];
  const dlIcon = downloading ? chalk.yellow(` ↓ ${frame}`) : (downloaded ? chalk.greenBright(' ↓ ✓') : '');
  const title = clip(currentTrack.title || t('loadingMix'), 54) + favIcon + dlIcon;
  const shuffleIcon = shuffle ? chalk.blueBright(`  ${t('shuffle')}`) : '';
  const repeatIcons = { off: '', one: ' 🔂', all: ' 🔁' };
  const repeatIcon = chalk.blueBright(repeatIcons[state.repeatMode] || '');
  
  const volBarsCount = Math.round(volume / 10);
  const volBars = chalk.blueBright('█'.repeat(volBarsCount)) + chalk.dim('░'.repeat(10 - volBarsCount));
  const volumeInfo = `  ${chalk.dim(t('volume'))} ${chalk.white(volume.toString().padStart(3, ' ')+'%')} ${volBars}`;
  
  const status = (state.paused ? chalk.yellow(t('paused')) : chalk.greenBright(t('playing'))) + shuffleIcon + repeatIcon + volumeInfo;
  const progress = bar(state.timePos, state.duration);
  const time = `${fmt(state.timePos)} / ${fmt(state.duration)}`;

  const lines = [
    '',
    chalk.blueBright.bold(`  ${t('appName')}`) + chalk.dim(` (${langNames[getLang()]})`),
    '',
    `  ${status}`,
    '',
    `  ${chalk.white.bold(title)}`,
    '',
    `  ${progress}  ${chalk.dim(time)}`,
    '',
  ];

  if (fetchingMix && queue.length === 0) {
    lines.push(chalk.dim(`  ${t('loadingMix')}`), '');
  } else if (queue.length > 0) {
    lines.push(chalk.dim(`  ${t('queueInfo')}`));
    for (let i = 0; i < Math.min(queue.length, 4); i++) {
      lines.push(chalk.dim(`    ${i + 1}. ${clip(queue[i]!.title, 52)}`));
    }
    if (queue.length > 4) {
      lines.push(chalk.dim(`    ${t('moreTracks', { count: queue.length - 4 })}`));
    }
    lines.push('');
  }

  lines.push(chalk.dim(`  ${t('pauseResume')}    ${t('prevTrack')}    ${t('nextTrack')}    ${t('seek')}    ${t('favorite')}    ${t('openList')}    +/- ${t('volume')}`), '');
  const actionKey = downloaded ? t('removeDownloadKey') : t('downloadKey');
  lines.push(chalk.dim(`  ${t('addToPlaylist')}    ${t('openPlaylists')}    ${t('shuffleToggle')}    ${t('repeatKey')}    ${t('search')}    ${actionKey}`));
  lines.push(chalk.dim(`  ${t('helpKey')}    ${t('quit')}    ${t('languageKey')}`), '');

  // Cursor home, overwrite each line with clear-to-end, then clear remaining below
  process.stdout.write('\x1B[H' + lines.map(l => l + CLR).join('\n') + '\x1B[J');
}

export function renderDownloads(downloads: Track[], selected: number, favoriteIds: Set<string>) {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.blueBright.bold(`  ${t('appName')}`) + chalk.dim(` (${langNames[getLang()]})`) + chalk.dim(`  ─  ${t('downloadsTitle')}`));
  lines.push('');

  if (downloads.length === 0) {
    lines.push(chalk.dim(`  ${t('noDownloads')}`));
    lines.push('');
    lines.push(chalk.dim(`  ${t('backKey')}`));
    lines.push('');
    process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
    return;
  }

  for (let i = 0; i < downloads.length; i++) {
    const track = downloads[i]!;
    const title = clip(track.title, 48);
    const dur = track.duration ? chalk.dim(` [${fmt(track.duration)}]`) : '';
    const uploader = track.uploader ? chalk.dim.italic(`  ${clip(track.uploader, 22)}`) : '';

    const isFav = favoriteIds.has(track.id);
    const icon = isFav ? chalk.redBright('♥ ') : chalk.greenBright('↓ ');
    const selIcon = isFav ? '♥ ' : '↓ ';

    if (i === selected) {
      lines.push(chalk.bgBlue.white.bold(`  ▶ ${selIcon}${(i + 1).toString().padStart(2)}. ${title.padEnd(46)}`) + dur);
    } else {
      lines.push(`  ${icon}` + chalk.dim(`${(i + 1).toString().padStart(2)}. `) + chalk.white(title) + dur + uploader);
    }
  }

  lines.push('');
  lines.push(chalk.dim(`  ${t('navigateKey')}    ${t('playKey')}    ${t('favorite')}    ${t('removeDownloadKey')}    ${t('backKey')}`));
  lines.push('');
  process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
}

export function renderFavorites(favorites: Track[], selected: number, downloadIds: Set<string>, downloadingIds: Set<string>) {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.blueBright.bold(`  ${t('appName')}`) + chalk.dim(` (${langNames[getLang()]})`) + chalk.dim(`  ─  ${t('favoritesTitle')}`));
  lines.push('');

  if (favorites.length === 0) {
    lines.push(chalk.dim(`  ${t('noFavorites')}`));
    lines.push('');
    lines.push(chalk.dim(`  ${t('backKey')}`));
    lines.push('');
    process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
    return;
  }

  const frame = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][Math.floor(Date.now() / 150) % 10];

  for (let i = 0; i < favorites.length; i++) {
    const track = favorites[i]!;
    const title = clip(track.title, 48);
    const dur = track.duration ? chalk.dim(` [${fmt(track.duration)}]`) : '';
    const uploader = track.uploader ? chalk.dim.italic(`  ${clip(track.uploader, 22)}`) : '';

    const isDl = downloadIds.has(track.id);
    const isDling = downloadingIds.has(track.id);
    const dIcon = isDling ? chalk.yellow(`${frame} `) : (isDl ? chalk.greenBright('↓ ') : '  ');
    const rawDIcon = isDling ? `${frame} ` : (isDl ? `↓ ` : `  `);

    if (i === selected) {
      lines.push(chalk.bgBlue.white.bold(`  ▶ ♥ ${rawDIcon}${(i + 1).toString().padStart(2)}. ${title.padEnd(42)}`) + dur);
    } else {
      lines.push(chalk.redBright('  ♥ ') + dIcon + chalk.dim(`${(i + 1).toString().padStart(2)}. `) + chalk.white(title) + dur + uploader);
    }
  }

  lines.push('');
  const actionKey = favorites[selected] && downloadIds.has(favorites[selected]!.id) ? t('removeDownloadKey') : t('downloadKey');
  lines.push(chalk.dim(`  ${t('navigateKey')}    ${t('playKey')}    ${t('favorite')}    ${actionKey}    ${t('backKey')}`));
  lines.push('');
  process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
}

export function renderPlaylistList(playlists: Playlist[], selected: number, numDownloads: number, numFavorites: number) {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.blueBright.bold(`  ${t('appName')}`) + chalk.dim(` (${langNames[getLang()]})`) + chalk.dim(`  ─  ${t('playlistsTitle')}`));
  lines.push('');

  const dlName = t('downloadsTitle');
  const favName = t('favoritesTitle');
  const dlCount = chalk.dim(` (${numDownloads} ${t('noTracks')})`);
  const favCount = chalk.dim(` (${numFavorites} ${t('noTracks')})`);

  if (selected === 0) {
    lines.push(chalk.bgBlue.white.bold(`  ▶ 01. ${dlName.padEnd(46)}`) + dlCount);
  } else {
    lines.push(chalk.greenBright(`  ↓ `) + chalk.white(dlName.padEnd(48)) + dlCount);
  }

  if (selected === 1) {
    lines.push(chalk.bgBlue.white.bold(`  ▶ 02. ${favName.padEnd(46)}`) + favCount);
  } else {
    lines.push(chalk.redBright(`  ♥ `) + chalk.white(favName.padEnd(48)) + favCount);
  }

  lines.push(chalk.dim(`  ${'─'.repeat(54)}`));

  for (let i = 0; i < playlists.length; i++) {
    const p = playlists[i]!;
    const count = chalk.dim(` (${p.tracks.length} ${t('noTracks')})`);
    const name = clip(p.name, 44);
    if (i + 2 === selected) {
      lines.push(chalk.bgBlue.white.bold(`  ▶ ${(i + 3).toString().padStart(2)}. ${name.padEnd(46)}`) + count);
    } else {
      lines.push(chalk.dim(`  ${(i + 3).toString().padStart(2)}. `) + chalk.white(name) + count);
    }
  }

  lines.push('');
  lines.push(chalk.dim(`  ${t('navigateKey')}    ${t('playKey')}    ${t('createKey')}    ${t('renameKey')}    ${t('downloadKey')}    ${t('deleteKey')}    ${t('backKey')}`));
  lines.push('');
  process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
}

export function renderPlaylistDetail(playlist: Playlist, selected: number, favoriteIds: Set<string>, downloadIds: Set<string>, downloadingIds: Set<string>) {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.blueBright.bold(`  ${t('appName')}`) + chalk.dim(` (${langNames[getLang()]})`) + chalk.dim(`  ─  ${clip(playlist.name, 30)}`));
  lines.push('');

  if (playlist.tracks.length === 0) {
    lines.push(chalk.dim(`  ${t('noTracks')}`));
    lines.push('');
    lines.push(chalk.dim(`  ${t('backKey')}`));
    lines.push('');
    process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
    return;
  }

  const frame = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][Math.floor(Date.now() / 150) % 10];

  for (let i = 0; i < playlist.tracks.length; i++) {
    const tr = playlist.tracks[i]!;
    const title = clip(tr.title, 48);
    const dur = tr.duration ? chalk.dim(` [${fmt(tr.duration)}]`) : '';
    const uploader = tr.uploader ? chalk.dim.italic(`  ${clip(tr.uploader, 22)}`) : '';

    const isFav = favoriteIds.has(tr.id);
    const isDl = downloadIds.has(tr.id);
    const isDling = downloadingIds.has(tr.id);

    const fIcon = isFav ? chalk.redBright('  ♥ ') : '    ';
    const dIcon = isDling ? chalk.yellow(`${frame} `) : (isDl ? chalk.greenBright('↓ ') : '  ');
    const prefix = `${fIcon}${dIcon}`;

    const rawFIcon = isFav ? '♥ ' : '  ';
    const rawDIcon = isDling ? `${frame} ` : (isDl ? `↓ ` : `  `);

    if (i === selected) {
      lines.push(chalk.bgBlue.white.bold(`  ▶ ${rawFIcon}${rawDIcon}${(i + 1).toString().padStart(2)}. ${title.padEnd(42)}`) + dur);
    } else {
      lines.push(prefix + chalk.dim(`${(i + 1).toString().padStart(2)}. `) + chalk.white(title) + dur + uploader);
    }
  }

  lines.push('');
  const actionKey = playlist.tracks[selected] && downloadIds.has(playlist.tracks[selected]!.id) ? t('removeDownloadKey') : t('downloadKey');
  lines.push(chalk.dim(`  ${t('navigateKey')}    ${t('playKey')}    ${t('favorite')}    ${actionKey}    ${t('deleteKey')}    ${t('backKey')}`));
  lines.push('');
  process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
}

export function renderPlaylistPicker(playlists: Playlist[], selected: number, trackTitle: string) {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.blueBright.bold(`  ${t('appName')}`) + chalk.dim(` (${langNames[getLang()]})`) + chalk.dim(`  ─  ${t('playlistPickerTitle')}`));
  lines.push('');
  lines.push(chalk.white(`  ${t('trackLabel')} ${clip(trackTitle, 50)}`));
  lines.push('');

  if (playlists.length === 0) {
    lines.push(chalk.dim(`  ${t('noPlaylistForTrack')}`));
    lines.push('');
    lines.push(chalk.dim(`  ${t('createKey')}  ${t('newPlaylistTitle')}    ${t('cancelKey')}`));
    lines.push('');
    process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
    return;
  }

  for (let i = 0; i < playlists.length; i++) {
    const p = playlists[i]!;
    const count = chalk.dim(` (${p.tracks.length} ${t('noTracks')})`);
    const name = clip(p.name, 44);
    if (i === selected) {
      lines.push(chalk.bgBlue.white.bold(`  ▶ ${(i + 1).toString().padStart(2)}. ${name.padEnd(46)}`) + count);
    } else {
      lines.push(chalk.dim(`  ${(i + 1).toString().padStart(2)}. `) + chalk.white(name) + count);
    }
  }

  lines.push('');
  lines.push(chalk.dim(`  ${t('navigateKey')}    ${t('playKey')}    ${t('createKey')}    ${t('cancelKey')}`));
  lines.push('');
  process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
}

export function renderRenamePlaylistInput(name: string) {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.blueBright.bold(`  ${t('appName')}`) + chalk.dim(` (${langNames[getLang()]})`) + chalk.dim(`  ─  ${t('renamePlaylistTitle')}`));
  lines.push('');
  lines.push(chalk.white(`  ${t('renamePlaylistPrompt')} `) + chalk.white.bold(name) + chalk.blueBright(' █'));
  lines.push('');
  lines.push(chalk.dim(`  ${t('saveKey')}    ${t('cancelKey')}`));
  lines.push('');
  process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
}

export function renderNewPlaylistInput(name: string) {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.blueBright.bold(`  ${t('appName')}`) + chalk.dim(` (${langNames[getLang()]})`) + chalk.dim(`  ─  ${t('newPlaylistTitle')}`));
  lines.push('');
  lines.push(chalk.white(`  ${t('newPlaylistPrompt')} `) + chalk.white.bold(name) + chalk.blueBright(' █'));
  lines.push('');
  lines.push(chalk.dim(`  ${t('createPlaylistKey')}    ${t('cancelKey')}`));
  lines.push('');
  process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
}

export function renderLanguagePicker(langs: string[], selected: number) {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.blueBright.bold(`  ${t('appName')}`) + chalk.dim(` (${langNames[getLang()]})`) + chalk.dim(`  ─  ${t('languageTitle')}`));
  lines.push('');

  for (let i = 0; i < langs.length; i++) {
    const l = langs[i]!;
    const name = langNames[l as keyof typeof langNames];

    if (i === selected) {
      lines.push(chalk.bgBlue.white.bold(`  ▶ ${(i + 1).toString().padStart(2)}. ${name.padEnd(20)}`));
    } else {
      lines.push(chalk.dim(`  ${(i + 1).toString().padStart(2)}. `) + chalk.white(name));
    }
  }

  lines.push('');
  lines.push(chalk.dim(`  ${t('navigateKey')}    ${t('playKey')}    ${t('cancelKey')}`));
  lines.push('');
  process.stdout.write('\x1B[H' + lines.map(l => l + '\x1B[K').join('\n') + '\x1B[J');
}
export function renderHelp() {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.blueBright.bold(`  ${t('appName')}`) + chalk.dim(`  ─  ${t('helpTitle')}`));
  lines.push('');

  const sections = [
    {
      title: t('helpGeneral'),
      keys: [
        { k: 'S', d: actionText(t('search')) },
        { k: 'G', d: actionText(t('languageKey')) },
        { k: 'H', d: t('helpTitle') },
        { k: 'Q', d: t('helpBackOrQuit') },
      ]
    },
    {
      title: t('helpNavigation'),
      keys: [
        { k: 'L', d: t('favoritesTitle') },
        { k: 'O', d: t('playlistsTitle') },
        { k: 'D', d: t('downloadsTitle') },
        { k: 'A', d: actionText(t('addToPlaylist')) },
        { k: 'Enter', d: actionText(t('playKey')) },
        { k: 'Esc', d: t('helpBackCommandMode') },
      ]
    },
    {
      title: t('helpPlayback'),
      keys: [
        { k: 'Space', d: t('helpPauseResumeAction') },
        { k: 'N / P', d: t('helpNextPrev') },
        { k: '< / >', d: t('helpSeekAction') },
        { k: '+ / -', d: t('volume') },
        { k: 'X', d: actionText(t('shuffleToggle')) },
        { k: 'R', d: actionText(t('repeatKey')) },
        { k: 'F', d: actionText(t('favorite')) },
        { k: 'W', d: t('helpDownloadDelete') },
      ]
    }
  ];

  for (const sect of sections) {
    lines.push(chalk.white.bold(`  ${sect.title}`));
    for (const item of sect.keys) {
      lines.push(`    ${chalk.blueBright(item.k.padEnd(8))} ${chalk.dim(item.d)}`);
    }
    lines.push('');
  }

  lines.push(chalk.dim(`  ${t('backKey')}`));
  lines.push('');
  process.stdout.write('\x1B[H' + lines.map(l => l + CLR).join('\n') + '\x1B[J');
}

export function renderQueue(queue: Track[], currentTrack?: Track) {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.blueBright.bold(`  ${t('appName')}`) + chalk.dim(`  ─  ${t('queueTitle')}`));
  lines.push('');

  if (currentTrack) {
    lines.push(chalk.blueBright(`  ${t('playing')}:`));
    lines.push(chalk.white.bold(`    ▶ ${clip(currentTrack.title, 60)}`));
    lines.push('');
  }

  lines.push(chalk.dim(`  ${t('queueInfo')}`));
  if (queue.length === 0) {
    lines.push(chalk.dim(`    ${t('emptyQueue')}`));
  } else {
    for (let i = 0; i < Math.min(queue.length, 15); i++) {
      lines.push(chalk.white(`    ${(i + 1).toString().padStart(2)}. ${clip(queue[i]!.title, 60)}`));
    }
    if (queue.length > 15) {
      lines.push(chalk.dim(`    ${t('moreTracks', { count: queue.length - 15 })}`));
    }
  }

  lines.push('');
  lines.push(chalk.dim(`  ${t('backKey')}`));
  lines.push('');
  process.stdout.write('\x1B[H' + lines.map(l => l + CLR).join('\n') + '\x1B[J');
}

export function renderTrackInfo(track: Track) {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.blueBright.bold(`  ${t('appName')}`) + chalk.dim(`  ─  ${t('trackLabel')}`));
  lines.push('');

  lines.push(chalk.white.bold(`  ${track.title}`));
  if (track.uploader) lines.push(chalk.dim.italic(`  by ${track.uploader}`));
  lines.push('');
  
  if (track.url) {
    lines.push(chalk.dim(`  URL: `) + chalk.blue(track.url));
  }
  
  if (track.duration) {
    lines.push(chalk.dim(`  Duration: `) + chalk.white(fmt(track.duration)));
  }

  lines.push('');
  lines.push(chalk.dim(`  ${t('backKey')}`));
  lines.push('');
  process.stdout.write('\x1B[H' + lines.map(l => l + CLR).join('\n') + '\x1B[J');
}
