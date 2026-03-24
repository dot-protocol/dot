/**
 * handlers.ts — Tool handler implementations for the DOT MCP server.
 *
 * Each handler:
 *  1. Receives typed params from the dispatcher.
 *  2. Creates or reuses the shared DotRuntime (lazy boot on first call).
 *  3. Calls the appropriate @dot-protocol/* functions.
 *  4. Emits a self-awareness DOT measuring tool call duration.
 *  5. Returns a plain JSON-serialisable result object.
 *
 * Error handling: handlers throw — the MCPServer catches and wraps in error results.
 */

import {
  observe as coreObserve,
  sign as coreSign,
  verify as coreVerify,
  computeTrust,
  computeLevel,
  toBytes,
  fromBytes,
  type DOT,
} from '@dot-protocol/core';
import { depth as chainDepth, tip as chainTip, dotHashToHex, bufToHex } from '@dot-protocol/chain';
import { run as langRun, explain as langExplain, check as langCheck } from '@dot-protocol/lang';
import { createRuntime, type DotRuntime } from '@dot-protocol/script';

// ---------------------------------------------------------------------------
// Shared runtime (lazy singleton)
// ---------------------------------------------------------------------------

let _runtime: DotRuntime | null = null;
let _bootTime: number | null = null;

/** Return existing runtime or null. */
export function getRuntimeOrNull(): DotRuntime | null {
  return _runtime;
}

/** Force-set the runtime (for testing). */
export function setRuntime(rt: DotRuntime | null): void {
  _runtime = rt;
  _bootTime = rt ? Date.now() : null;
}

/** Get-or-create the shared runtime. */
async function ensureRuntime(meshEnabled = false): Promise<DotRuntime> {
  if (_runtime === null) {
    _runtime = await createRuntime({ meshEnabled });
    _bootTime = Date.now();
  }
  return _runtime;
}

// ---------------------------------------------------------------------------
// Self-awareness: emit a measure DOT for each tool call
// ---------------------------------------------------------------------------

async function emitToolMetric(toolName: string, durationMs: number): Promise<void> {
  if (_runtime === null) return;
  try {
    await _runtime.observe(
      { tool: toolName, duration_ms: durationMs, ts: Date.now() },
      { type: 'measure', plaintext: true },
    );
  } catch {
    // Non-fatal — metric emission must never break the main tool call.
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexify(bytes: Uint8Array | undefined): string {
  if (!bytes) return '';
  return Buffer.from(bytes).toString('hex');
}

function dotToBase64(dot: DOT): string {
  return Buffer.from(toBytes(dot)).toString('base64');
}

function dotFromBase64(b64: string): DOT {
  const bytes = Buffer.from(b64, 'base64');
  return fromBytes(new Uint8Array(bytes));
}

// ---------------------------------------------------------------------------
// Handler: dot_boot
// ---------------------------------------------------------------------------

export interface BootParams {
  meshEnabled?: boolean;
}

export interface BootResult {
  publicKey: string;
  chainDepth: number;
  bootTimeMs: number;
}

export async function handleBoot(params: BootParams): Promise<BootResult> {
  const t0 = Date.now();
  // Reset runtime so each boot creates a fresh identity
  _runtime = null;
  const rt = await ensureRuntime(params.meshEnabled ?? false);
  const depth = chainDepth(rt.chain);
  const duration = Date.now() - t0;
  await emitToolMetric('dot_boot', duration);
  return {
    publicKey: hexify(rt.identity.publicKey),
    chainDepth: depth,
    bootTimeMs: duration,
  };
}

// ---------------------------------------------------------------------------
// Handler: dot_observe
// ---------------------------------------------------------------------------

export interface ObserveParams {
  payload?: string;
  type?: 'measure' | 'state' | 'event' | 'claim' | 'bond';
  plaintext?: boolean;
}

export interface ObserveResult {
  hash: string;
  level: number;
  trust: number;
  dotBytes: string;
}

export async function handleObserve(params: ObserveParams): Promise<ObserveResult> {
  const t0 = Date.now();
  const rt = await ensureRuntime();

  // Try to parse JSON payload, fall back to string
  let payload: unknown = params.payload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      // keep as string
    }
  }

  const dot = await rt.observe(payload, {
    type: params.type,
    plaintext: params.plaintext,
  });

  const duration = Date.now() - t0;
  await emitToolMetric('dot_observe', duration);

  return {
    hash: dotHashToHex(dot),
    level: computeLevel(dot),
    trust: computeTrust(dot),
    dotBytes: dotToBase64(dot),
  };
}

