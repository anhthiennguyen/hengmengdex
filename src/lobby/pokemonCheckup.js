// "Pokemon Checkup" — resolves Burn/Poison damage and Asleep/Paralyzed
// condition ticks on both players' Active Pokemon. Runs between every turn:
// after an attack or a pass, before the next player's startTurn().

import { resolveKnockOut } from './combatEngine';

function flipCoin() {
  return Math.random() < 0.5 ? 'heads' : 'tails';
}

// Checkup for one player's Active Pokemon. Returns { logs, koResult }.
function checkupOne(battle, peerId) {
  const logs = [];
  const card = battle.active[peerId];
  if (!card || !card.conditions) return { logs, koResult: null };

  if (card.conditions.burned) {
    card.currentHp = Math.max(0, card.currentHp - 2);
    logs.push(`${card.name} is Burned and took 2 damage.`);
    if (card.currentHp <= 0) {
      const koResult = resolveKnockOut(battle, peerId, card, null);
      logs.push(...koResult.logs);
      return { logs, koResult };
    }
    if (flipCoin() === 'heads') {
      card.conditions.burned = null;
      logs.push(`${card.name}'s Burn was cured.`);
    }
  }

  if (card.conditions.poisoned) {
    card.currentHp = Math.max(0, card.currentHp - 1);
    logs.push(`${card.name} is Poisoned and took 1 damage.`);
    if (card.currentHp <= 0) {
      const koResult = resolveKnockOut(battle, peerId, card, null);
      logs.push(...koResult.logs);
      return { logs, koResult };
    }
  }

  if (card.conditions.primary?.type === 'asleep') {
    if (flipCoin() === 'heads') {
      card.conditions.primary = null;
      logs.push(`${card.name} woke up.`);
    } else {
      logs.push(`${card.name} is still Asleep.`);
    }
  } else if (card.conditions.primary?.type === 'paralyzed') {
    card.conditions.primary.checkupsUntilClear -= 1;
    if (card.conditions.primary.checkupsUntilClear <= 0) {
      card.conditions.primary = null;
      logs.push(`${card.name} is no longer Paralyzed.`);
    } else {
      logs.push(`${card.name} is still Paralyzed.`);
    }
  }

  return { logs, koResult: null };
}

// `options.skipPeerId`: a player whose side currently has no Active Pokemon
// (they were just Knocked Out and haven't promoted a replacement yet) —
// Checkup only ever applies to a Pokemon actually in the Active Spot.
//
// If a Checkup KO happens, this returns immediately without processing the
// other player's Checkup this cycle (rare simultaneous-KO edge case — that
// player's Burn/Poison tick simply resumes at the next turn boundary once
// pendingChoice is resolved).
export function runCheckup(battle, options = {}) {
  const logs = [];
  for (const peerId of battle.players) {
    if (peerId === options.skipPeerId) continue;
    const { logs: cardLogs, koResult } = checkupOne(battle, peerId);
    logs.push(...cardLogs);
    if (koResult?.gameEnded) {
      return { logs, gameEnded: true, pendingChoice: null };
    }
    if (koResult?.pendingChoice) {
      return { logs, gameEnded: false, pendingChoice: koResult.pendingChoice };
    }
  }
  return { logs, gameEnded: false, pendingChoice: null };
}
