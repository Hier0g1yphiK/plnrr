// Feature: multi-user-auth, Property 1: Allowlist email matching is case-insensitive and correct
// Feature: multi-user-auth, Property 2: Allowlist parsing produces trimmed, lowercased entries

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseAllowlist, isEmailAllowed } from '@/lib/allowlist';

// **Validates: Requirements 2.1, 2.2, 2.3**

// === Arbitraries ===

/** Generates a plausible email-like string (local@domain) using ASCII chars */
const arbEmailChar = () => fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._+-'.split('')
);

const arbEmail = () =>
  fc
    .tuple(
      fc.array(arbEmailChar(), { minLength: 1, maxLength: 15 }).map((chars) => chars.join('')),
      fc.array(arbEmailChar(), { minLength: 1, maxLength: 10 }).map((chars) => chars.join(''))
    )
    .map(([local, domain]) => `${local}@${domain}.com`);

/** Generates an email with random casing applied */
const arbCasedEmail = () =>
  arbEmail().chain((email) =>
    fc.array(fc.boolean(), { minLength: email.length, maxLength: email.length }).map((bools) =>
      email
        .split('')
        .map((ch, i) => (bools[i] ? ch.toUpperCase() : ch.toLowerCase()))
        .join('')
    )
  );

/** Generates whitespace (spaces/tabs) of random length */
const arbWhitespace = () =>
  fc.array(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 5 }).map((arr) => arr.join(''));

// === Tests ===

describe('Property 1: Allowlist email matching is case-insensitive and correct', () => {
  it('isEmailAllowed returns true iff the lowercased email matches some entry in the lowercased allowlist', () => {
    fc.assert(
      fc.property(
        arbCasedEmail(),
        fc.array(arbEmail(), { minLength: 0, maxLength: 10 }),
        (email, allowlistEmails) => {
          // Build a normalized allowlist (as parseAllowlist would produce)
          const allowlist = allowlistEmails.map((e) => e.toLowerCase());

          const result = isEmailAllowed(email, allowlist);
          const expected = allowlist.includes(email.toLowerCase());

          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isEmailAllowed returns true for an email present in the allowlist regardless of casing', () => {
    fc.assert(
      fc.property(
        arbEmail(),
        fc.array(arbEmail(), { minLength: 0, maxLength: 5 }),
        (email, otherEmails) => {
          // Ensure the email is in the allowlist (lowercased, as parseAllowlist produces)
          const allowlist = [...otherEmails.map((e) => e.toLowerCase()), email.toLowerCase()];

          // Use a differently-cased version of the email
          const upperEmail = email.toUpperCase();
          expect(isEmailAllowed(upperEmail, allowlist)).toBe(true);

          const lowerEmail = email.toLowerCase();
          expect(isEmailAllowed(lowerEmail, allowlist)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isEmailAllowed returns false for null or undefined email', () => {
    fc.assert(
      fc.property(
        fc.array(arbEmail(), { minLength: 0, maxLength: 5 }),
        (allowlistEmails) => {
          const allowlist = allowlistEmails.map((e) => e.toLowerCase());
          expect(isEmailAllowed(null, allowlist)).toBe(false);
          expect(isEmailAllowed(undefined, allowlist)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 2: Allowlist parsing produces trimmed, lowercased entries', () => {
  it('parseAllowlist produces trimmed, lowercased entries with empty segments removed', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(arbWhitespace(), arbCasedEmail(), arbWhitespace()),
          { minLength: 1, maxLength: 10 }
        ),
        (segments) => {
          // Build a comma-separated string with whitespace around entries
          const raw = segments.map(([pre, email, post]) => `${pre}${email}${post}`).join(',');

          const result = parseAllowlist(raw);

          // Each result entry should be trimmed and lowercased
          const expected = segments
            .map(([_pre, email, _post]) => email.trim().toLowerCase())
            .filter(Boolean);

          expect(result).toEqual(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('parseAllowlist removes empty segments from comma-separated input', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            // Non-empty email segment
            fc.tuple(arbWhitespace(), arbCasedEmail(), arbWhitespace()).map(
              ([pre, email, post]) => `${pre}${email}${post}`
            ),
            // Empty segment (only whitespace)
            arbWhitespace()
          ),
          { minLength: 1, maxLength: 10 }
        ),
        (segments) => {
          const raw = segments.join(',');
          const result = parseAllowlist(raw);

          // Every entry in the result should be non-empty
          for (const entry of result) {
            expect(entry.length).toBeGreaterThan(0);
          }

          // All entries should be lowercase and trimmed
          for (const entry of result) {
            expect(entry).toBe(entry.toLowerCase());
            expect(entry).toBe(entry.trim());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('parseAllowlist returns empty array for undefined or empty input', () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist('')).toEqual([]);
    expect(parseAllowlist('   ')).toEqual([]);
  });
});