// ---------------------------------------------------------------------------
// Handler: dot_verify
// ---------------------------------------------------------------------------

export interface VerifyParams {
  dotBytes: string;
}

export interface VerifyResult {
  valid: boolean;
  checked: string[];
  reason?: string;
}

export async function handleVerify(params: VerifyParams): Promise<VerifyResult> {
  const t0 = Date.now();
  const dot = dotFromBase64(params.dotBytes);
  const result = await coreVerify(dot);
  const duration = Date.now() - t0;
  await emitToolMetric('dot_verify', duration);
  return {
    valid: result.valid,
    checked: result.checked,
    reason: result.reason,
  };
}

// ---------------------------------------------------------------------------
// Handler: dot_chain
// ---------------------------------------------------------------------------

export interface ChainResult {
  depth: number;
  tipHash: string;
  dotCount: number;
}

export async function handleChain(_params: Record<string, unknown>): Promise<ChainResult> {
  const t0 = Date.now();
  const rt = await ensureRuntime();
  const tip = chainTip(rt.chain);
  const duration = Date.now() - t0;
  await emitToolMetric('dot_chain', duration);
  return {
    depth: chainDepth(rt.chain),
    tipHash: tip ? dotHashToHex(tip) : '',
    dotCount: rt.chain.storage.count(),
  };
}

// ---------------------------------------------------------------------------
// Handler: dot_sign
// ---------------------------------------------------------------------------

export interface SignParams {
  payload?: string;
  type?: 'measure' | 'state' | 'event' | 'claim' | 'bond';
}

export interface SignResult {
  hash: string;
  signature: string;
  dotBytes: string;
}

export async function handleSign(params: SignParams): Promise<SignResult> {
  const t0 = Date.now();
  const rt = await ensureRuntime();

  // Create unsigned DOT
  const unsigned = coreObserve(params.payload ?? '', {
    type: params.type ?? 'event',
    plaintext: true,
  });

  // Sign with runtime identity
  const signed = await coreSign(unsigned as DOT, rt.identity.secretKey);
  const duration = Date.now() - t0;
  await emitToolMetric('dot_sign', duration);

  return {
    hash: dotHashToHex(signed),
    signature: hexify(signed.sign?.signature),
    dotBytes: dotToBase64(signed),
  };
}

// ---------------------------------------------------------------------------
// Handler: dot_trust
// ---------------------------------------------------------------------------

export interface TrustParams {
  payload?: string;
  type?: 'measure' | 'state' | 'event' | 'claim' | 'bond';
  signed?: boolean;
}

export interface TrustResult {
  trust: number;
  breakdown: {
    hasSignature: boolean;
    hasTime: boolean;
    hasChain: boolean;
    hasVerifyHash: boolean;
    isFHE: boolean;
    identityLevel: string;
    chainDepthBonus: number;
  };
}

export async function handleTrust(params: TrustParams): Promise<TrustResult> {
  const t0 = Date.now();
  const rt = await ensureRuntime();

  let dot: DOT;
  if (params.signed !== false) {
    dot = await rt.observe(params.payload ?? '', { type: params.type, plaintext: false });
  } else {
    dot = coreObserve(params.payload ?? '', { type: params.type, plaintext: false }) as DOT;
  }

  const trust = computeTrust(dot);
  const depth = dot.chain?.depth ?? 0;

  const duration = Date.now() - t0;
  await emitToolMetric('dot_trust', duration);

  return {
    trust,
    breakdown: {
      hasSignature: dot.sign?.signature !== undefined,
      hasTime: dot.time?.utc !== undefined,
      hasChain: dot.chain?.previous !== undefined,
      hasVerifyHash: dot.verify?.hash !== undefined,
      isFHE: dot.payload_mode === 'fhe',
      identityLevel: dot.sign?.level ?? 'absent',
      chainDepthBonus: depth > 1 ? 1 + Math.log10(depth) : 1.0,
    },
  };
}

