import Peer from 'peerjs';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { resolveRules, startTurn } from './effectEngine';

// PeerJS's default cloud broker (0.peerjs.com) is shared across every app
// using the library, so peer IDs are namespaced to avoid colliding with
// unrelated PeerJS users picking the same short ID.
const PEER_PREFIX = 'hmd-';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids visual ambiguity
const DECK_SIZE = 5;

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
      ...(cardType === 'meng' ? { hp: data.hp, attack: data.attack, type: data.type || 'normal' } : {}),
    };
  });
}

class LobbyEngine {
  constructor(role, lobbyCode, dexId) {
    this.role = role; // 'host' | 'guest'
    this.lobbyCode = lobbyCode;
    this.dexId = dexId;
    this.peer = null;
    this.myPeerId = null;
    this.hostConn = null; // guest only
    this.connections = new Map(); // host only: peerId -> DataConnection
    this.listeners = new Set();
    this.status = 'connecting'; // 'connecting' | 'open' | 'error'
    this.errorMessage = '';

    // Host-authoritative state. Guests hold a mirrored read-only copy.
    this.state = { roster: [], battles: {} };
  }

  subscribe(cb) {
    this.listeners.add(cb);
    cb(this._snapshot());
    return () => this.listeners.delete(cb);
  }

  _snapshot() {
    return {
      status: this.status,
      errorMessage: this.errorMessage,
      myPeerId: this.myPeerId,
      lobbyCode: this.lobbyCode,
      role: this.role,
      state: this.state,
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

  static createHost(lobbyCode, dexId) {
    const engine = new LobbyEngine('host', lobbyCode, dexId);
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

  draftPick(battleId, cardId) {
    this.send({ type: 'draft_pick', battleId, cardId });
  }

  swapCard(battleId, cardId) {
    this.send({ type: 'swap_pick', battleId, cardId });
  }

  attack(battleId) {
    this.send({ type: 'attack', battleId });
  }

  playTrainer(battleId, cardId) {
    this.send({ type: 'play_trainer', battleId, cardId });
  }

  endTurn(battleId) {
    this.send({ type: 'end_turn', battleId });
  }

  // ---- host-authoritative reducer ----

  async _applyIntent(fromPeerId, intent) {
    if (this.role !== 'host') return;

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
          if (pool.length < 2) {
            delete this.state.battles[intent.battleId];
            this._broadcast();
            return;
          }
          const shuffled = [...pool].sort(() => Math.random() - 0.5);
          const firstPicker = Math.random() < 0.5 ? battle.players[0] : battle.players[1];

          Object.assign(battle, {
            phase: 'draft',
            pool: shuffled,
            deckSize: Math.min(DECK_SIZE, Math.floor(shuffled.length / 2)),
            teams: { [battle.players[0]]: [], [battle.players[1]]: [] },
            firstPicker,
            draftTurn: firstPicker,
          });
          this._broadcast();
        } catch {
          delete this.state.battles[intent.battleId];
          this._broadcast();
        }
        break;
      }

      case 'draft_pick': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'draft' || battle.draftTurn !== fromPeerId) return;

        const cardIdx = battle.pool.findIndex((c) => c.id === intent.cardId);
        if (cardIdx === -1) return;

        const [card] = battle.pool.splice(cardIdx, 1);
        const drafted =
          card.cardType === 'meng'
            ? { ...card, maxHp: card.hp, currentHp: card.hp, alive: true, statuses: [] }
            : { ...card, played: false };
        battle.teams[fromPeerId].push(drafted);

        const [pA, pB] = battle.players;
        const done =
          battle.teams[pA].length >= battle.deckSize && battle.teams[pB].length >= battle.deckSize;

        if (done || battle.pool.length === 0) {
          const firstMeng = (team) => team.findIndex((c) => c.cardType === 'meng' && c.alive);
          const idxA = firstMeng(battle.teams[pA]);
          const idxB = firstMeng(battle.teams[pB]);

          battle.trainerUsed = { [pA]: false, [pB]: false };
          battle.log = ['The battle begins!'];

          if (idxA === -1 || idxB === -1) {
            battle.phase = 'finished';
            if (idxA === -1 && idxB === -1) {
              battle.winner = null;
              battle.log.push("Neither team drafted a battle-ready Pokemon — it's a draw.");
            } else {
              battle.winner = idxA === -1 ? pB : pA;
              battle.log.push(`${battle.names[battle.winner]} wins — the opponent has no battle-ready Pokemon!`);
            }
            this._broadcast();
            break;
          }

          battle.active = { [pA]: idxA, [pB]: idxB };
          const startCardA = battle.teams[pA][idxA];
          const startCardB = battle.teams[pB][idxB];
          battle.log.push(...resolveRules(startCardA.rules, 'on_enter', startCardA, startCardA.id));
          battle.log.push(...resolveRules(startCardB.rules, 'on_enter', startCardB, startCardB.id));
          battle.log.push(...startTurn(battle, battle.firstPicker));
        } else {
          battle.draftTurn = battle.draftTurn === pA ? pB : pA;
        }
        this._broadcast();
        break;
      }

