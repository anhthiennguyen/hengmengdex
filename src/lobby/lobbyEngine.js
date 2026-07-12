import Peer from 'peerjs';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { resolveRules, startTurn } from './effectEngine';
import { resolveKnockOut, resolveAttack } from './combatEngine';
import { runCheckup } from './pokemonCheckup';
import {
  buildMatch,
  checkPoolLegality,
  checkSelectionLegality,
  clampDeckSize,
  eligiblePool,
  MIN_DECK_BASICS,
  MIN_REQUIRED_DECK_SIZE,
} from './deckBuilder';
import { computeAutoEnergyLoadout } from './energyLoadout';
import { redactStateFor } from './battleRedaction';

// PeerJS's default cloud broker (0.peerjs.com) is shared across every app
// using the library, so peer IDs are namespaced to avoid colliding with
// unrelated PeerJS users picking the same short ID.
const PEER_PREFIX = 'hmd-';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids visual ambiguity

export function generateLobbyCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function fetchCardPool(dexId) {
  const snap = await getDocs(collection(db, 'dexes', dexId, 'meng'));
  return snap.docs.map((d) => {
    const data = d.data();
    const cardType = data.cardType || 'meng';
    return {
      id: d.id,
      cardType,
      name: data.name,
      description: data.description,
      imageUrl: data.imageUrl,
      rules: data.rules || [],
      ...(cardType === 'meng'
        ? {
            hp: data.hp,
            type: data.type || 'normal',
            stage: data.stage,
            evolvesFrom: data.evolvesFrom ?? null,
            weakness: data.weakness ?? null,
            resistance: data.resistance ?? null,
            retreatCost: data.retreatCost,
            attacks: data.attacks || [],
          }
        : { trainerType: data.trainerType }),
    };
  });
}

class LobbyEngine {
  constructor(role, lobbyCode, dexId, deckSize) {
    this.role = role; // 'host' | 'guest'
    this.lobbyCode = lobbyCode;
    this.dexId = dexId;
    // Only meaningful for the host — the exact deck size they chose when
    // creating the lobby, clamped against each Dex's actual pool size at
    // battle time (see clampDeckSize in deckBuilder.js).
    this.deckSize = deckSize;
    this.peer = null;
    this.myPeerId = null;
    this.hostConn = null; // guest only
    this.connections = new Map(); // host only: peerId -> DataConnection
    this.listeners = new Set();
    this.status = 'connecting'; // 'connecting' | 'open' | 'error'
    this.errorMessage = '';

    // Host-authoritative state. Guests hold a mirrored read-only copy that
    // arrives pre-redacted (from the host's point of view of them) — a
    // guest never has access to the raw, un-redacted state at all.
    this.state = { roster: [], battles: {}, lastAbortReason: null };
  }

  subscribe(cb) {
    this.listeners.add(cb);
    cb(this._snapshot());
    return () => this.listeners.delete(cb);
  }

  _snapshot() {
    // The host must view its own UI through the same redaction its
    // opponents get, or it would leak the opponent's hand/deck/prizes to
    // itself. Guests already receive pre-redacted state over the wire.
    const state = this.role === 'host' && this.myPeerId
      ? redactStateFor(this.state, this.myPeerId)
      : this.state;
    return {
      status: this.status,
      errorMessage: this.errorMessage,
      myPeerId: this.myPeerId,
      lobbyCode: this.lobbyCode,
      role: this.role,
      state,
    };
  }

  _notify() {
    const snap = this._snapshot();
    this.listeners.forEach((cb) => cb(snap));
  }

  _setStatus(status, errorMessage = '') {
    this.status = status;
    this.errorMessage = errorMessage;
    this._notify();
  }

  // ---- connection setup ----

