const { shouldApplyRemote, advanceCursor } = require('../utils/syncHelpers');

describe('shouldApplyRemote (last-write-wins)', () => {
  test('applies when there is no local copy', () => {
    expect(shouldApplyRemote(null, '2026-06-24T10:00:00Z')).toBe(true);
    expect(shouldApplyRemote(undefined, '2026-06-24T10:00:00Z')).toBe(true);
  });

  test('applies when the remote is strictly newer', () => {
    expect(shouldApplyRemote('2026-06-24T10:00:00Z', '2026-06-24T10:00:01Z')).toBe(true);
  });

  test('SKIPS when remote equals local — this is what stops the echo loop', () => {
    expect(shouldApplyRemote('2026-06-24T10:00:00Z', '2026-06-24T10:00:00Z')).toBe(false);
  });

  test('skips when the remote is older', () => {
    expect(shouldApplyRemote('2026-06-24T10:00:05Z', '2026-06-24T10:00:00Z')).toBe(false);
  });

  test('applies when local has no timestamp', () => {
    expect(shouldApplyRemote(undefined, '2026-06-24T10:00:00Z')).toBe(true);
  });

  test('convergence: re-pulling the same doc (equal ts) never re-applies', () => {
    const ts = '2026-06-24T12:34:56.000Z';
    // first pull onto an empty local -> apply, local now has ts
    expect(shouldApplyRemote(null, ts)).toBe(true);
    // every subsequent pull of the unchanged doc -> skip
    expect(shouldApplyRemote(ts, ts)).toBe(false);
    expect(shouldApplyRemote(ts, ts)).toBe(false);
  });
});

describe('advanceCursor', () => {
  test('moves forward to the newest timestamp seen', () => {
    const c = advanceCursor('2026-06-24T10:00:00Z', ['2026-06-24T09:00:00Z', '2026-06-24T11:00:00Z']);
    expect(new Date(c).toISOString()).toBe('2026-06-24T11:00:00.000Z');
  });

  test('never moves backwards', () => {
    const c = advanceCursor('2026-06-24T10:00:00Z', ['2026-06-24T08:00:00Z']);
    expect(new Date(c).toISOString()).toBe('2026-06-24T10:00:00.000Z');
  });

  test('handles a null starting cursor', () => {
    const c = advanceCursor(null, ['2026-06-24T08:00:00Z']);
    expect(new Date(c).toISOString()).toBe('2026-06-24T08:00:00.000Z');
  });

  test('returns the original when there are no candidates', () => {
    expect(advanceCursor('2026-06-24T10:00:00Z', [])).toBe('2026-06-24T10:00:00.000Z');
    expect(advanceCursor(null, [])).toBeNull();
  });
});