      case 'swap_pick': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'battle' || battle.swapNeeded !== fromPeerId) return;

        const team = battle.teams[fromPeerId];
        const idx = team.findIndex((c) => c.id === intent.cardId && c.alive && c.cardType === 'meng');
        if (idx === -1) return;

        battle.active[fromPeerId] = idx;
        delete battle.swapNeeded;
        const swappedInCard = team[idx];
        battle.log.push(...resolveRules(swappedInCard.rules, 'on_enter', swappedInCard, swappedInCard.id));
        this._broadcast();
        break;
      }

      case 'attack': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'battle' || battle.turn !== fromPeerId || battle.swapNeeded) return;

        const [pA, pB] = battle.players;
        const defenderId = fromPeerId === pA ? pB : pA;
        const attackerCard = battle.teams[fromPeerId][battle.active[fromPeerId]];
        const defenderCard = battle.teams[defenderId][battle.active[defenderId]];
        if (!attackerCard || !defenderCard) return;

        battle.log.push(...resolveRules(attackerCard.rules, 'on_attack', attackerCard, attackerCard.id));

        defenderCard.currentHp = Math.max(0, defenderCard.currentHp - attackerCard.attack);
        battle.log.push(`${attackerCard.name} hit ${defenderCard.name} for ${attackerCard.attack}.`);

        battle.log.push(...resolveRules(defenderCard.rules, 'on_hit', defenderCard, defenderCard.id));

        if (defenderCard.currentHp === 0) {
          defenderCard.alive = false;
          battle.log.push(`${defenderCard.name} fainted!`);
          const defenderTeamAlive = battle.teams[defenderId].some((c) => c.cardType === 'meng' && c.alive);
          if (!defenderTeamAlive) {
            battle.phase = 'finished';
            battle.winner = fromPeerId;
            battle.log.push(`${battle.names[fromPeerId]} wins!`);
            this._broadcast();
            break;
          }
          battle.swapNeeded = defenderId;
          // Don't fire on_turn_start/decay yet — the defender's active card
          // just fainted, so there's no living card to apply those to. Turn
          // is still handed to them; swap_pick's on_enter trigger covers the
          // newly active card once they choose one. Per-turn allowances
          // still reset, though, since it's a new turn for them either way.
          battle.turn = defenderId;
          if (battle.trainerUsed) battle.trainerUsed[defenderId] = false;
        } else {
          battle.log.push(...startTurn(battle, defenderId));
        }
        this._broadcast();
        break;
      }

      case 'play_trainer': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'battle' || battle.turn !== fromPeerId || battle.swapNeeded) return;
        if (battle.trainerUsed[fromPeerId]) return;

        const team = battle.teams[fromPeerId];
        const cardIdx = team.findIndex(
          (c) => c.id === intent.cardId && c.cardType === 'trainer' && !c.played
        );
        if (cardIdx === -1) return;

        const activeCard = team[battle.active[fromPeerId]];
        if (!activeCard) return;

        const playedCard = team[cardIdx];
        playedCard.played = true;
        battle.trainerUsed[fromPeerId] = true;

        battle.log.push(`${battle.names[fromPeerId]} played ${playedCard.name}.`);
        battle.log.push(...resolveRules(playedCard.rules, 'on_play', activeCard, playedCard.id));
        this._broadcast();
        break;
      }

      case 'end_turn': {
        const battle = this.state.battles[intent.battleId];
        if (!battle || battle.phase !== 'battle' || battle.turn !== fromPeerId || battle.swapNeeded) return;

        const [pA, pB] = battle.players;
        const otherId = fromPeerId === pA ? pB : pA;
        battle.log.push(`${battle.names[fromPeerId]} ends their turn.`);
        battle.log.push(...startTurn(battle, otherId));
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
    const payload = { type: 'state', state: clone(this.state) };
    this.connections.forEach((conn) => conn.send(payload));
    this._notify();
  }
}

function humanizePeerError(err) {
  switch (err?.type) {
    case 'unavailable-id':
      return 'That lobby code is already in use — try creating a new one.';
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
