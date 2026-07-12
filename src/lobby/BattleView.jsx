import { useEffect, useState } from 'react';
import { Loader2, Trophy, Flag, Layers, Zap, ArrowLeftRight, Sparkles as SparklesIcon } from 'lucide-react';
import MengCardTile from './MengCardTile';
import ActivePokemonPanel from './ActivePokemonPanel';
import DeckBuildPhase from './DeckBuildPhase';
import SetupPhase from './SetupPhase';

function zoneCount(zone) {
  return Array.isArray(zone) ? zone.length : zone?.count ?? 0;
}

export default function BattleView({ battle, myPeerId, engine, onClose }) {
  const opponentId = battle.players.find((p) => p !== myPeerId);
  const myName = battle.names[myPeerId];
  const opponentName = battle.names[opponentId];

  const [mode, setMode] = useState(null); // null | 'bench' | 'attach' | 'retreat' | 'evolve'
  const [attachEnergyCardId, setAttachEnergyCardId] = useState(null);
  const [retreatBenchId, setRetreatBenchId] = useState(null);
  const [retreatEnergyIds, setRetreatEnergyIds] = useState([]);

  function changeMode(next) {
    setMode((current) => (current === next ? null : next));
    setAttachEnergyCardId(null);
    setRetreatBenchId(null);
    setRetreatEnergyIds([]);
  }

  useEffect(() => {
    setMode(null);
    setAttachEnergyCardId(null);
    setRetreatBenchId(null);
    setRetreatEnergyIds([]);
  }, [battle.turn, battle.phase]);

  if (battle.phase === 'pending') {
    const iAmChallenger = battle.challenger === myPeerId;
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Loader2 className="animate-spin text-[var(--dex-accent-500)]" size={28} />
        <p className="text-sm font-semibold text-zinc-700">
          {iAmChallenger
            ? `Waiting for ${opponentName} to accept…`
            : `${myName}, respond to the challenge from the lobby screen.`}
        </p>
      </div>
    );
  }

  if (battle.phase === 'deckbuild') {
    return (
      <PhaseCard>
        <DeckBuildPhase battle={battle} myPeerId={myPeerId} opponentName={opponentName} engine={engine} />
      </PhaseCard>
    );
  }

  if (battle.phase === 'setup') {
    return (
      <PhaseCard>
        <SetupPhase battle={battle} myPeerId={myPeerId} opponentName={opponentName} engine={engine} />
      </PhaseCard>
    );
  }

  if (battle.phase === 'battle') {
    const pendingChoice = battle.pendingChoice || [];
    const myTurn = battle.turn === myPeerId && pendingChoice.length === 0;
    const myPendingChoice = pendingChoice.includes(myPeerId);
    const opponentPendingChoice = pendingChoice.includes(opponentId);

    const myActive = battle.active[myPeerId];
    const myBench = battle.bench[myPeerId] || [];
    const oppActive = battle.active[opponentId];
    const oppBench = battle.bench[opponentId] || [];
    const myHand = battle.hands[myPeerId] || [];

    if (myPendingChoice) {
      return (
        <PhaseCard>
          <h2 className="text-center text-lg font-bold text-zinc-900">Choose Your Next Pokemon!</h2>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {myBench.map((card) => (
              <MengCardTile
                key={card.id}
                card={card}
                showHp
                onClick={() => engine.chooseNewActive(battle.battleId, card.id)}
              />
            ))}
          </div>
          <LogPanel log={battle.log} />
        </PhaseCard>
      );
    }

    const myBasics = myHand.filter((c) => c.cardType === 'meng' && c.stage === 'basic');
    const myEnergyCards = myHand.filter((c) => c.cardType === 'energy');
    const myItems = myHand.filter((c) => c.cardType === 'trainer' && c.trainerType === 'item');
    const mySupporters = myHand.filter((c) => c.cardType === 'trainer' && c.trainerType === 'supporter');
    const myEvolutions = myHand.filter((c) => c.cardType === 'meng' && c.stage !== 'basic');

    function evolutionTarget(evoCard) {
      const candidates = [myActive, ...myBench].filter(Boolean);
      return candidates.find(
        (c) =>
          c.id === evoCard.evolvesFrom &&
          c.enteredPlayOnTurn !== battle.turnNumber &&
          battle.turnCountByPlayer[myPeerId] !== 1
      );
    }

    const energyAttached = !!battle.energyAttachedThisTurn?.[myPeerId];
    const hasRetreated = !!battle.retreatedThisTurn?.[myPeerId];
    const supporterUsed = !!battle.supporterUsedThisTurn?.[myPeerId];
    const activeConditionBlocksRetreat = ['asleep', 'paralyzed'].includes(myActive?.conditions?.primary?.type);
    const canPlaySupporter = !supporterUsed && battle.turnNumber !== 1;

    function attachTarget(target) {
      if (!attachEnergyCardId) return;
      engine.attachEnergy(battle.battleId, attachEnergyCardId, target.id);
      changeMode(null);
    }

    function confirmRetreat() {
      if (!retreatBenchId) return;
      if (retreatEnergyIds.length !== (myActive?.retreatCost ?? 0)) return;
      engine.retreat(battle.battleId, retreatBenchId, retreatEnergyIds);
      changeMode(null);
    }

    function selectRetreatTarget(card) {
      if ((myActive?.retreatCost ?? 0) === 0) {
        engine.retreat(battle.battleId, card.id, []);
        changeMode(null);
        return;
      }
      setRetreatBenchId(card.id);
    }

    return (
      <PhaseCard>
        <h2 className="text-center text-lg font-bold text-zinc-900">Battle!</h2>

        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-zinc-500">
          <span>
            {opponentName}: Prizes {zoneCount(battle.prizePiles[opponentId])} · Deck{' '}
            {zoneCount(battle.decks[opponentId])} · Hand {zoneCount(battle.hands[opponentId])}
          </span>
          <span>
            {myName}: Prizes {zoneCount(battle.prizePiles[myPeerId])} · Deck {zoneCount(battle.decks[myPeerId])} ·
            Energy in hand {myEnergyCards.length}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4">
          <ActivePokemonPanel card={oppActive} label={opponentName} canAttack={false} />
          <ActivePokemonPanel
            card={myActive}
            label={`${myName} (you)`}
            canAttack={myTurn}
            isFirstTurn={battle.turnNumber === 1}
            onAttack={(attackId) => engine.attack(battle.battleId, attackId)}
          />
        </div>

        {(oppBench.length > 0 || myBench.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <BenchRow cards={oppBench} />
            <BenchRow
              cards={myBench}
              onSelect={mode === 'attach' && attachEnergyCardId ? attachTarget : undefined}
              highlightId={retreatBenchId}
              onSelectRetreat={mode === 'retreat' && !retreatBenchId ? selectRetreatTarget : undefined}
            />
          </div>
        )}

        {opponentPendingChoice && (
          <p className="mt-3 text-center text-xs font-semibold text-amber-600">
            {opponentName} is choosing their next Pokemon…
          </p>
        )}

        {myTurn && (
          <div className="mt-4">
            <div className="flex flex-wrap justify-center gap-2">
              <ActionButton
                icon={<Layers size={14} />}
                label="Bench a Basic"
                active={mode === 'bench'}
                disabled={myBasics.length === 0 || myBench.length >= 5}
                onClick={() => changeMode('bench')}
              />
              <ActionButton
                icon={<Zap size={14} />}
                label="Attach Energy"
                active={mode === 'attach'}
                disabled={myEnergyCards.length === 0 || energyAttached}
                onClick={() => changeMode('attach')}
              />
              <ActionButton
                icon={<ArrowLeftRight size={14} />}
                label="Retreat"
                active={mode === 'retreat'}
                disabled={myBench.length === 0 || hasRetreated || activeConditionBlocksRetreat || !myActive}
                onClick={() => changeMode('retreat')}
              />
              <ActionButton
                icon={<SparklesIcon size={14} />}
                label="Evolve"
                active={mode === 'evolve'}
                disabled={myEvolutions.length === 0}
                onClick={() => changeMode('evolve')}
              />
            </div>

            {mode === 'bench' && (
              <SubPanel title="Choose a Basic to bench">
                <TileGrid
                  cards={myBasics}
                  onSelect={(card) => {
                    engine.benchBasic(battle.battleId, card.id);
                    changeMode(null);
                  }}
                />
              </SubPanel>
            )}

            {mode === 'attach' && !attachEnergyCardId && (
              <SubPanel title="Choose an Energy card from your hand">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {myEnergyCards.map((card) => (
                    <MengCardTile key={card.id} card={card} onClick={() => setAttachEnergyCardId(card.id)} />
                  ))}
                </div>
              </SubPanel>
            )}
            {mode === 'attach' && attachEnergyCardId && (
              <SubPanel title="Choose a Pokemon to attach it to">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {[myActive, ...myBench].filter(Boolean).map((card) => (
                    <MengCardTile key={card.id} card={card} showHp onClick={() => attachTarget(card)} />
                  ))}
                </div>
              </SubPanel>
            )}

            {mode === 'retreat' && (
              <SubPanel
                title={
                  !retreatBenchId
                    ? 'Choose your new Active Pokemon'
                    : `Discard ${myActive.retreatCost} Energy to retreat`
                }
              >
                {!retreatBenchId ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                    {myBench.map((card) => (
                      <MengCardTile key={card.id} card={card} showHp onClick={() => selectRetreatTarget(card)} />
                    ))}
                  </div>
                ) : (
                  <>
                    {myActive.retreatCost > 0 && (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {myActive.attachedEnergy.map((e) => {
                            const chosen = retreatEnergyIds.includes(e.id);
                            return (
                              <button
                                key={e.id}
                                type="button"
                                onClick={() =>
                                  setRetreatEnergyIds((ids) =>
                                    chosen ? ids.filter((id) => id !== e.id) : [...ids, e.id]
                                  )
                                }
                                className={`rounded-full border px-2 py-1 text-[11px] font-bold ${
                                  chosen
                                    ? 'border-[var(--dex-accent-500)] bg-[var(--dex-accent-50)]'
                                    : 'border-zinc-300'
                                }`}
                              >
                                {e.energyType}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          disabled={retreatEnergyIds.length !== myActive.retreatCost}
                          onClick={confirmRetreat}
                          className="mt-2 rounded-lg bg-[var(--dex-accent-600)] px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Confirm Retreat
                        </button>
                      </>
                    )}
                  </>
                )}
              </SubPanel>
            )}

            {mode === 'evolve' && (
              <SubPanel title="Choose an evolution card">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {myEvolutions.map((card) => {
                    const target = evolutionTarget(card);
                    return (
                      <MengCardTile
                        key={card.id}
                        card={card}
                        disabled={!target}
                        onClick={
                          target
                            ? () => {
                                engine.evolve(battle.battleId, card.id, target.id);
                                changeMode(null);
                              }
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              </SubPanel>
            )}

            {(myItems.length > 0 || mySupporters.length > 0) && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-bold text-zinc-500">Your Trainer cards</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {myItems.map((card) => (
                    <MengCardTile
                      key={card.id}
                      card={card}
                      onClick={() => engine.playItem(battle.battleId, card.id)}
                    />
                  ))}
                  {mySupporters.map((card) => (
                    <MengCardTile
                      key={card.id}
                      card={card}
                      disabled={!canPlaySupporter}
                      onClick={canPlaySupporter ? () => engine.playSupporter(battle.battleId, card.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mx-auto mt-4 flex items-center justify-center">
              <button
                type="button"
                onClick={() => engine.passEndTurn(battle.battleId)}
                className="flex items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
              >
                <Flag size={15} />
                Pass / End Turn
              </button>
            </div>
          </div>
        )}

        {!myTurn && !myPendingChoice && !opponentPendingChoice && (
          <p className="mt-4 text-center text-xs font-semibold text-zinc-400">Waiting for {opponentName}…</p>
        )}

        <LogPanel log={battle.log} />
      </PhaseCard>
    );
  }

  if (battle.phase === 'finished') {
    const isDraw = battle.winner === null || battle.winner === undefined;
    const iWon = battle.winner === myPeerId;
    return (
      <PhaseCard>
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Trophy className="text-[var(--dex-accent-500)]" size={32} />
          <h2 className="text-lg font-bold text-zinc-900">
            {isDraw ? "It's a draw!" : iWon ? 'You won!' : `${battle.names[battle.winner]} wins!`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 rounded-lg bg-[var(--dex-accent-600)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--dex-accent-700)]"
          >
            Back to Lobby
          </button>
        </div>
      </PhaseCard>
    );
  }

  return null;
}

// Plain content wrapper for each battle phase — LobbyPage.jsx renders this
// inside its own full-page Shell, so this no longer needs to be a modal.
function PhaseCard({ children }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">{children}</div>;
}

function LogPanel({ log }) {
  return (
    <div className="mt-5 max-h-32 overflow-y-auto rounded-lg bg-zinc-50 p-2 text-xs text-zinc-600">
      {(log || []).slice(-12).map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

function BenchRow({ cards, onSelect, onSelectRetreat, highlightId }) {
  if (cards.length === 0) return <div />;
  return (
    <div className="flex flex-wrap gap-1.5">
      {cards.map((card) => (
        <div key={card.id} className="w-16">
          <MengCardTile
            card={card}
            showHp
            selected={card.id === highlightId}
            onClick={onSelectRetreat ? () => onSelectRetreat(card) : onSelect ? () => onSelect(card) : undefined}
          />
        </div>
      ))}
    </div>
  );
}

function TileGrid({ cards, onSelect }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {cards.map((card) => (
        <MengCardTile key={card.id} card={card} onClick={() => onSelect(card)} />
      ))}
    </div>
  );
}

function SubPanel({ title, children }) {
  return (
    <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <p className="mb-2 text-xs font-bold text-zinc-600">{title}</p>
      {children}
    </div>
  );
}

function ActionButton({ icon, label, active, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-[var(--dex-accent-500)] bg-[var(--dex-accent-50)] text-[var(--dex-accent-700)]'
          : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
