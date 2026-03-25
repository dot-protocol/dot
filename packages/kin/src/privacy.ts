/**
 * privacy.ts — PII detection and reformulation.
 *
 * Kin is a privacy firewall. Before any observation enters the mesh,
 * it is reformulated: personal identifiers are stripped or replaced
 * based on the active privacy level.
 *
 * The room sees the observation, not the observer's personal details.
 */

/** A detected PII occurrence in a string. */
export interface PIIDetection {
  /** Category of PII found. */
  type: 'email' | 'phone' | 'name' | 'address' | 'ip' | 'dob';
  /** The matched value. */
  value: string;
  /** Start index in the original string. */
  start: number;
  /** End index (exclusive) in the original string. */
  end: number;
}

// --- Detection patterns ---

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g;
// Names: two or more capitalized words in sequence (simple heuristic)
const NAME_RE = /\b([A-Z][a-z]{1,20})(?:\s+[A-Z][a-z]{1,20}){1,3}\b/g;
// Addresses: number followed by street keywords
const ADDRESS_RE = /\b\d{1,5}\s+[A-Z][a-zA-Z\s]{2,40}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl)\b/gi;
// IPv4
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
// Date of birth patterns: MM/DD/YYYY, YYYY-MM-DD, Month DD YYYY
const DOB_RE = /\b(?:\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi;

/**
 * Detect all PII occurrences in a string.
 *
 * Runs multiple pattern-based detectors and returns every match
 * with its type, value, and position.
 *
 * @param text - Input string to scan
 * @returns Array of detections, possibly overlapping
 */
export function detectPII(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];

  function collect(re: RegExp, type: PIIDetection['type']) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      detections.push({ type, value: m[0], start: m.index, end: m.index + m[0].length });
    }
  }

  collect(EMAIL_RE, 'email');
  collect(PHONE_RE, 'phone');
  collect(DOB_RE, 'dob');
  collect(IP_RE, 'ip');
  collect(ADDRESS_RE, 'address');
  // Names last — least precise, check that they're not already flagged as address
  collect(NAME_RE, 'name');

  return detections;
}

/**
 * Reformulate text by stripping or replacing PII based on privacy level.
 *
 * - minimal: strip emails and phone numbers only
 * - balanced: strip emails/phones, replace names with [Person], addresses with [Location]
 * - maximum: strip all PII types (emails, phones, names, addresses, IPs, DOBs)
 *
 * @param text - Input text to sanitize
 * @param level - Privacy level controlling aggressiveness
 * @returns Sanitized string
 */
export function reformulate(
  text: string,
  level: 'minimal' | 'balanced' | 'maximum'
): string {
  let result = text;

  if (level === 'minimal') {
    result = replacePattern(result, EMAIL_RE, '[email]');
    result = replacePattern(result, PHONE_RE, '[phone]');
    return result;
  }

  if (level === 'balanced') {
    result = replacePattern(result, EMAIL_RE, '[email]');
    result = replacePattern(result, PHONE_RE, '[phone]');
    result = replacePattern(result, ADDRESS_RE, '[Location]');
    result = replacePattern(result, NAME_RE, '[Person]');
    return result;
  }

  // maximum: strip everything
  result = replacePattern(result, EMAIL_RE, '[email]');
  result = replacePattern(result, PHONE_RE, '[phone]');
  result = replacePattern(result, DOB_RE, '[date]');
  result = replacePattern(result, IP_RE, '[ip]');
  result = replacePattern(result, ADDRESS_RE, '[Location]');
  result = replacePattern(result, NAME_RE, '[Person]');
  return result;
}

/** Replace all matches of a regex with a placeholder. */
function replacePattern(text: string, re: RegExp, placeholder: string): string {
  re.lastIndex = 0;
  return text.replace(re, placeholder);
}
