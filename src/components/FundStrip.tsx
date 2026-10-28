import { useRef, useState } from 'react';
import type { Position } from '../lib/calc';
import { rs, tone } from '../lib/format';
import FundCard from './FundCard';

interface Props {
  positions: Position[];
  onEdit: () => void;
  /** Called with fund IDs in the new order */
  onReorder: (fundIds: string[]) => void;
}

/** Fund cards in a swipeable row, with a reorder mode that lists them vertically with up/down buttons. */
export default function FundStrip({ positions, onEdit, onReorder }: Props) {
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const byId = new Map(positions.map(p => [p.holding.fundId, p]));

  function startReorder() {
    setOrder(positions.map(p => p.holding.fundId));
    setReordering(true);
  }
  function move(i: number, dir: -1 | 1) {
    setOrder(o => {
      const next = [...o];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
  }
  function done() {
    onReorder(order);
    setReordering(false);
  }
  function onScroll() {
    const el = strip.current;
    if (!el || !el.firstElementChild) return;
    const w = (el.firstElementChild as HTMLElement).offsetWidth + 16;
    setIndex(Math.min(positions.length - 1, Math.round(el.scrollLeft / w)));
  }
  function goTo(i: number) {
    const el = strip.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const target = Math.max(0, Math.min(positions.length - 1, i));
    el.scrollTo({ left: target * (card.offsetWidth + 16), behavior: 'smooth' });
    setIndex(target);
  }

  return (
    <section aria-labelledby="funds-h">
      <div className="section-head">
        <h2 id="funds-h">Your funds</h2>
        <div className="head-actions">
          {reordering ? (
            <button type="button" className="text-btn strong" onClick={done}>Done</button>
          ) : (
            <>
              {positions.length > 1 && <button type="button" className="text-btn" onClick={startReorder}>Reorder</button>}
              <button type="button" className="text-btn" onClick={onEdit}>Edit</button>
            </>
          )}
        </div>
      </div>

      {reordering ? (
        <ol className="reorder">
          {order.map((id, i) => {
            const p = byId.get(id)!;
            return (
              <li key={id}>
                <div className="reorder-name">
                  <b>{p.fund?.name ?? p.holding.name}</b>
                  <span className={tone(p.total)}>{rs(p.total, true)}</span>
                </div>
                <div className="reorder-btns">
                  <button type="button" className="icon-btn on-surface" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${p.holding.name} up`}>↑</button>
                  <button type="button" className="icon-btn on-surface" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${p.holding.name} down`}>↓</button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <>
          <div className={`strip ${positions.length === 1 ? 'strip-single' : ''}`} ref={strip} onScroll={onScroll}>
            {positions.map(p => <FundCard key={p.holding.fundId} position={p} />)}
          </div>
          {positions.length > 1 && (
            <div className="strip-nav">
              <button type="button" className="nav-btn" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous fund">‹</button>
              <div className="dots" role="tablist" aria-label="Fund cards">
                {positions.map((p, i) => (
                  <button key={p.holding.fundId} type="button" role="tab" aria-selected={i === index}
                    aria-label={p.fund?.name ?? p.holding.name} className={i === index ? 'dot on' : 'dot'} onClick={() => goTo(i)} />
                ))}
              </div>
              <button type="button" className="nav-btn" onClick={() => goTo(index + 1)} disabled={index === positions.length - 1} aria-label="Next fund">›</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
