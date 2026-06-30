# Publishing Guide - ytmusic-player

Follow these steps to publish `ytmusic-player` under the account `mammadovziya`.

## 1. NPM Publication

The project uses a wrapper package with platform-specific optional dependencies. You must publish the platform packages first, then the main package.

### Step A: Login to NPM
```sh
npm login
```

### Step B: Publish Platform Packages
Navigate to each platform folder and publish them.

```sh
# Mac ARM64
cd npm/darwin-arm64 && npm publish --access public && cd ../..

# Mac x64
cd npm/darwin-x64 && npm publish --access public && cd ../..

# Linux x64
cd npm/linux-x64 && npm publish --access public && cd ../..

# Linux ARM64
cd npm/linux-arm64 && npm publish --access public && cd ../..

# Windows x64
cd npm/win32-x64 && npm publish --access public && cd ../..
```

### Step C: Publish the Main Package
Finally, publish the root package which will link to the optional dependencies above.

```sh
npm publish --access public
```

---

## 2. Homebrew Publication

To publish on Homebrew, you need to create a "tap" repository on your GitHub.

### Step A: Create a Tap Repository
1. Create a new public repository named `homebrew-tap` on GitHub (this is the standard name for personal taps).
2. Clone it locally.

### Step B: Prepare a Release
1. Push your code to your main `ytmusic-player` GitHub repo.
2. Create a new GitHub Release (e.g., `v0.3.0`).
3. Download the "Source code (tar.gz)" from that release.

### Step C: Update the Formula
1. Get the SHA256 of the downloaded tarball:
   ```sh
   openssl dgst -sha256 ytmusic-cli-0.3.0.tar.gz
   ```
2. Copy the content from `Formula/ytmusic-cli.rb` into your `homebrew-tap` repository as `Formula/ytmusic-cli.rb`.
3. Update the `sha256` field in the file with the value from step 1.
4. Commit and push to your `homebrew-tap` repo.

### Step D: Installation
Your users can now install via:
```sh
brew install mammadovziya/tap/ytmusic-cli
```
Note: If you name your repo `homebrew-tap`, the command becomes `mammadovziya/tap/ytmusic-cli`.

---

## 3. How to get `brew install ytmusic-cli` (without tap name)

To make it installable via just `brew install ytmusic-cli`, your project needs to be accepted into **Homebrew Core**.

**Requirements for Homebrew Core:**
- **Popularity**: Usually requires ~75+ stars on GitHub.
- **Stability**: Needs to be a stable, tagged release.
- **Source-based**: Homebrew Core prefers building from source rather than shipping pre-compiled binaries (unless it's a Cask).

**Recommendation:**
Start with your own tap (`mammadovziya/tap`). Once you have some users and stars, you can submit a Pull Request to [homebrew-core](https://github.com/Homebrew/homebrew-core).

Whenever you update the version:
1. Update `"version"` in all `package.json` files (root and sub-packages).
2. Run `bun run build` to regenerate binaries.
3. Repeat the publication steps above.
