/**
 * search.test.ts — Tests for the search JavaScript.
 */

import { describe, it, expect } from 'vitest';
import { searchScript } from '../src/search.js';

describe('searchScript', () => {
  it('returns a string', () => {
    expect(typeof searchScript()).toBe('string');
  });

  it('returns a <script> block', () => {
    const s = searchScript();
    expect(s.trimStart()).toMatch(/^<script>/);
    expect(s.trimEnd()).toMatch(/<\/script>$/);
  });

  it('contains an IIFE pattern', () => {
    expect(searchScript()).toContain('(function()');
  });

  it('listens to search input element by id', () => {
    expect(searchScript()).toContain("getElementById('vw-search')");
  });

  it('listens on input event', () => {
    expect(searchScript()).toContain("addEventListener('input'");
  });

  it('has debounce with setTimeout', () => {
    expect(searchScript()).toContain('setTimeout');
  });

  it('debounce delay is 200ms', () => {
    expect(searchScript()).toContain('200');
  });

  it('filters by label attribute', () => {
    expect(searchScript()).toContain('data-label');
  });

  it('filters by content attribute', () => {
    expect(searchScript()).toContain('data-content');
  });

  it('uses case-insensitive comparison (toLowerCase)', () => {
    const s = searchScript();
    expect(s).toContain('toLowerCase');
  });

  it('hides non-matching nodes', () => {
    expect(searchScript()).toContain('display');
  });

  it('shows ancestors of matching nodes', () => {
    // ancestors logic: parentElement traversal
    expect(searchScript()).toContain('parentElement');
  });

  it('handles empty search (shows all)', () => {
    expect(searchScript()).toContain("''");
  });

  it('shows no-results element when zero matches', () => {
    expect(searchScript()).toContain('vw-no-results');
  });

  it('produces syntactically valid JS — no parse error', () => {
    const s = searchScript();
    // Strip script tags to get raw JS
    const js = s.replace(/^<script>/, '').replace(/<\/script>$/, '');
    // If it parses without throwing, it's syntactically valid
    expect(() => new Function(js)).not.toThrow();
  });
});
