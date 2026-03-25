/**
 * call-health.ts — Call quality as DOT chain.
 *
 * Quality metrics (RTT, packet loss, bitrate, audio level) are reported
 * as DOTs in the call chain. getCallHealth() aggregates across the chain
 * to compute averages and summary stats.
 */

import { observe, sign } from '@dot-protocol/core';
import type { DOT, Identity } from '@dot-protocol/core';
import { append, walk } from '@dot-protocol/chain';
import type { CallSession, QualityMetrics, SignalPayloadEnvelope } from './types.js';

/** Hex-encode a public key. */
function pubkeyHex(pk: Uint8Array): string {
  return Buffer.from(pk).toString('hex');
}

/** Decode a DOT payload as an envelope, returning null if not parseable. */
function decodeEnvelope(dot: DOT): SignalPayloadEnvelope | null {
  if (dot.payload === undefined) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload));
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (!('kind' in parsed) || !('observer' in parsed)) return null;
    return parsed as SignalPayloadEnvelope;
  } catch {
    return null;
  }
}

/**
 * Report call quality metrics as a DOT in the call chain.
 *
 * Each quality report is signed by the reporting participant and
 * appended to the session's chain. Reports are accumulative —
 * the full quality history is preserved.
 *
 * @param session - The current call session
 * @param identity - The reporting participant's identity
 * @param metrics - The quality metrics to record
 * @returns Updated session and the appended quality DOT
 */
export async function reportQuality(
  session: CallSession,
  identity: Identity,
  metrics: QualityMetrics,
): Promise<{ session: CallSession; dot: DOT }> {
  const observer = pubkeyHex(identity.publicKey);
  const envelope: SignalPayloadEnvelope = {
    kind: 'call-start' as never, // reusing event type; kind='quality-report' stored in data
    observer,
    data: {
      qualityReport: true,
      rttMs: metrics.rttMs,
      packetLossPercent: metrics.packetLossPercent,
      bitrateKbps: metrics.bitrateKbps,
      audioLevel: metrics.audioLevel,
      timestamp: Date.now(),
    },
  };
  // Override kind with quality-report
  (envelope as Record<string, unknown>).kind = 'quality-report';

  const unsigned = observe(envelope, { type: 'measure', plaintext: true });
  const dot = await sign(unsigned, identity.secretKey);
  const newChain = append(session.chain, dot);
  return { session: { ...session, chain: newChain }, dot };
}

/**
 * Aggregate call health from quality report DOTs in the session chain.
 *
 * Scans all DOTs looking for quality reports, then computes averages.
 *
 * @param session - The call session to inspect
 * @returns Aggregated health metrics
 */
export function getCallHealth(session: CallSession): {
  avgRtt: number;
  avgLoss: number;
  duration: number;
  participantCount: number;
} {
  const dots = walk(session.chain);

  let totalRtt = 0;
  let totalLoss = 0;
  let reportCount = 0;

  for (const dot of dots) {
    const env = decodeEnvelope(dot);
    if (env === null) continue;
    const data = env.data;
    if (data.qualityReport !== true) continue;

    totalRtt += (data.rttMs as number) ?? 0;
    totalLoss += (data.packetLossPercent as number) ?? 0;
    reportCount++;
  }

  const avgRtt = reportCount > 0 ? totalRtt / reportCount : 0;
  const avgLoss = reportCount > 0 ? totalLoss / reportCount : 0;

  // Compute duration from session state
  const now = Date.now();
  const duration =
    session.startedAt !== undefined
      ? (session.endedAt ?? now) - session.startedAt
      : 0;

  // Count unique active participants
  const participantCount = Array.from(session.participants.values()).filter(
    (p) => p.leftAt === undefined,
  ).length;

  return { avgRtt, avgLoss, duration, participantCount };
}
