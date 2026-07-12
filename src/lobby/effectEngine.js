// Pure functions operating on plain battle-state objects (mutate in place,
// return log lines) — no PeerJS/Firestore imports, matching lobbyEngine.js's
// mutate-then-clone-on-broadcast style. Every mutation here must stay
// JSON-serializable (no functions, no undefined) since state is deep-cloned
// via JSON.parse(JSON.stringify()) on every broadcast.

import { STATUS_EFFECT_ACTION_VALUES } from '../lib/ruleConstants';

export function checkCondition(condition, targetCard) {
  if (!condition) return true;
  if (typeof targetCard.currentHp !== 'number' || typeof targetCard.maxHp !== 'number' || targetCard.maxHp <= 0) {
    return true;
  }
  const percent = (targetCard.currentHp / targetCard.maxHp) * 100;
  if (condition.field === 'hp_below_percent') return percent < condition.value;
  if (condition.field === 'hp_above_percent') return percent > condition.value;
  return true;
}

// Special-Condition effects are only mechanically meaningful once the
// battle engine initializes `card.conditions` (added by deckBuilder.js /
// combatEngine.js). Pre-Setup or malformed cards simply log the attempt.
function applyStatusEffect(action, targetCard) {
  if (!targetCard.conditions) {
    return `${targetCard.name} would be affected, but Special Conditions aren't active in this battle yet.`;
  }
  switch (action) {
    case 'inflict_asleep':
      targetCard.conditions.primary = { type: 'asleep' };
      return `${targetCard.name} was put to sleep!`;
    case 'inflict_confused':
      targetCard.conditions.primary = { type: 'confused' };
      return `${targetCard.name} became confused!`;
    case 'inflict_paralyzed':
      targetCard.conditions.primary = { type: 'paralyzed', checkupsUntilClear: 2 };
      return `${targetCard.name} was paralyzed!`;
    case 'inflict_burned':
      targetCard.conditions.burned = {};
      return `${targetCard.name} was burned!`;
    case 'inflict_poisoned':
      targetCard.conditions.poisoned = {};
      return `${targetCard.name} was poisoned!`;
    case 'cure_all_conditions':
      targetCard.conditions = { primary: null, burned: null, poisoned: null };
      return `${targetCard.name}'s Special Conditions were cured.`;
    default:
      return '';
  }
}

