export function getYtdlpPrivacyArgs(): string[] {
  const args = [
    '--ignore-config',
    '--no-cache-dir',
    '--no-cookies',
    '--no-cookies-from-browser',
    '--no-warnings',
  ];

  const proxy = getProxyUrl();
  if (proxy) {
    args.push('--proxy', proxy);
  }

  return args;
}

export function getMpvPrivacyArgs(): string[] {
  const ytdlpOptions = [
    'ignore-config=',
    'no-cache-dir=',
    'no-cookies=',
    'no-cookies-from-browser=',
  ];

  const proxy = getProxyUrl();
  if (proxy) {
    ytdlpOptions.push(`proxy=${proxy}`);
  }

  const args = [
    '--no-config',
    '--cache-on-disk=no',
    '--resume-playback=no',
    '--save-watch-history=no',
    '--cookies=no',
    `--ytdl-raw-options=${ytdlpOptions.join(',')}`,
  ];

  if (proxy && /^https?:\/\//i.test(proxy)) {
    args.push(`--http-proxy=${proxy}`);
  }

  return args;
}

function getProxyUrl(): string {
  return process.env.YTMUSIC_PROXY?.trim() ?? '';
}
