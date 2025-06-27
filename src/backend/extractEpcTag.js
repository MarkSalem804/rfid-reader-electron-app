/**
 * Attempts to extract a 24-character EPC tag from a hex string.
 * - Prefers tags starting with 'e2', but will fallback to any 24-char hex substring.
 * - Strips known prefixes (e.g., 'cccfff', 'aa55') if present.
 * @param {string} hexString
 * @returns {string|null}
 */
function extractEpcTag(hexString) {
  // 1. Try to find a standard EPC (starts with e2)
  let match = hexString.match(/e2[\da-f]{22}/i);
  if (match) return match[0].toLowerCase();

  // 2. Try to find any 24-character hex substring
  match = hexString.match(/[\da-f]{24}/i);
  if (match) return match[0].toLowerCase();

  // 3. Try to strip known prefixes and search again
  const knownPrefixes = ["cccfff", "aa55"];
  for (const prefix of knownPrefixes) {
    if (hexString.startsWith(prefix)) {
      const stripped = hexString.slice(prefix.length);
      // Try again for EPC
      let m = stripped.match(/e2[\da-f]{22}/i);
      if (m) return m[0].toLowerCase();
      m = stripped.match(/[\da-f]{24}/i);
      if (m) return m[0].toLowerCase();
    }
  }

  // 4. (Optional) Try reversing byte order if you know your reader sends little-endian
  // (Implement if needed)

  // No valid EPC found
  return null;
}

module.exports = extractEpcTag;
