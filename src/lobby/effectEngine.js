// Pure functions operating on plain battle-state objects (mutate in place,
// return log lines) — no PeerJS/Firestore imports, matching lobbyEngine.js's
// mutate-then-clone-on-broadcast style. Every mutation here must stay
// JSON-serializable (no functions, no undefined) since state is deep-cloned
// via JSON.parse(JSON.stringify()) on every broadcast.

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

export function applyEffect(effect, targetCard, sourceRuleId, sourceCardId) {
  const { action, amount, duration } = effect;
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
    targetCard.attack = Math.max(0, targetCard.attack + delta);
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

export function resolveRules(rules, trigger, targetCard, sourceCardId) {
  if (!rules || rules.length === 0) return [];
  const logs = [];
  for (const rule of rules) {
    if (rule.trigger !== trigger) continue;
    if (!checkCondition(rule.condition, targetCard)) continue;
    for (const effect of rule.effects) {
      logs.push(applyEffect(effect, targetCard, rule.id, sourceCardId));
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
        card.attack = Math.max(0, card.attack + delta);
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

export function startTurn(battle, peerId) {
  battle.turn = peerId;
  if (battle.trainerUsed) battle.trainerUsed[peerId] = false;

  const logs = [];
  const team = battle.teams[peerId];
  const activeCard = team?.[battle.active[peerId]];
  if (activeCard && (activeCard.cardType || 'meng') === 'meng') {
    logs.push(...decayStatuses(activeCard));
    logs.push(...resolveRules(activeCard.rules, 'on_turn_start', activeCard, activeCard.id));
  }
  return logs;
}