// ---------------------------------------------------------------------------
// Handler: dot_compile
// ---------------------------------------------------------------------------

export interface CompileParams {
  source: string;
}

export interface CompileResult {
  typescript: string;
  errors: string[];
}

export async function handleCompile(params: CompileParams): Promise<CompileResult> {
  const t0 = Date.now();
  let typescript = '';
  const errors: string[] = [];

  try {
    typescript = langRun(params.source);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const duration = Date.now() - t0;
  await emitToolMetric('dot_compile', duration);
  return { typescript, errors };
}

// ---------------------------------------------------------------------------
// Handler: dot_explain
// ---------------------------------------------------------------------------

export interface ExplainParams {
  source: string;
}

export interface ExplainResult {
  english: string;
}

export async function handleExplain(params: ExplainParams): Promise<ExplainResult> {
  const t0 = Date.now();
  let english = '';

  try {
    english = langExplain(params.source);
  } catch (err) {
    english = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }

  const duration = Date.now() - t0;
  await emitToolMetric('dot_explain', duration);
  return { english };
}

// ---------------------------------------------------------------------------
// Handler: dot_health
// ---------------------------------------------------------------------------

export interface HealthResult {
  uptime: number;
  dotsCreated: number;
  chainsActive: number;
  runtimeReady: boolean;
}

export async function handleHealth(_params: Record<string, unknown>): Promise<HealthResult> {
  const t0 = Date.now();

  if (_runtime === null) {
    return { uptime: 0, dotsCreated: 0, chainsActive: 0, runtimeReady: false };
  }

  const healthDot = _runtime.health();
  const duration = Date.now() - t0;
  await emitToolMetric('dot_health', duration);

  // Decode payload to extract structured health data
  let uptime = 0;
  let dotsCreated = 0;
  let chainsActive = 1;

  if (healthDot.payload && healthDot.payload_mode === 'plain') {
    try {
      const decoded = new TextDecoder().decode(healthDot.payload);
      const data = JSON.parse(decoded) as Record<string, unknown>;
      uptime = typeof data['uptime_ms'] === 'number' ? data['uptime_ms'] : Date.now() - (_bootTime ?? Date.now());
      dotsCreated = typeof data['dots_created'] === 'number' ? data['dots_created'] : 0;
      chainsActive = typeof data['chains_active'] === 'number' ? data['chains_active'] : 1;
    } catch {
      uptime = Date.now() - (_bootTime ?? Date.now());
    }
  }

  return { uptime, dotsCreated, chainsActive, runtimeReady: true };
}

// ---------------------------------------------------------------------------
// Handler: dot_execute
// ---------------------------------------------------------------------------

export interface ExecuteParams {
  source: string;
}

export interface ExecuteResult {
  dots: Array<{ hash: string; type: string; trust: number }>;
  duration_ms: number;
  typescript: string;
  errors: string[];
}

export async function handleExecute(params: ExecuteParams): Promise<ExecuteResult> {
  const t0 = Date.now();
  const errors: string[] = [];
  const dots: Array<{ hash: string; type: string; trust: number }> = [];
  let typescript = '';

  try {
    // Step 1: compile to TypeScript
    typescript = langRun(params.source);

    // Step 2: check semantic validity first
    const checkResult = langCheck(params.source);
    if (checkResult.errors.length > 0) {
      for (const e of checkResult.errors) {
        errors.push(`${e.line}:${e.column} — ${e.message}`);
      }
    } else {
      // Step 3: execute by interpreting the AST via the live runtime
      // We simulate execution by observing each statement as a DOT
      const rt = await ensureRuntime();

      // Parse the source to extract observation statements
      const { lex } = await import('@dot-protocol/lang');
      const { parse } = await import('@dot-protocol/lang');
      const { tokens } = lex(params.source);
      const { ast } = parse(tokens, params.source);

      for (const stmt of ast.body) {
        if (stmt.type === 'ObserveStatement') {
          const obs = stmt as { type: string; observationType?: string };
          const dot = await rt.observe(
            { source_stmt: obs.observationType ?? 'unknown', executed_by: 'dot_execute' },
            { type: (obs.observationType as 'measure' | 'state' | 'event' | 'claim' | 'bond') ?? 'event', plaintext: true },
          );
          dots.push({
            hash: dotHashToHex(dot),
            type: dot.type ?? 'event',
            trust: computeTrust(dot),
          });
        }
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const duration_ms = Date.now() - t0;
  await emitToolMetric('dot_execute', duration_ms);

  return { dots, duration_ms, typescript, errors };
}

// ---------------------------------------------------------------------------
// Handler: dot_bridge
// ---------------------------------------------------------------------------

export interface BridgeParams {
  legacyDot: string;
}

export interface BridgeResult {
  converted: Record<string, unknown>;
  bridgeDot?: string;
  warnings: string[];
}

export async function handleBridge(params: BridgeParams): Promise<BridgeResult> {
  const t0 = Date.now();
  const warnings: string[] = [];

  // Parse legacy JSON
  let legacy: Record<string, unknown>;
  try {
    legacy = JSON.parse(params.legacyDot) as Record<string, unknown>;
  } catch {
    throw new Error('legacyDot must be a valid JSON string');
  }

  // Map v0.3.0 fields → R854 STCV structure
  const converted: Record<string, unknown> = {};

  // Payload
  if (legacy['data'] !== undefined) {
    converted['payload'] = legacy['data'];
    converted['payload_mode'] = 'plain';
  } else if (legacy['payload'] !== undefined) {
    converted['payload'] = legacy['payload'];
    converted['payload_mode'] = legacy['encrypted'] === true ? 'fhe' : 'plain';
  }

  // Type
  if (legacy['type'] !== undefined) {
    converted['type'] = legacy['type'];
  } else if (legacy['kind'] !== undefined) {
    converted['type'] = legacy['kind'];
    warnings.push('Mapped legacy "kind" field to "type"');
  }

  // S: Sign base
  const signBase: Record<string, unknown> = {};
  if (legacy['pub_key'] !== undefined) {
    signBase['observer'] = legacy['pub_key'];
    warnings.push('Legacy pub_key mapped to sign.observer (raw hex — not decoded to Uint8Array)');
  }
  if (legacy['sig'] !== undefined) {
    signBase['signature'] = legacy['sig'];
    warnings.push('Legacy sig mapped to sign.signature (raw hex — not decoded to Uint8Array)');
  }
  if (Object.keys(signBase).length > 0) {
    converted['sign'] = signBase;
  }

  // T: Time base
  if (legacy['timestamp'] !== undefined || legacy['ts'] !== undefined) {
    converted['time'] = { utc: legacy['timestamp'] ?? legacy['ts'] };
  }

  // C: Chain base
  if (legacy['prev_hash'] !== undefined) {
    converted['chain'] = { previous: legacy['prev_hash'] };
    warnings.push('Legacy prev_hash mapped to chain.previous (raw hex — not decoded to Uint8Array)');
  }

  // V: Verify base
  if (legacy['payload_hash'] !== undefined) {
    converted['verify'] = { hash: legacy['payload_hash'] };
    warnings.push('Legacy payload_hash mapped to verify.hash (raw hex — not decoded to Uint8Array)');
  }

  // Emit a bridge audit DOT
  let bridgeDotB64: string | undefined;
  if (_runtime !== null) {
    const auditDot = await _runtime.observe(
      { bridged_from: 'v0.3.0', fields_mapped: Object.keys(converted), warnings_count: warnings.length },
      { type: 'event', plaintext: true },
    );
    bridgeDotB64 = dotToBase64(auditDot);
  }

  const duration = Date.now() - t0;
  await emitToolMetric('dot_bridge', duration);

  return {
    converted,
    bridgeDot: bridgeDotB64,
    warnings,
  };
}
