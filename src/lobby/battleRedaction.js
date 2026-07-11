// Hides hidden-information zones (deck, hand, prizes, and — while Setup is
// still in progress — the not-yet-submitted Active/Bench choice) from
// everyone except the player who owns them. lobbyEngine.js's _broadcast()
// calls this once per connection, so each peer gets a state snapshot
// redacted from their own point of view; the host must read its own local
// UI through this too, never raw `this.state`.

function redactBattle(battle, viewerPeerId) {
  // Battles before the deal (still 'pending') or already 'finished' with
  // nothing secret left have no hidden fields to redact.
  if (!battle.players || !battle.decks) return battle;

  const next = { ...battle, hands: {}, decks: {}, prizePiles: {} };
  for (const peerId of battle.players) {
    const isViewer = peerId === viewerPeerId;
    next.hands[peerId] = isViewer ? battle.hands[peerId] : { count: battle.hands[peerId].length };
    next.decks[peerId] = isViewer ? battle.decks[peerId] : { count: battle.decks[peerId].length };
    next.prizePiles[peerId] = isViewer
      ? battle.prizePiles[peerId]
      : { count: battle.prizePiles[peerId].length };
  }

  // During Setup, a player's chosen Active/Bench cards stay in
  // `setupChoices` (not yet moved into `active`/`bench`) until BOTH players
  // have submitted — see lobbyEngine.js's `submit_setup` handler. So the
  // opponent's choice just needs to be nulled out entirely; there's nothing
  // to leak via `active`/`bench` themselves at this phase.
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
