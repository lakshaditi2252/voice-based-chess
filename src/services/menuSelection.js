import { matchCommand } from "./commandMatcher";

export function resolveMenuSelection({
  commandText,
  currentScreen,
  commandsByScreen,
  recentSelections,
  allowFuzzy = true,
  cooldownMs = 1200,
  now = Date.now(),
}) {
  const match = matchCommand(
    commandText,
    commandsByScreen[currentScreen] || [],
    { allowFuzzy }
  );

  if (!match) {
    return { shouldHandle: false, match: null };
  }

  const selectionKey = `${currentScreen}:${match.command}`;
  const lastAttempt = recentSelections.get(selectionKey) ?? 0;

  if (lastAttempt && now - lastAttempt < cooldownMs) {
    return {
      shouldHandle: false,
      match,
      selectionKey,
    };
  }

  recentSelections.set(selectionKey, now);

  return {
    shouldHandle: true,
    match,
    selectionKey,
  };
}
