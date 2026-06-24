// Pure, DB-free helpers for the cloud sync client, so the conflict-resolution and
// cursor logic can be unit-tested without a database or network.

// Last-write-wins: should a remote (cloud) doc overwrite the local copy?
// Apply when there is no local copy (or it has no timestamp), or when the remote
// was written strictly later than the local copy. A remote that is equal-or-older
// is skipped — this is what stops a just-pulled doc from ping-ponging back.
function shouldApplyRemote(existingUpdatedAt, remoteUpdatedAt) {
  const remote = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
  if (!existingUpdatedAt) return true;
  const local = new Date(existingUpdatedAt).getTime();
  return remote > local;
}

// Advance a push cursor (an ISO string) to the newest updatedAt seen, never moving
// it backwards. Used to track the high-water mark of locally-changed docs.
function advanceCursor(currentIso, candidateDates = []) {
  let maxTs = currentIso ? new Date(currentIso).getTime() : 0;
  for (const d of candidateDates) {
    const t = d ? new Date(d).getTime() : 0;
    if (t > maxTs) maxTs = t;
  }
  return maxTs ? new Date(maxTs).toISOString() : currentIso || null;
}

module.exports = { shouldApplyRemote, advanceCursor };
