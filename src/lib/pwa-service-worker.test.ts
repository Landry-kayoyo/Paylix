import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PWA service worker navigation handling', () => {
  it('bypasses document navigation caching so links like /login can open normally', () => {
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    const source = readFileSync(swPath, 'utf8');

    expect(source).toContain("request.mode === 'navigate'");
    expect(source).toContain('event.respondWith(fetch(request)');
  });
});
