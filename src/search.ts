import type { Track } from './types';
import { resolveCommand } from './platform';

export async function search(query: string, limit = 8): Promise<Track[]> {
  const ytdlp = resolveCommand('yt-dlp') ?? 'yt-dlp';
  const proc = Bun.spawn(
    [ytdlp, `ytsearch${limit}:${query}`, '--dump-json', '--flat-playlist', '--quiet'],
    { stderr: 'ignore' }
  );

  const text = await new Response(proc.stdout).text();
  await proc.exited;

  return text
    .split('\n')
    .filter(Boolean)
    .flatMap(line => {
      try {
        const d = JSON.parse(line);
        return [{
          id: d.id,
          title: d.title,
          url: `https://www.youtube.com/watch?v=${d.id}`,
          duration: d.duration,
          uploader: d.uploader || d.channel,
        }];
      } catch {
        return [];
      }
    });
}

export async function fetchMix(videoId: string, limit = 25): Promise<Track[]> {
  const url = `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`;
  const ytdlp = resolveCommand('yt-dlp') ?? 'yt-dlp';

  const proc = Bun.spawn(
    [ytdlp, url, '--dump-json', '--flat-playlist', '--quiet', '--playlist-end', String(limit)],
    { stderr: 'ignore' }
  );

  const text = await new Response(proc.stdout).text();
  await proc.exited;

  return text
    .split('\n')
    .filter(Boolean)
    .flatMap(line => {
      try {
        const d = JSON.parse(line);
        return [{
          id: d.id,
          title: d.title,
          url: `https://www.youtube.com/watch?v=${d.id}`,
          duration: d.duration,
          uploader: d.uploader || d.channel,
        }];
      } catch {
        return [];
      }
    });
}
