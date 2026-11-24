/* A small demonstration of how sungka is played: a board of two rows of seven holes and a store at each end. One
   hole is picked up and its shells are sown one by one into the following holes around the board (skipping the
   opponent's store), then the board resets and another hole is played. Not a game, just the motion. */
import { useEffect, useState } from 'react';

// cycle of positions around the board: the player's row left→right, their store (right), the opponent's row
// right→left, (the opponent's store is skipped when the player sows)
const ROW = 7;
type Board = { mine: number[]; theirs: number[]; myStore: number; theirStore: number };
const fresh = (): Board => ({ mine: Array(ROW).fill(7), theirs: Array(ROW).fill(7), myStore: 0, theirStore: 0 });
const ORDER = [...Array.from({ length: ROW }, (_, i) => `m${i}`), 'S', ...Array.from({ length: ROW }, (_, i) => `t${ROW - 1 - i}`)];

export function SungkaDemo() {
  const [board, setBoard] = useState(fresh);
  const [hand, setHand] = useState<{ at: number; left: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    let start = 2, timer = 0;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const step = () => {
      setHand((h) => {
        if (!h) {                                        // pick up a hole
          setBoard((b) => { const n = { ...b, mine: [...b.mine] }; n.mine[start] = 0; return n; });
          setActive(`m${start}`);
          return { at: ORDER.indexOf(`m${start}`), left: 7 };
        }
        if (h.left === 0) {                              // done: pause, reset, play another hole
          setTimeout(() => { setBoard(fresh()); setActive(null); start = (start + 3) % ROW; }, 900);
          return null;
        }
        const at = (h.at + 1) % ORDER.length, key = ORDER[at];
        setBoard((b) => {
          const n = { ...b, mine: [...b.mine], theirs: [...b.theirs] };
          if (key === 'S') n.myStore++; else if (key[0] === 'm') n.mine[+key.slice(1)]++; else n.theirs[+key.slice(1)]++;
          return n;
        });
        setActive(key);
        return { at, left: h.left - 1 };
      });
      timer = window.setTimeout(step, reduced ? 1200 : 520);
    };
    timer = window.setTimeout(step, 700);
    return () => clearTimeout(timer);
  }, []);
  const pit = (key: string, count: number, cls = '') => (
    <div key={key} className={`sungka__pit ${cls}${active === key ? ' is-active' : ''}`}>
      <span className="sungka__shells" aria-hidden="true">{Array.from({ length: Math.min(count, 12) }, (_, i) => <i key={i} />)}</span>
      <span className="sungka__n">{count}</span>
    </div>
  );
  return (
    <div className="sungka" aria-label="How shells are sown around a sungka board">
      <div className="sungka__board">
        {pit('T', board.theirStore, 'sungka__store')}
        <div className="sungka__rows">
          <div className="sungka__row">{board.theirs.map((c, i) => pit(`t${i}`, c))}</div>
          <div className="sungka__row">{board.mine.map((c, i) => pit(`m${i}`, c))}</div>
        </div>
        {pit('S', board.myStore, 'sungka__store')}
      </div>
      <p className="sungka__note">{hand ? `Sowing: ${hand.left} shell${hand.left === 1 ? '' : 's'} left in hand` : 'Pick up all the shells from one hole…'}</p>
    </div>
  );
}