export function applyEffect(effect, targetCard, sourceRuleId, sourceCardId) {
  const { action, amount, duration } = effect;
  if (STATUS_EFFECT_ACTION_VALUES.includes(action)) {
    return applyStatusEffect(action, targetCard);
  }

  const isPermanent = duration === 'permanent';
  const sign = action.startsWith('add_') ? 1 : -1;
  const delta = sign * amount;
  const isHp = action.includes('hp');

  if (isHp) {
    if (isPermanent) {
      const newMaxHp = Math.max(1, targetCard.maxHp + delta);
      const newCurrentHp = Math.max(0, Math.min(targetCard.currentHp + delta, newMaxHp));
      targetCard.maxHp = newMaxHp;
      targetCard.currentHp = newCurrentHp;
    } else {
      targetCard.currentHp = Math.max(0, targetCard.currentHp + delta);
    }
  } else {
    // Cards no longer carry a flat `.attack` number (replaced by `.attacks[]`
    // named attacks) — HP/Attack rule effects now target this flat modifier,
    // which combatEngine.js adds onto whichever attack is actually used.
    targetCard.attackDamageModifier = (targetCard.attackDamageModifier || 0) + delta;
  }

  if (!isPermanent) {
    targetCard.statuses = targetCard.statuses || [];
    targetCard.statuses.push({
      id: `${sourceRuleId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      sourceCardId,
      sourceRuleId,
      action,
      amount,
      roundsRemaining: duration,
    });
  }

  const verb = action.startsWith('add_') ? 'gained' : 'lost';
  const statLabel = isHp ? 'HP' : 'Attack';
  const durationText = isPermanent ? 'permanently' : `for ${duration} round${duration === 1 ? '' : 's'}`;
  return `${targetCard.name} ${verb} ${amount} ${statLabel} ${durationText}.`;
}

// `selfCard` is always the effect-owning card's target for HP/Attack
// effects. `opponentActiveCard` (when provided) is the target for
// Special-Condition effects instead — e.g. "on_hit: inflict_poisoned" reads
// as "when hit, poison the attacker." Falls back to `selfCard` when no
// opponent Active exists (or wasn't supplied), which is also exactly the
// correct behavior for Trainer on_play effects (always self-targeted).
export function resolveRules(rules, trigger, selfCard, sourceCardId, opponentActiveCard = null) {
  if (!rules || rules.length === 0) return [];
  const logs = [];
  for (const rule of rules) {
    if (rule.trigger !== trigger) continue;
    if (!checkCondition(rule.condition, selfCard)) continue;
    for (const effect of rule.effects) {
      const isStatus = STATUS_EFFECT_ACTION_VALUES.includes(effect.action);
      const target = isStatus ? (opponentActiveCard || selfCard) : selfCard;
      logs.push(applyEffect(effect, target, rule.id, sourceCardId));
    }
  }
  return logs;
}

export function decayStatuses(card) {
  if (!card.statuses || card.statuses.length === 0) return [];
  const logs = [];
  const remaining = [];

  for (const status of card.statuses) {
    const roundsLeft = status.roundsRemaining - 1;
    if (roundsLeft <= 0) {
      const revertSign = status.action.startsWith('add_') ? -1 : 1;
      const delta = revertSign * status.amount;
      if (status.action.includes('hp')) {
        card.currentHp = Math.max(0, card.currentHp + delta);
      } else {
        card.attackDamageModifier = (card.attackDamageModifier || 0) + delta;
      }
      const statLabel = status.action.includes('hp') ? 'HP' : 'Attack';
      const kind = status.action.startsWith('add_') ? 'boost' : 'penalty';
      logs.push(`${card.name}'s ${statLabel} ${kind} wore off.`);
    } else {
      remaining.push({ ...status, roundsRemaining: roundsLeft });
    }
  }

  card.statuses = remaining;
  return logs;
}

// Mandatory draw + whole-team (Active + Bench) on_turn_start triggers/decay,
// for the player whose turn is starting. Also resets the per-turn action
// flags and bumps the turn counters.
export function startTurn(battle, peerId) {
  const logs = [];

  battle.turn = peerId;
  battle.turnNumber = (battle.turnNumber || 0) + 1;
  battle.turnCountByPlayer[peerId] = (battle.turnCountByPlayer[peerId] || 0) + 1;
  battle.energyAttachedThisTurn[peerId] = false;
  battle.supporterUsedThisTurn[peerId] = false;
  battle.retreatedThisTurn[peerId] = false;

  if (battle.decks[peerId].length > 0) {
    const drawn = battle.decks[peerId].shift();
    battle.hands[peerId].push(drawn);
    // Structured, not a plain string: only the drawing player should see
    // WHICH card it was (their opponent's draw is still hidden info) —
    // battleRedaction.js resolves this into the right text per viewer.
    logs.push({ type: 'draw', peerId, playerName: battle.names[peerId], cardName: drawn.name });
  } else {
    // Deck-out isn't a loss condition here (removed on purpose), so this
    // is a real, reachable state — without a log line it just looks like
    // drawing silently stopped working.
    logs.push(`${battle.names[peerId]}'s deck is empty — no card to draw this turn.`);
  }

  // On top of the normal draw: Energy is a finite resource synthesized
  // once at deck-build time, not something that comes back on its own —
  // without a guaranteed trickle a player can end up with dead Pokemon
  // they can never power once their dedicated Energy is gone. So every
  // turn, pull one more Energy card straight from the deck (skipping the
  // draw pile's randomness just for this), while any remain.
  const energyIdx = battle.decks[peerId].findIndex((c) => c.cardType === 'energy');
  if (energyIdx !== -1) {
    const [energyCard] = battle.decks[peerId].splice(energyIdx, 1);
    battle.hands[peerId].push(energyCard);
    logs.push({ type: 'bonus_energy', peerId, playerName: battle.names[peerId], cardName: energyCard.name });
  }

  const opponentId = battle.players.find((p) => p !== peerId);
  const opponentActive = battle.active[opponentId] || null;
  const team = [battle.active[peerId], ...battle.bench[peerId]].filter(Boolean);
  for (const card of team) {
    if ((card.cardType || 'meng') !== 'meng') continue;
    logs.push(...decayStatuses(card));
    logs.push(...resolveRules(card.rules, 'on_turn_start', card, card.id, opponentActive));
  }

  return { logs };
}
