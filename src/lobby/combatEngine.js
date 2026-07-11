// Attack resolution (Energy cost, Confusion, weakness/resistance, custom
// on_attack/on_hit abilities) and the shared Knock Out / Prize / win-check
// pipeline. Pure functions on the plain battle-state object, mutate in
// place and return log lines — see effectEngine.js for the broader
// JSON-serializability contract this all has to honor.

import { resolveRules } from './effectEngine';

function flipCoin() {
  return Math.random() < 0.5 ? 'heads' : 'tails';
}

function otherPlayer(battle, peerId) {
  return battle.players.find((p) => p !== peerId);
}

// An attack's cost is legal iff every typed requirement is met by attached
// Energy of that exact type, and total attached Energy covers the cost's
// full length (untyped/"colorless" slots are absorbed by whatever's left).
export function canAffordAttack(attack, attachedEnergy) {
  const typedCounts = {};
  for (const c of attack.cost) {
    if (c === 'colorless') continue;
    typedCounts[c] = (typedCounts[c] || 0) + 1;
  }
  const attachedByType = {};
  for (const e of attachedEnergy) {
    attachedByType[e.energyType] = (attachedByType[e.energyType] || 0) + 1;
  }
  for (const type of Object.keys(typedCounts)) {
    if ((attachedByType[type] || 0) < typedCounts[type]) return false;
  }
  // Colorless (any-type) slots are covered by whatever's left once typed
  // requirements are set aside — checking total count handles this in one
  // shot without needing to track which specific Energy paid which slot.
  return attachedEnergy.length >= attack.cost.length;
}

// Moves a Knocked Out card (with its attached Energy) to its owner's
// discard pile, awards the top Prize card to `attackerPeerId` (skipped
// entirely for self-inflicted KOs — Confusion recoil, or a custom effect
// that damages its own owner — pass null/koPeerId as attackerPeerId for
// those), and checks the two KO-adjacent win conditions: last Prize taken,
// and the KO'd side's whole board (Active + Bench) now being empty.
// Otherwise appends `koPeerId` to `battle.pendingChoice` (an array, not a
// single value — a Checkup can rarely KO both players' Actives in the same
// cycle, and both then need to promote a Bench Pokemon before play resumes)
// so that player must promote a Bench Pokemon before anything else happens.
export function resolveKnockOut(battle, koPeerId, koCard, attackerPeerId) {
  const logs = [`${koCard.name} was Knocked Out!`];

  if (battle.active[koPeerId]?.id === koCard.id) {
    battle.active[koPeerId] = null;
  } else {
    battle.bench[koPeerId] = battle.bench[koPeerId].filter((c) => c.id !== koCard.id);
  }
  battle.discard[koPeerId].push({ ...koCard, imageUrl: null });

  const selfInflicted = !attackerPeerId || attackerPeerId === koPeerId;
  if (!selfInflicted) {
    const prizeCard = battle.prizePiles[attackerPeerId].shift();
    if (prizeCard) {
      battle.hands[attackerPeerId].push(prizeCard);
      logs.push(`${battle.names[attackerPeerId]} took a Prize card!`);
    }
    if (battle.prizePiles[attackerPeerId].length === 0) {
      battle.phase = 'finished';
      battle.winner = attackerPeerId;
      logs.push(`${battle.names[attackerPeerId]} took their last Prize card and wins!`);
      return { logs, gameEnded: true, pendingChoice: null };
    }
  }

  const boardEmpty = !battle.active[koPeerId] && battle.bench[koPeerId].length === 0;
  if (boardEmpty) {
    const winner = otherPlayer(battle, koPeerId);
    battle.phase = 'finished';
    battle.winner = winner;
    logs.push(`${battle.names[koPeerId]} has no Pokemon left, so ${battle.names[winner]} wins!`);
    return { logs, gameEnded: true, pendingChoice: null };
  }

  battle.pendingChoice = battle.pendingChoice || [];
  if (!battle.pendingChoice.includes(koPeerId)) battle.pendingChoice.push(koPeerId);
  return { logs, gameEnded: false, pendingChoice: koPeerId };
}

// Full attack pipeline for the `attack` intent. Returns
// { legal, logs, koResult, defenderId }. `koResult` (from resolveKnockOut)
// is null when nothing was Knocked Out; the caller is responsible for
// running Pokemon Checkup + startTurn afterward when the game didn't just
// end and no pendingChoice was armed.
export function resolveAttack(battle, attackerId, attackId) {
  const defenderId = otherPlayer(battle, attackerId);
  const attacker = battle.active[attackerId];
  const defender = battle.active[defenderId];

  if (!attacker || !defender) return { legal: false, logs: ['No Active Pokemon to attack with.'] };
  if (battle.turnNumber === 1) {
    return { legal: false, logs: ["The player who went first can't attack on their very first turn."] };
  }
  if (attacker.conditions?.primary?.type === 'asleep') {
    return { legal: false, logs: [`${attacker.name} is Asleep and can't attack.`] };
  }
  if (attacker.conditions?.primary?.type === 'paralyzed') {
    return { legal: false, logs: [`${attacker.name} is Paralyzed and can't attack.`] };
  }

  const attack = (attacker.attacks || []).find((a) => a.id === attackId);
  if (!attack) return { legal: false, logs: ['Unknown attack.'] };
  if (!canAffordAttack(attack, attacker.attachedEnergy || [])) {
    return { legal: false, logs: [`Not enough Energy attached to use ${attack.name}.`] };
  }

  const logs = [];
  logs.push(...resolveRules(attacker.rules, 'on_attack', attacker, attacker.id, defender));

  if (attacker.conditions?.primary?.type === 'confused') {
    if (flipCoin() === 'tails') {
      attacker.currentHp = Math.max(0, attacker.currentHp - 3);
      logs.push(`${attacker.name} is Confused and hurt itself for 3 instead of attacking!`);
      if (attacker.currentHp === 0) {
        const koResult = resolveKnockOut(battle, attackerId, attacker, null);
        logs.push(...koResult.logs);
        return { legal: true, logs, koResult, defenderId };
      }
      return { legal: true, logs, koResult: null, defenderId };
    }
    logs.push(`${attacker.name} shook off its confusion!`);
  }

  let damage = Math.max(0, attack.damage + (attacker.attackDamageModifier || 0));
  if (defender.weakness && defender.weakness === attacker.type) {
    damage *= 2;
    logs.push("It's super effective!");
  }
  if (defender.resistance && defender.resistance === attacker.type) {
    damage = Math.max(0, damage - 30);
    logs.push(`${defender.name} resisted some of the damage.`);
  }

  defender.currentHp = Math.max(0, defender.currentHp - damage);
  logs.push(`${attacker.name} used ${attack.name} for ${damage} damage to ${defender.name}.`);

  logs.push(...resolveRules(defender.rules, 'on_hit', defender, defender.id, attacker));

  let koResult = null;
  if (defender.currentHp === 0) {
    koResult = resolveKnockOut(battle, defenderId, defender, attackerId);
    logs.push(...koResult.logs);
  }

  return { legal: true, logs, koResult, defenderId };
}
