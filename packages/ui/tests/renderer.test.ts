/**
 * renderer.test.ts — Tests for renderToHTML.
 * Target: 15+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToHTML } from '../src/renderer.js';
import { composeRoomLayout } from '../src/composer.js';
import { resetIdCounter } from '../src/patterns.js';
import type { RoomLayout } from '../src/composer.js';

beforeEach(() => {
  resetIdCounter();
});

function minimalLayout(overrides: Partial<RoomLayout> = {}): RoomLayout {
  return {
    id: 'layout:.test:1',
    roomName: '.test',
    components: [],
    theme: 'dark',
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── HTML structure ───────────────────────────────────────────────────────────

describe('renderToHTML — structure', () => {
  it('returns a string', () => {
    expect(typeof renderToHTML(minimalLayout())).toBe('string');
  });

  it('starts with <!DOCTYPE html>', () => {
    expect(renderToHTML(minimalLayout()).trim().startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('contains <html', () => {
    expect(renderToHTML(minimalLayout())).toContain('<html');
  });

  it('contains <body>', () => {
    expect(renderToHTML(minimalLayout())).toContain('<body>');
  });

  it('contains closing </html>', () => {
    expect(renderToHTML(minimalLayout())).toContain('</html>');
  });

  it('contains room name in title', () => {
    const html = renderToHTML(minimalLayout({ roomName: '.physics' }));
    expect(html).toContain('.physics');
  });

  it('includes a <style> block', () => {
    expect(renderToHTML(minimalLayout())).toContain('<style>');
  });

  it('room-layout container is present', () => {
    expect(renderToHTML(minimalLayout())).toContain('class="room-layout"');
  });
});

// ─── Theme ────────────────────────────────────────────────────────────────────

describe('renderToHTML — theme', () => {
  it('dark theme sets data-theme="dark"', () => {
    expect(renderToHTML(minimalLayout({ theme: 'dark' }))).toContain('data-theme="dark"');
  });

  it('light theme sets data-theme="light"', () => {
    expect(renderToHTML(minimalLayout({ theme: 'light' }))).toContain('data-theme="light"');
  });

  it('dark theme CSS references background #09090b', () => {
    expect(renderToHTML(minimalLayout({ theme: 'dark' }))).toContain('#09090b');
  });
});

// ─── Pattern rendering ────────────────────────────────────────────────────────

describe('renderToHTML — patterns rendered', () => {
  it('renders observation-first component', () => {
    const layout = composeRoomLayout('.room');
    expect(renderToHTML(layout)).toContain('data-pattern="observation-first"');
  });

  it('renders threshold when firstVisit', () => {
    const layout = composeRoomLayout('.room', { firstVisit: true });
    expect(renderToHTML(layout)).toContain('data-pattern="threshold"');
  });

  it('renders mind-presence when minds provided', () => {
    const layout = composeRoomLayout('.room', {
      minds: [{ name: 'Feynman', domain: 'physics', active: true }],
    });
    expect(renderToHTML(layout)).toContain('data-pattern="mind-presence"');
  });

  it('renders chain-beneath when dots provided', () => {
    const layout = composeRoomLayout('.room', {
      recentDots: [{ hash: 'abc', content: 'test', depth: 0, trust: 0.9 }],
    });
    expect(renderToHTML(layout)).toContain('data-pattern="chain-beneath"');
  });

  it('renders sovereign-stop when stopped', () => {
    const layout = composeRoomLayout('.room', {
      kinState: { stopped: true, reason: 'Rate limit' },
    });
    expect(renderToHTML(layout)).toContain('data-pattern="sovereign-stop"');
  });

  it('renders doorway component', () => {
    const layout = composeRoomLayout('.room', {
      doorways: [{ room: '.physics', relevance: 'related' }],
    });
    expect(renderToHTML(layout)).toContain('data-pattern="doorway"');
  });

  it('escapes HTML in user content', () => {
    const layout = composeRoomLayout('.room', {
      kinState: { stopped: true, reason: '<script>alert(1)</script>' },
    });
    const html = renderToHTML(layout);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

// ─── Output size ─────────────────────────────────────────────────────────────

describe('renderToHTML — output size', () => {
  it('full layout is under 20KB', () => {
    const layout = composeRoomLayout('.full', {
      firstVisit: true,
      minds: [{ name: 'Feynman', domain: 'physics', active: true }],
      recentDots: [{ hash: 'abc', content: 'hello', depth: 0, trust: 0.9 }],
      doorways: [{ room: '.other', relevance: 'related' }],
      kinState: { stopped: false },
    });
    const html = renderToHTML(layout);
    expect(new TextEncoder().encode(html).length).toBeLessThan(20_480);
  });

  it('minimal layout produces non-empty output', () => {
    expect(renderToHTML(minimalLayout()).length).toBeGreaterThan(100);
  });
});
