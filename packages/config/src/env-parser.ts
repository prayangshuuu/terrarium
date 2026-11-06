/**
 * @terrarium/config - env-parser.ts
 *
 * Lightweight, zero-dependency .env file parser.
 * Supports comments, export prefixes, quoted strings, and escaped characters.
 */

/**
 * Parses raw .env file text into key-value pairs.
 */
export function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // Skip empty lines and full-line comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Strip optional "export " prefix
    let line = trimmed;
    if (line.startsWith("export ")) {
      line = line.slice(7).trim();
    }

    const equalIndex = line.indexOf("=");
    if (equalIndex === -1) {
      continue;
    }

    const rawKey = line.slice(0, equalIndex).trim();
    let rawVal = line.slice(equalIndex + 1).trim();

    // Validate key name (alphanumeric and underscore)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(rawKey)) {
      continue;
    }

    // Handle quoted values
    if (
      (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
      (rawVal.startsWith("'") && rawVal.endsWith("'"))
    ) {
      const quoteChar = rawVal[0];
      let unquoted = rawVal.slice(1, -1);
      if (quoteChar === '"') {
        unquoted = unquoted
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
      }
      result[rawKey] = unquoted;
    } else {
      // Strip trailing inline comments if unquoted (e.g., KEY=value # comment)
      const commentIndex = rawVal.indexOf(" #");
      if (commentIndex !== -1) {
        rawVal = rawVal.slice(0, commentIndex).trim();
      }
      result[rawKey] = rawVal;
    }
  }

  return result;
}
