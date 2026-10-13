import { useEffect, useMemo, useRef, useState } from 'react';
import type { Fund } from '../lib/mufap';

interface Props {
  id: string;
  funds: Fund[];
  selected: Fund | null;
  /** Name to show when the saved fund is missing from today's list */
  fallbackName?: string;
  onPick: (f: Fund | null) => void;
  /** Field to move the cursor to after a fund is picked */
  nextFieldId?: string;
  /** Reports what's typed, so the editor can tell a half-filled row from an empty one */
  onTextChange?: (text: string) => void;
}

const MAX_RESULTS = 12;

/** Search box over all MUFAP funds. Every word typed must appear in the fund name or category. */
export default function FundPicker({ id, funds, selected, fallbackName, onPick, nextFieldId, onTextChange }: Props) {
  const [text, setText] = useState(selected?.name ?? fallbackName ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => { if (selected) setText(selected.name); }, [selected]);

  const index = useMemo(() => funds.map(f => ({ f, s: `${f.name} ${f.category}`.toLowerCase() })), [funds]);
  const matches = useMemo(() => {
    const terms = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (selected && text === selected.name) return index.slice(0, MAX_RESULTS).map(x => x.f);
    return index.filter(x => terms.every(t => x.s.includes(t))).slice(0, MAX_RESULTS).map(x => x.f);
  }, [index, text, selected]);

  function pick(f: Fund) {
    onPick(f);
    setText(f.name);
    setOpen(false);
    if (nextFieldId) setTimeout(() => document.getElementById(nextFieldId)?.focus(), 0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!matches.length) return;
    if (e.key === 'Enter') {
      // Works even if the list closed, e.g. after switching apps: take the highlighted or top match.
      e.preventDefault();
      if (!selected || text !== selected.name) pick(matches[open ? active : 0]);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (active + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      setActive(next);
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="picker">
      <label htmlFor={id}>Fund</label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder="Search, e.g. meezan cash"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        value={text}
        onFocus={e => { e.target.select(); setOpen(true); setActive(0); }}
        onChange={e => { setText(e.target.value); onTextChange?.(e.target.value); setOpen(true); setActive(0); if (selected) onPick(null); }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <ul id={`${id}-list`} ref={listRef} className="picker-list" role="listbox">
          {matches.length ? matches.map((f, i) => (
            <li key={f.id} role="option" aria-selected={i === active} className={i === active ? 'on' : ''}
              onMouseDown={e => { e.preventDefault(); pick(f); }}>
              <span>{f.name}</span>
              <small>{f.category} · NAV {f.nav.toFixed(4)}</small>
            </li>
          )) : <li className="none"><small>No fund matches. Try fewer words.</small></li>}
        </ul>
      )}
    </div>
  );
}
