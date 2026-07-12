// Hides hidden-information zones (deck, hand, prizes, Energy pool, and —
// while a player is mid-pick — their not-yet-submitted deck selection or
// Active/Bench choice) from everyone except the player who owns them.
// lobbyEngine.js's _broadcast() calls this once per connection, so each
// peer gets a state snapshot redacted from their own point of view; the
// host must read its own local UI through this too, never raw
// `this.state`. `cardPool` (the shared Dex pool during 'deckbuild') is
// intentionally never redacted — it's public, both players pick from it.

function redactBattle(battle, viewerPeerId) {
  // Battles before the deal (still 'pending') have no hidden fields yet.
  if (!battle.players) return battle;

  const next = { ...battle };

  if (battle.decks) {
    next.hands = {};
    next.decks = {};
    next.prizePiles = {};
    for (const peerId of battle.players) {
      const isViewer = peerId === viewerPeerId;
      next.hands[peerId] = isViewer ? battle.hands[peerId] : { count: battle.hands[peerId].length };
      next.decks[peerId] = isViewer ? battle.decks[peerId] : { count: battle.decks[peerId].length };
      next.prizePiles[peerId] = isViewer
        ? battle.prizePiles[peerId]
        : { count: battle.prizePiles[peerId].length };
    }
  }

  if (battle.energyPools) {
    next.energyPools = {};
    for (const peerId of battle.players) {
      const isViewer = peerId === viewerPeerId;
      const pool = battle.energyPools[peerId];
      const total = Object.values(pool || {}).reduce((sum, n) => sum + n, 0);
      next.energyPools[peerId] = isViewer ? pool : { count: total };
    }
  }

  // A player's picked-but-not-yet-both-ready deck selection or Active/Bench
  // choice stays hidden from the opponent until both submit and the host
  // materializes them into the real (redacted-by-count) hands/decks/prizes
  // or active/bench fields — see lobbyEngine.js's `submit_deck` and
  // `submit_setup` handlers.
  if (battle.deckSelections) {
    next.deckSelections = {};
    for (const peerId of battle.players) {
      next.deckSelections[peerId] = peerId === viewerPeerId ? battle.deckSelections[peerId] : null;
    }
  }
  if (battle.setupChoices) {
    next.setupChoices = {};
    for (const peerId of battle.players) {
      next.setupChoices[peerId] = peerId === viewerPeerId ? battle.setupChoices[peerId] : null;
    }
  }

  return next;
}

export function redactStateFor(state, viewerPeerId) {
  const battles = {};
  for (const [battleId, battle] of Object.entries(state.battles || {})) {
    battles[battleId] = redactBattle(battle, viewerPeerId);
  }
  return { ...state, battles };
}
