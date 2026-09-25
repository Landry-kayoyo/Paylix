import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PWA installability config', () => {
  it('exposes a web manifest compatible with mobile install prompts', () => {
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.webmanifest');
    const raw = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);

    expect(manifest.name).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === '192x192')).toBe(true);
    expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === '512x512')).toBe(true);
  });
});