  static createHost(lobbyCode, dexId, deckSize) {
    const engine = new LobbyEngine('host', lobbyCode, dexId, deckSize);
    const peer = new Peer(PEER_PREFIX + lobbyCode);
    engine.peer = peer;

    peer.on('open', (id) => {
      engine.myPeerId = id;
      engine._setStatus('open');
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        engine.connections.set(conn.peer, conn);
      });
      conn.on('data', (msg) => engine._applyIntent(conn.peer, msg));
      conn.on('close', () => {
        engine.connections.delete(conn.peer);
        engine._applyIntent(conn.peer, { type: 'leave' });
      });
    });

    peer.on('error', (err) => {
      engine._setStatus('error', humanizePeerError(err));
    });

    return engine;
  }

  static joinGuest(lobbyCode, dexId) {
    const engine = new LobbyEngine('guest', lobbyCode, dexId);
    const peer = new Peer();
    engine.peer = peer;

    peer.on('open', (id) => {
      engine.myPeerId = id;
      const conn = peer.connect(PEER_PREFIX + lobbyCode, { reliable: true });
      engine.hostConn = conn;

      conn.on('open', () => engine._setStatus('open'));
      conn.on('data', (msg) => {
        if (msg.type === 'state') {
          engine.state = msg.state;
          engine._notify();
        }
      });
      conn.on('close', () => engine._setStatus('error', 'Lost connection to the lobby host.'));
      conn.on('error', () => engine._setStatus('error', 'Could not connect to that lobby.'));
    });

    peer.on('error', (err) => {
      engine._setStatus('error', humanizePeerError(err));
    });

    return engine;
  }

  leave() {
    this.connections.forEach((conn) => conn.close());
    this.hostConn?.close();
    this.peer?.destroy();
    this.listeners.clear();
  }

  // ---- outbound actions (called by UI) ----

  send(intent) {
    if (this.role === 'host') {
      this._applyIntent(this.myPeerId, intent);
    } else {
      this.hostConn?.send(intent);
    }
  }

  setName(name) {
    this.send({ type: 'join', name });
  }

  requestBattle(targetPeerId) {
    this.send({ type: 'battle_request', target: targetPeerId });
  }

  respondBattle(battleId, accept) {
    this.send({ type: 'battle_response', battleId, accept });
  }

  submitDeck(battleId, selectedCardIds) {
    this.send({ type: 'submit_deck', battleId, selectedCardIds });
  }

  submitSetup(battleId, activeCardId, benchCardIds) {
    this.send({ type: 'submit_setup', battleId, activeCardId, benchCardIds });
  }

  benchBasic(battleId, cardId) {
    this.send({ type: 'bench_basic', battleId, cardId });
  }

  attachEnergy(battleId, energyType, targetInPlayCardId) {
    this.send({ type: 'attach_energy', battleId, energyType, targetInPlayCardId });
  }

  retreat(battleId, benchCardId, energyIdsToDiscard) {
    this.send({ type: 'retreat', battleId, benchCardId, energyIdsToDiscard });
  }

  evolve(battleId, evolutionCardId, targetInPlayCardId) {
    this.send({ type: 'evolve', battleId, evolutionCardId, targetInPlayCardId });
  }

  playItem(battleId, cardId) {
    this.send({ type: 'play_item', battleId, cardId });
  }

  playSupporter(battleId, cardId) {
    this.send({ type: 'play_supporter', battleId, cardId });
  }

  attack(battleId, attackId) {
    this.send({ type: 'attack', battleId, attackId });
  }

  passEndTurn(battleId) {
    this.send({ type: 'pass_end_turn', battleId });
  }

  chooseNewActive(battleId, benchCardId) {
    this.send({ type: 'choose_new_active', battleId, benchCardId });
  }

  // ---- host-authoritative reducer ----

  async _applyIntent(fromPeerId, intent) {
    if (this.role !== 'host') return;

    try {
      await this._applyIntentInner(fromPeerId, intent);
    } catch (err) {
      // A thrown exception here would otherwise vanish silently (no
      // broadcast, no log) — the intent would just look like it did
      // nothing. Surface it to the console so it's diagnosable.
      console.error(`Error applying intent "${intent.type}":`, err);
    }
  }

  async _applyIntentInner(fromPeerId, intent) {
    switch (intent.type) {
      case 'join': {
        const name = String(intent.name || '').trim().slice(0, 24) || 'Trainer';
        const existing = this.state.roster.find((p) => p.peerId === fromPeerId);
        if (existing) {
          existing.name = name;
        } else {
          this.state.roster.push({ peerId: fromPeerId, name });
        }
        this._broadcast();
        break;
      }

      case 'leave': {
        this.state.roster = this.state.roster.filter((p) => p.peerId !== fromPeerId);
        this._broadcast();
        break;
      }

      case 'battle_request': {
        const challenger = this.state.roster.find((p) => p.peerId === fromPeerId);
        const target = this.state.roster.find((p) => p.peerId === intent.target);
        if (!challenger || !target || challenger.peerId === target.peerId) return;

        const alreadyPending = Object.values(this.state.battles).some(
          (b) => b.phase === 'pending' && (b.players.includes(fromPeerId) || b.players.includes(intent.target))
        );
        if (alreadyPending) return;

        const battleId = `b-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        this.state.battles[battleId] = {
          battleId,
          phase: 'pending',
          players: [challenger.peerId, target.peerId],
          names: { [challenger.peerId]: challenger.name, [target.peerId]: target.name },
          challenger: challenger.peerId,
        };
        this.state.lastAbortReason = null;
        this._broadcast();
        break;
      }

      case 'battle_response': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'pending') return;
        if (!battle.players.includes(fromPeerId) || fromPeerId === battle.challenger) return;

        if (!intent.accept) {
          delete this.state.battles[intent.battleId];
          this._broadcast();
          return;
        }

        try {
          const pool = await fetchCardPool(this.dexId);
          const { legal, cards } = checkPoolLegality(pool);
          if (!legal) {
            delete this.state.battles[intent.battleId];
            this.state.lastAbortReason =
              `This Dex needs at least ${MIN_REQUIRED_DECK_SIZE} battle-ready cards (with attacks/stage set), including ${MIN_DECK_BASICS}+ Basic Pokemon, to build a deck.`;
            this._broadcast();
            return;
          }

          const requiredDeckSize = clampDeckSize(this.deckSize, cards.length);
          const [pA, pB] = battle.players;
          Object.assign(battle, {
            phase: 'deckbuild',
            cardPool: cards,
            requiredDeckSize,
            deckSelections: { [pA]: null, [pB]: null },
            deckReady: { [pA]: false, [pB]: false },
            log: [],
            winner: null,
          });
          this.state.lastAbortReason = null;
          this._broadcast();
        } catch (err) {
          console.error('Failed to start battle:', err);
          delete this.state.battles[intent.battleId];
          this.state.lastAbortReason = 'Something went wrong starting the battle. Please try again.';
          this._broadcast();
        }
        break;
      }

      case 'submit_deck': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'deckbuild' || !battle.players.includes(fromPeerId)) return;
        if (battle.deckReady[fromPeerId]) return;

        const requestedIds = Array.isArray(intent.selectedCardIds) ? [...new Set(intent.selectedCardIds)] : [];
        const selectedCards = requestedIds
          .map((id) => battle.cardPool.find((c) => c.id === id))
          .filter(Boolean);
        if (selectedCards.length !== requestedIds.length) return;
        if (!checkSelectionLegality(selectedCards, battle.requiredDeckSize)) return;

        battle.deckSelections[fromPeerId] = selectedCards;
        battle.deckReady[fromPeerId] = true;
        battle.log.push(`${battle.names[fromPeerId]} finished picking their deck.`);

        const [pA, pB] = battle.players;
        if (battle.deckReady[pA] && battle.deckReady[pB]) {
          const match = buildMatch(battle.deckSelections, battle.players, battle.requiredDeckSize);
          if (!match.legal) {
            // Shouldn't happen — both selections already passed
            // checkSelectionLegality individually — but guard defensively
            // rather than leave the battle stuck mid-transition.
            battle.deckReady[pA] = false;
            battle.deckReady[pB] = false;
            battle.log.push('Something went wrong building your decks — please pick again.');
            this._broadcast();
            break;
          }

          Object.assign(battle, {
            phase: 'setup',
            decks: match.decks,
            hands: match.hands,
            prizePiles: match.prizePiles,
            discard: match.discard,
            firstPlayer: match.firstPlayer,
            mulliganCounts: match.mulliganCounts,
            active: { [pA]: null, [pB]: null },
            bench: { [pA]: [], [pB]: [] },
            // Derived from each player's own full deck selection, not
            // chosen by them — every Pokemon type they picked comes with a
            // full Energy pool of that type automatically.
            energyPools: {
              [pA]: computeAutoEnergyLoadout(battle.deckSelections[pA]),
              [pB]: computeAutoEnergyLoadout(battle.deckSelections[pB]),
            },
            setupChoices: { [pA]: null, [pB]: null },
            setupReady: { [pA]: false, [pB]: false },
            pendingChoice: [],
            nextTurnPeerId: null,
            turnNumber: 0,
            turnCountByPlayer: { [pA]: 0, [pB]: 0 },
            energyAttachedThisTurn: { [pA]: false, [pB]: false },
            supporterUsedThisTurn: { [pA]: false, [pB]: false },
            retreatedThisTurn: { [pA]: false, [pB]: false },
          });
          delete battle.cardPool;
          delete battle.deckSelections;
          delete battle.deckReady;
          battle.log.push('Decks dealt! Choose your Active and Bench Pokemon.', ...match.log);
        }

        this._broadcast();
        break;
      }

      case 'submit_setup': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'setup' || !battle.players.includes(fromPeerId)) return;
        if (battle.setupReady[fromPeerId]) return;

        // Pickable from BOTH hand and deck (everything except the hidden
        // Prize pile) — the player already hand-picked their whole deck in
        // deckbuild, so Setup shouldn't re-hide most of it behind a small
        // random "hand" slice.
        const pickable = [...battle.hands[fromPeerId], ...battle.decks[fromPeerId]];
        const activeCard = pickable.find(
          (c) => c.id === intent.activeCardId && c.cardType === 'meng' && c.stage === 'basic'
        );
        if (!activeCard) return;

        const requestedBenchIds = Array.isArray(intent.benchCardIds) ? intent.benchCardIds.slice(0, 5) : [];
        const uniqueBenchIds = [...new Set(requestedBenchIds)].filter((id) => id !== activeCard.id);
        const benchCards = uniqueBenchIds
          .map((id) => pickable.find((c) => c.id === id && c.cardType === 'meng' && c.stage === 'basic'))
          .filter(Boolean);
        if (benchCards.length !== uniqueBenchIds.length) return;

        battle.setupChoices[fromPeerId] = {
          activeCardId: activeCard.id,
          benchCardIds: benchCards.map((c) => c.id),
        };
        battle.setupReady[fromPeerId] = true;
        battle.log.push(`${battle.names[fromPeerId]} is ready.`);

        const [pA, pB] = battle.players;
        if (battle.setupReady[pA] && battle.setupReady[pB]) {
          for (const peerId of battle.players) {
            const choice = battle.setupChoices[peerId];
            const pPickable = [...battle.hands[peerId], ...battle.decks[peerId]];
            const chosenActive = pPickable.find((c) => c.id === choice.activeCardId);
            const chosenBench = choice.benchCardIds.map((id) => pPickable.find((c) => c.id === id));
            const chosenIds = new Set([choice.activeCardId, ...choice.benchCardIds]);
            battle.hands[peerId] = battle.hands[peerId].filter((c) => !chosenIds.has(c.id));
            battle.decks[peerId] = battle.decks[peerId].filter((c) => !chosenIds.has(c.id));
            chosenActive.hasEnteredPlay = true;
            chosenActive.enteredPlayOnTurn = 0;
            chosenBench.forEach((c) => {
              c.hasEnteredPlay = true;
              c.enteredPlayOnTurn = 0;
            });
            battle.active[peerId] = chosenActive;
            battle.bench[peerId] = chosenBench;
          }

          battle.log.push('Both players are ready! Pokemon are revealed!');
          for (const peerId of battle.players) {
            const opponentId = battle.players.find((p) => p !== peerId);
            const opponentActive = battle.active[opponentId];
            const placed = [battle.active[peerId], ...battle.bench[peerId]];
            for (const card of placed) {
              battle.log.push(...resolveRules(card.rules, 'on_enter', card, card.id, opponentActive));
            }
          }
          delete battle.setupChoices;
          battle.phase = 'battle';

          const { logs: startLogs } = startTurn(battle, battle.firstPlayer);
          battle.log.push(...startLogs);
        }

        this._broadcast();
        break;
      }

      case 'bench_basic': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'battle' || battle.turn !== fromPeerId || battle.pendingChoice.length) return;

        const hand = battle.hands[fromPeerId];
        const idx = hand.findIndex((c) => c.id === intent.cardId && c.cardType === 'meng' && c.stage === 'basic');
        if (idx === -1 || battle.bench[fromPeerId].length >= 5) return;

        const [card] = hand.splice(idx, 1);
        card.hasEnteredPlay = true;
        card.enteredPlayOnTurn = battle.turnNumber;
        battle.bench[fromPeerId].push(card);

        const opponentId = battle.players.find((p) => p !== fromPeerId);
        battle.log.push(...resolveRules(card.rules, 'on_enter', card, card.id, battle.active[opponentId]));
        this._broadcast();
        break;
      }

      case 'attach_energy': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'battle' || battle.turn !== fromPeerId || battle.pendingChoice.length) return;
        if (battle.energyAttachedThisTurn[fromPeerId]) return;

        const pool = battle.energyPools[fromPeerId];
        const energyType = intent.energyType;
        if (!pool || !(pool[energyType] > 0)) return;

        const target =
          battle.active[fromPeerId]?.id === intent.targetInPlayCardId
            ? battle.active[fromPeerId]
            : battle.bench[fromPeerId].find((c) => c.id === intent.targetInPlayCardId);
        if (!target) return;

        pool[energyType] -= 1;
        const energyId = `energy-${energyType}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
        target.attachedEnergy.push({ id: energyId, energyType });
        battle.energyAttachedThisTurn[fromPeerId] = true;
        battle.log.push(`${battle.names[fromPeerId]} attached ${energyType} Energy to ${target.name}.`);
        this._broadcast();
        break;
      }

      case 'retreat': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'battle' || battle.turn !== fromPeerId || battle.pendingChoice.length) return;
        if (battle.retreatedThisTurn[fromPeerId]) return;

        const active = battle.active[fromPeerId];
        if (!active) return;
        const primaryType = active.conditions?.primary?.type;
        if (primaryType === 'asleep' || primaryType === 'paralyzed') return;

        const benchIdx = battle.bench[fromPeerId].findIndex((c) => c.id === intent.benchCardId);
        if (benchIdx === -1) return;

        const energyIds = Array.isArray(intent.energyIdsToDiscard) ? intent.energyIdsToDiscard : [];
        if (energyIds.length !== active.retreatCost) return;
        const uniqueIds = new Set(energyIds);
        if (uniqueIds.size !== energyIds.length) return;
        const attachedIds = new Set(active.attachedEnergy.map((e) => e.id));
        if (![...uniqueIds].every((id) => attachedIds.has(id))) return;

        const discardedEnergy = active.attachedEnergy.filter((e) => uniqueIds.has(e.id));
        active.attachedEnergy = active.attachedEnergy.filter((e) => !uniqueIds.has(e.id));
        battle.discard[fromPeerId].push(...discardedEnergy);

        const [newActive] = battle.bench[fromPeerId].splice(benchIdx, 1);
        active.conditions = { primary: null, burned: null, poisoned: null };
        battle.bench[fromPeerId].push(active);
        battle.active[fromPeerId] = newActive;

        battle.retreatedThisTurn[fromPeerId] = true;
        battle.log.push(`${battle.names[fromPeerId]} retreated ${active.name} for ${newActive.name}.`);
        this._broadcast();
        break;
      }

      case 'evolve': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'battle' || battle.turn !== fromPeerId || battle.pendingChoice.length) return;

        const hand = battle.hands[fromPeerId];
        const evoIdx = hand.findIndex((c) => c.id === intent.evolutionCardId && c.cardType === 'meng');
        if (evoIdx === -1) return;
        const evolutionCard = hand[evoIdx];

        const target =
          battle.active[fromPeerId]?.id === intent.targetInPlayCardId
            ? battle.active[fromPeerId]
            : battle.bench[fromPeerId].find((c) => c.id === intent.targetInPlayCardId);
        if (!target) return;
        if (evolutionCard.evolvesFrom !== target.id) return;
        if (target.enteredPlayOnTurn === battle.turnNumber) return;
        if (battle.turnCountByPlayer[fromPeerId] === 1) return;

        hand.splice(evoIdx, 1);
        const damageTaken = target.maxHp - target.currentHp;
        Object.assign(target, {
          id: evolutionCard.id,
          name: evolutionCard.name,
          description: evolutionCard.description,
          imageUrl: evolutionCard.imageUrl,
          type: evolutionCard.type,
          stage: evolutionCard.stage,
          evolvesFrom: evolutionCard.evolvesFrom,
          weakness: evolutionCard.weakness,
          resistance: evolutionCard.resistance,
          retreatCost: evolutionCard.retreatCost,
          attacks: evolutionCard.attacks,
          rules: evolutionCard.rules,
          maxHp: evolutionCard.hp,
        });
        target.currentHp = Math.max(0, target.maxHp - damageTaken);
        target.conditions = { primary: null, burned: null, poisoned: null };
        target.enteredPlayOnTurn = battle.turnNumber;
        target.evolutionChainCardIds = [...(target.evolutionChainCardIds || []), evolutionCard.id];

        battle.log.push(`${battle.names[fromPeerId]}'s Pokemon evolved into ${target.name}!`);

        if (target.currentHp <= 0) {
          const koResult = resolveKnockOut(battle, fromPeerId, target, null);
          battle.log.push(...koResult.logs);
        }

        this._broadcast();
        break;
      }

      case 'play_item': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'battle' || battle.turn !== fromPeerId || battle.pendingChoice.length) return;

        const hand = battle.hands[fromPeerId];
        const idx = hand.findIndex(
          (c) => c.id === intent.cardId && c.cardType === 'trainer' && c.trainerType === 'item'
        );
        if (idx === -1) return;

        const [playedCard] = hand.splice(idx, 1);
        battle.discard[fromPeerId].push({ ...playedCard, imageUrl: null });

        const activeCard = battle.active[fromPeerId];
        battle.log.push(`${battle.names[fromPeerId]} played ${playedCard.name}.`);
        if (activeCard) {
          battle.log.push(...resolveRules(playedCard.rules, 'on_play', activeCard, playedCard.id));
        }
        this._broadcast();
        break;
      }

      case 'play_supporter': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'battle' || battle.turn !== fromPeerId || battle.pendingChoice.length) return;
        if (battle.supporterUsedThisTurn[fromPeerId] || battle.turnNumber === 1) return;

        const hand = battle.hands[fromPeerId];
        const idx = hand.findIndex(
          (c) => c.id === intent.cardId && c.cardType === 'trainer' && c.trainerType === 'supporter'
        );
        if (idx === -1) return;

        const [playedCard] = hand.splice(idx, 1);
        battle.discard[fromPeerId].push({ ...playedCard, imageUrl: null });
        battle.supporterUsedThisTurn[fromPeerId] = true;

        const activeCard = battle.active[fromPeerId];
        battle.log.push(`${battle.names[fromPeerId]} played ${playedCard.name}.`);
        if (activeCard) {
          battle.log.push(...resolveRules(playedCard.rules, 'on_play', activeCard, playedCard.id));
        }
        this._broadcast();
        break;
      }

      case 'attack': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'battle' || battle.turn !== fromPeerId || battle.pendingChoice.length) return;

        const result = resolveAttack(battle, fromPeerId, intent.attackId);
        if (!result.legal) return;
        battle.log.push(...result.logs);

        if (result.koResult?.gameEnded) {
          this._broadcast();
          break;
        }

        if (result.koResult?.pendingChoice) {
          battle.nextTurnPeerId = result.defenderId;
          const checkup = runCheckup(battle, { skipPeerId: result.koResult.pendingChoice });
          battle.log.push(...checkup.logs);
          this._broadcast();
          break;
        }

        const checkup = runCheckup(battle, {});
        battle.log.push(...checkup.logs);
        if (checkup.gameEnded) {
          this._broadcast();
          break;
        }
        if (checkup.pendingChoice) {
          battle.nextTurnPeerId = result.defenderId;
          this._broadcast();
          break;
        }

        const { logs: startLogs } = startTurn(battle, result.defenderId);
        battle.log.push(...startLogs);
        this._broadcast();
        break;
      }

      case 'pass_end_turn': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'battle' || battle.turn !== fromPeerId || battle.pendingChoice.length) return;

        const otherId = battle.players.find((p) => p !== fromPeerId);
        battle.log.push(`${battle.names[fromPeerId]} passed.`);

        const checkup = runCheckup(battle, {});
        battle.log.push(...checkup.logs);
        if (checkup.gameEnded) {
          this._broadcast();
          break;
        }
        if (checkup.pendingChoice) {
          battle.nextTurnPeerId = otherId;
          this._broadcast();
          break;
        }

        const { logs: startLogs } = startTurn(battle, otherId);
        battle.log.push(...startLogs);
        this._broadcast();
        break;
      }

      case 'choose_new_active': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'battle' || !battle.pendingChoice.includes(fromPeerId)) return;

        const benchIdx = battle.bench[fromPeerId].findIndex((c) => c.id === intent.benchCardId);
        if (benchIdx === -1) return;

        const [promoted] = battle.bench[fromPeerId].splice(benchIdx, 1);
        battle.active[fromPeerId] = promoted;
        battle.pendingChoice = battle.pendingChoice.filter((p) => p !== fromPeerId);
        battle.log.push(`${battle.names[fromPeerId]} sent out ${promoted.name}.`);

        if (battle.pendingChoice.length === 0 && battle.nextTurnPeerId) {
          const nextId = battle.nextTurnPeerId;
          battle.nextTurnPeerId = null;
          const { logs: startLogs } = startTurn(battle, nextId);
          battle.log.push(...startLogs);
        }

        this._broadcast();
        break;
      }

      case 'battle_ack': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'finished') return;
        delete this.state.battles[intent.battleId];
        this._broadcast();
        break;
      }

      default:
        break;
    }
  }

  _broadcast() {
    this.connections.forEach((conn) => {
      conn.send({ type: 'state', state: clone(redactStateFor(this.state, conn.peer)) });
    });
    this._notify();
  }
}

function humanizePeerError(err) {
  switch (err?.type) {
    case 'unavailable-id':
      return 'That lobby code is already in use. Try creating a new one.';
    case 'peer-unavailable':
      return "That lobby doesn't exist or has ended.";
    case 'network':
      return 'Network error connecting to the lobby.';
    case 'browser-incompatible':
      return "Your browser doesn't support the tech needed for lobbies.";
    default:
      return err?.message || 'Something went wrong connecting to the lobby.';
  }
}

export default LobbyEngine;
