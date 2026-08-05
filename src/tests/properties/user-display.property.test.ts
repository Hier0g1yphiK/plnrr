// Feature: multi-user-auth, Property 9: User display name formatting and truncation

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatUserDisplay } from '@/lib/user-display';

// **Validates: Requirements 9.1**

describe('Property 9: User display name formatting and truncation', () => {
  it('result never exceeds 31 characters (30 + 1-char ellipsis "…")', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: null }),
        fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: null }),
        (name, email) => {
          const result = formatUserDisplay(name, email);
          // "…" is a single character, so max length is 31 (30 chars + ellipsis)
          expect(result.length).toBeLessThanOrEqual(31);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('if name is non-null and non-empty, result starts with (prefix of) name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: null }),
        (name, email) => {
          const result = formatUserDisplay(name, email);
          const expectedPrefix = name.slice(0, 30);
          expect(result.startsWith(expectedPrefix)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('if name is null/empty but email is non-null and non-empty, result starts with (prefix of) email', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, ''),
        fc.string({ minLength: 1, maxLength: 100 }),
        (name, email) => {
          const result = formatUserDisplay(name, email);
          const expectedPrefix = email.slice(0, 30);
          expect(result.startsWith(expectedPrefix)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('if both name and email are null/empty, result is "User"', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, ''),
        fc.constantFrom(null, undefined, ''),
        (name, email) => {
          const result = formatUserDisplay(name, email);
          expect(result).toBe('User');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('truncation appends "…" when input exceeds 30 chars', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 31, maxLength: 100 }),
        fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: null }),
        (name, email) => {
          const result = formatUserDisplay(name, email);
          // Should be truncated with ellipsis
          expect(result).toBe(name.slice(0, 30) + '…');
          expect(result.endsWith('…')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
