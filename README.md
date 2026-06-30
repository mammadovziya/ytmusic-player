# ytmusic-player - YouTube Music Terminal Player

<div align="center">
  <img src="assets/ytmusic-player-ui.png" width="680" alt="ytmusic-player YouTube Music terminal player interface">
</div>

`ytmusic-player` is a fast YouTube Music CLI, terminal music player, and command-line YouTube player for Windows, macOS, and Linux. Search YouTube Music, stream audio through `mpv`, download songs with `yt-dlp`, and control playback from a keyboard-driven TUI.

[![npm version](https://img.shields.io/npm/v/ytmusic-player?color=orange)](https://www.npmjs.com/package/ytmusic-player)
[![Supported platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-blue)](#installation)
[![Latest release](https://img.shields.io/github/v/release/mammadovziya/ytmusic-player?label=release)](https://github.com/mammadovziya/ytmusic-player/releases)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-fbf0df?logo=bun&logoColor=black)](https://bun.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Project Links

- [Releases](https://github.com/mammadovziya/ytmusic-player/releases)
- [Tags](https://github.com/mammadovziya/ytmusic-player/tags)
- [Changelog](CHANGELOG.md)
- [Issues](https://github.com/mammadovziya/ytmusic-player/issues)
- [npm package](https://www.npmjs.com/package/ytmusic-player)

## Why Use It

- Fast terminal YouTube Music search and playback.
- Native audio playback through `mpv`.
- Offline downloads powered by `yt-dlp`.
- Local favorites, playlists, queue, shuffle, repeat, and volume controls.
- Cross-platform npm binaries for Windows x64, macOS Intel/Apple Silicon, and Linux x64/ARM64.

## Requirements

The player uses these command-line tools:

- `mpv` - media playback backend.
- `yt-dlp` - YouTube metadata, stream, mix, and download helper.

On first run, `ytmusic-player` checks for both tools and automatically installs missing dependencies when a supported package manager is available:

- Windows: `winget`
- macOS: `brew`
- Linux: `apt-get`, `dnf`, `yum`, `pacman`, `zypper`, or `apk`

Set `YTMUSIC_SKIP_AUTO_INSTALL=1` to disable automatic dependency setup and show manual install hints instead.

## Platform Support

| Platform | Architecture | Install path |
| :--- | :--- | :--- |
| Windows | x64 | npm package `ytmusic-player-win32-x64` |
| macOS | Apple Silicon | npm package `ytmusic-player-darwin-arm64` |
| macOS | Intel | npm package `ytmusic-player-darwin-x64` |
| Linux | x64 | npm package `ytmusic-player-linux-x64` |
| Linux | ARM64 | npm package `ytmusic-player-linux-arm64` |

## Installation

### Windows

Install the CLI from npm, then run it:

```powershell
npm install -g ytmusic-player
ym
```

The npm package includes a native Windows x64 binary and uses a Windows named pipe for `mpv` IPC.

### macOS

Homebrew installs the player and runtime dependencies:

```sh
brew tap mammadovziya/tap
brew install ytmusic-cli
ym
```

### Linux

Install the CLI, then run it:

```sh
npm install -g ytmusic-player
ym
```

### From Source

```sh
bun install
bun run src/index.ts
```

## Commands

After installation, these commands launch the same player:

```sh
ytmusic-player
ym
```

## Controls

| Key | Action |
| :--- | :--- |
| `Space` | Pause or resume |
| `Left` / `Right` | Seek -10s / +10s |
| `N` / `P` | Next or previous track |
| `+` / `-` | Volume up or down |
| `F` | Toggle favorite |
| `X` | Toggle shuffle |
| `R` | Cycle repeat mode |
| `U` | View playback queue |
| `I` | Show track info and URL |
| `A` | Add current track to a playlist |
| `S` | Return to search |
| `Q` / `Ctrl+C` | Quit |

## Features

- Search and play music directly from YouTube.
- Auto-filled radio mix queue after selecting a track.
- Favorites and local playlist management.
- Offline downloads saved under your Music folder.
- English, Azerbaijani, Turkish, Spanish, German, French, and Russian UI language support.
- Cross-platform `mpv` IPC support for Unix sockets and Windows named pipes.

## Privacy

- No analytics, telemetry, accounts, or browser cookies.
- `yt-dlp` runs with config, filesystem cache, and cookie loading disabled.
- `mpv` runs with user config, disk cache, resume files, cookies, and watch history disabled.
- Set `YTMUSIC_PROXY` to route yt-dlp traffic through a proxy:

```sh
YTMUSIC_PROXY=socks5://127.0.0.1:9050 ym
```

Network anonymity still depends on your network, proxy, or VPN. The app avoids local tracking and cookies, but it cannot hide your IP address by itself.

## Screenshots

<div align="center">
  <img src="assets/desktop-view.png" width="640" alt="ytmusic-player running in a desktop terminal">
  <p><i>Keyboard-first YouTube Music playback in the terminal.</i></p>
</div>

## Development

```sh
bun run src/index.ts
bun test
bun run build
```

`bun run build` compiles platform packages under `npm/` for macOS, Linux, and Windows.

## License

MIT. See `LICENSE` for details.
