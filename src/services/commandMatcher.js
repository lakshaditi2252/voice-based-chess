const COMMAND_ALIASES = {
  human: "human",
  humans: "human",
  ai: "ai",
  "a i": "ai",
  aye: "ai",
  voice: "voice",
  voyce: "voice",
  boys: "voice",
  wise: "voice",
  mouse: "mouse",
  mouths: "mouse",
  mice: "mouse",
  easy: "easy",
  easie: "easy",
  eezy: "easy",
  medium: "medium",
  median: "medium",
  mediam: "medium",
  hard: "hard",
  heart: "hard",
  white: "white",
  whyte: "white",
  wight: "white",
  black: "black",
  back: "black",
  block: "black",
  blak: "black",
};

const FILLER_WORDS = new Set([
  "choose",
  "select",
  "option",
  "please",
  "the",
]);

export function normalizeTranscript(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function phoneticDistance(left, right) {
  if (left === right) {
    return 0;
  }

  const leftChars = left.split("");
  const rightChars = right.split("");

  let score = 0;
  const maxLength = Math.max(leftChars.length, rightChars.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftChar = leftChars[index];
    const rightChar = rightChars[index];

    if (leftChar === rightChar) {
      score += 1;
      continue;
    }

    const commonSubstitutions = {
      v: "w",
      w: "v",
      i: "y",
      y: "i",
      a: "e",
      e: "a",
      o: "u",
      u: "o",
    };

    if (leftChar && rightChar && commonSubstitutions[leftChar] === rightChar) {
      score += 0.5;
    }
  }

  return maxLength - score;
}

function maxDistanceFor(command) {
  if (command.length <= 3) {
    return 1;
  }

  return command.length <= 5 ? 1.5 : 2;
}

// Exact aliases are safe to accept from interim results. Fuzzy matches are
// deliberately restricted to a single command word and final STT results.
export function matchCommand(transcript, allowedCommands, { allowFuzzy = true } = {}) {
  const normalized = normalizeTranscript(transcript);

  if (!normalized) {
    return null;
  }

  const allowed = new Set(allowedCommands);
  const exactMatch = COMMAND_ALIASES[normalized];

  if (exactMatch && allowed.has(exactMatch)) {
    return { command: exactMatch, normalized, matchedBy: "alias" };
  }

  const words = normalized.split(" ");
  for (const word of words) {
    const aliasMatch = COMMAND_ALIASES[word];
    if (aliasMatch && allowed.has(aliasMatch)) {
      return { command: aliasMatch, normalized, matchedBy: "alias" };
    }
  }

  if (!allowFuzzy) {
    return null;
  }

  const candidates = words.filter((word) => !FILLER_WORDS.has(word));
  if (candidates.length !== 1) {
    return null;
  }

  const [candidate] = candidates;
  let bestMatch = null;

  for (const command of allowed) {
    const distance = Math.min(
      levenshteinDistance(candidate, command),
      phoneticDistance(candidate, command)
    );

    if (distance <= maxDistanceFor(command) && (!bestMatch || distance < bestMatch.distance)) {
      bestMatch = { command, distance };
    }
  }

  return bestMatch
    ? { command: bestMatch.command, normalized, matchedBy: "fuzzy" }
    : null;
}
