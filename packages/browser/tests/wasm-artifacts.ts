import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));

export const wasmArtifacts = {
  dir: resolve(testDir, '../../wasm/pkg'),
  wasm: resolve(testDir, '../../wasm/pkg/dot_wasm_bg.wasm'),
  glue: resolve(testDir, '../../wasm/pkg/dot_wasm.js'),
};

export function hasWasmArtifacts(): boolean {
  return existsSync(wasmArtifacts.wasm) && existsSync(wasmArtifacts.glue);
}

export function describeIfWasmArtifacts(name: string, fn: () => void): void {
  if (hasWasmArtifacts()) {
    describe(name, fn);
  } else {
    describe.skip(name, fn);
  }
}
