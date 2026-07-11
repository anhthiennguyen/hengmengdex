import { Loader2, Swords, Trophy, Flag } from 'lucide-react';
import MengCardTile from './MengCardTile';

export default function BattleView({ battle, myPeerId, engine, onClose }) {
  const opponentId = battle.players.find((p) => p !== myPeerId);
  const myName = battle.names[myPeerId];
  const opponentName = battle.names[opponentId];

  if (battle.phase === 'pending') {
    const iAmChallenger = battle.challenger === myPeerId;
    return (
      <Overlay>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Loader2 className="animate-spin text-[var(--dex-accent-500)]" size={28} />
          <p className="text-sm font-semibold text-zinc-700">
            {iAmChallenger
              ? `Waiting for ${opponentName} to accept…`
              : `${myName} — respond to the challenge from the lobby screen.`}
          </p>
        </div>
      </Overlay>
    );
  }

  if (battle.phase === 'draft') {
    const myTurn = battle.draftTurn === myPeerId;
    return (
      <Overlay>
        <h2 className="text-center text-lg font-bold text-zinc-900">Draft Your Team</h2>
        <p className="mt-1 text-center text-xs text-zinc-500">
          {myTurn ? "Your pick — choose a Meng." : `Waiting for ${opponentName} to pick…`}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-semibold text-zinc-600">
          <div>
            {myName}'s team ({battle.teams[myPeerId].length}/{battle.deckSize})
          </div>
          <div className="text-right">
            {opponentName}'s team ({battle.teams[opponentId].length}/{battle.deckSize})
          </div>
        </div>

        <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50 p-2">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {battle.pool.map((card) => (
              <MengCardTile
                key={card.id}
                card={card}
                disabled={!myTurn}
                onClick={myTurn ? () => engine.draftPick(battle.battleId, card.id) : undefined}
              />
            ))}
          </div>
        </div>
      </Overlay>
    );
  }

  if (battle.phase === 'battle') {
    const myCard = battle.teams[myPeerId][battle.active[myPeerId]];
    const oppCard = battle.teams[opponentId][battle.active[opponentId]];
    const myTurn = battle.turn === myPeerId && !battle.swapNeeded;
    const needsMySwap = battle.swapNeeded === myPeerId;
    const myHand = battle.teams[myPeerId].filter((c) => c.cardType === 'trainer' && !c.played);
    const trainerUsed = !!battle.trainerUsed?.[myPeerId];

    return (
      <Overlay wide>
        <h2 className="text-center text-lg font-bold text-zinc-900">Battle!</h2>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-center text-xs font-bold text-zinc-500">{opponentName}</p>
            <MengCardTile card={oppCard} showHp />
          </div>
          <div>
            <p className="mb-1 text-center text-xs font-bold text-zinc-500">{myName} (you)</p>
            <MengCardTile card={myCard} showHp />
          </div>
        </div>

        {needsMySwap ? (
          <div className="mt-4">
            <p className="mb-2 text-center text-xs font-semibold text-[var(--dex-accent-700)]">
              Choose your next Meng!
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {battle.teams[myPeerId]
                .filter((c) => c.cardType === 'meng' && c.alive)
                .map((card) => (
                  <MengCardTile
                    key={card.id}
                    card={card}
                    showHp
                    onClick={() => engine.swapCard(battle.battleId, card.id)}
                  />
                ))}
            </div>
          </div>
        ) : (
          <>
            {myHand.length > 0 && (
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-bold text-zinc-500">Your hand</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {myHand.map((card) => {
                    const cardDisabled = !myTurn || trainerUsed;
                    return (
                      <MengCardTile
                        key={card.id}
                        card={card}
                        disabled={cardDisabled}
                        onClick={cardDisabled ? undefined : () => engine.playTrainer(battle.battleId, card.id)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mx-auto mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={!myTurn}
                onClick={() => engine.attack(battle.battleId)}
                className="flex items-center justify-center gap-2 rounded-lg bg-[var(--dex-accent-600)] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--dex-accent-700)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Swords size={16} />
                {myTurn ? 'Attack' : `Waiting for ${opponentName}…`}
              </button>
              {myTurn && (
                <button
                  type="button"
                  onClick={() => engine.endTurn(battle.battleId)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
                >
                  <Flag size={15} />
                  Pass
                </button>
              )}
            </div>
          </>
        )}

        <div className="mt-5 max-h-32 overflow-y-auto rounded-lg bg-zinc-50 p-2 text-xs text-zinc-600">
          {battle.log.slice(-12).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </Overlay>
    );
  }

  if (battle.phase === 'finished') {
    const isDraw = battle.winner === null;
    const iWon = battle.winner === myPeerId;
    return (
      <Overlay>
        <div className="flex flex-col items-center gap-2 py-4 text-center">
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
      </Overlay>
    );
  }

  return null;
}

function Overlay({ children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-sm'} rounded-2xl bg-white p-6 shadow-2xl`}>
        {children}
      </div>
    </div>
  );
}
