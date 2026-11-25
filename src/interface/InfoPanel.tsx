/* The information panel a discovery opens (E at a white diamond). Content comes from data/chapter01.ts and
   data/photos.ts; older entries from data/narrative.ts still open (as text only).
   Layout, in the pause menu's style: a black panel on the right in the handwritten face, with the title, any
   picture (a photo, or a gallery with arrows and thumbnails), the sungka demonstration, the text and the actions.
   The scene is not covered: the camera turns to the object and zooms in on it, left of the panel (PlayerCamera).
   The photo wall has no panel: the camera leans in to one photograph at a time, the caption as plain text below it.
   Movement and mouse look are paused while it is open (game mode "reading"); E, Esc or Continue close it and return
   to first person. Only one panel can be open at a time (it is the game's single `reading` state). */
import { useEffect, useRef, useState } from 'react';
import { DISCOVERIES, type Discovery } from '../data/chapter01';
import { SHADOWS_DISCOVERIES } from '../data/chapter02';
import { narrative } from '../data/narrative';
import { discover, setGame, useGame } from '../game/GameState';
import { clearInput } from '../player/PlayerInput';
import { SungkaDemo } from './SungkaDemo';
import { PANEL_NARRATION } from '../data/narration';
import { NARRATION_ENABLED, narrate, stop as stopNarration, useNarration } from '../audio/narrator';
import { director } from '../game/director';

export function InfoPanel({ onClose }: { onClose: () => void }) {
  const id = useGame((s) => s.reading);
  const close = () => { stopNarration(); setGame({ reading: null }); onClose(); };
  // the narrator speaks the object's line as the panel opens (and stops if the panel closes first)
  const voiceId = id && NARRATION_ENABLED ? PANEL_NARRATION[id] : undefined;
  useEffect(() => { if (voiceId) void narrate(voiceId); return () => stopNarration(); }, [voiceId]);
  const speaking = useNarration((n) => n.id === voiceId && n.playing);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { clearInput(); closeBtn.current?.focus(); }, [id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!id) return null;
  const d: Discovery | null = DISCOVERIES[id] ?? SHADOWS_DISCOVERIES[id] ?? (narrative[id] ? { id, title: narrative[id].title, intro: '', body: [narrative[id].body] } : null);
  if (!d) return null;
  // "render:" pictures were views rendered from the scene; the camera now zooms in on the object itself instead
  const image = d.image?.startsWith('render:') ? undefined : d.image;
  const hasMedia = !!(d.gallery?.length || image || d.demo);

  // the photo wall: no panel, the camera leans in to each photo in turn (Discoveries.tsx) with its caption below
  if (id === 'survival-photograph' && d.gallery?.length) return <PhotoViewer d={d} photos={d.gallery} close={close} />;

  const act = () => {
    if (d.action?.kind === 'enter-next-chapter') { discover('survival-exit'); setGame({ reading: 'survival-road' }); }
  };

  return (
    // a black panel on the right, as the pause menu is on the left; the scene stays clear, framed on the object
    <div className="info" role="dialog" aria-modal="true" aria-labelledby="info-title">
      <aside className="info__panel">
        <button ref={closeBtn} type="button" className="info__x" onClick={close} aria-label="Close">×</button>
        {d.kicker && <p className="info__kicker">{d.kicker}</p>}
        <h2 id="info-title" className="info__title">{d.title}</h2>
        {hasMedia && (
          <div className="info__media">
            {d.gallery?.length ? <Gallery photos={d.gallery} /> : image ? (
              <figure className="info__figure">
                <img src={image} alt={d.imageCaption ?? d.title} />
                {d.imagePlaceholder && <span className="info__badge">Placeholder photo</span>}
                {d.imageCaption && <figcaption>{d.imageCaption}</figcaption>}
              </figure>
            ) : null}
            {d.demo === 'sungka' && <SungkaDemo />}
          </div>
        )}
        {d.intro && <p className="info__intro">{d.intro}</p>}
        {d.body.map((p, i) => <p key={i} className="info__body">{p}</p>)}
        <div className="info__actions">
          {voiceId && (speaking
            ? <button type="button" className="info__voice" onClick={() => stopNarration()}>Stop the voice</button>
            : <button type="button" className="info__voice" onClick={() => void narrate(voiceId)}>Listen again</button>)}
          {d.action && <button type="button" className="info__primary" onClick={act}>{d.action.label}</button>}
          <button type="button" className="info__continue" onClick={close}>Continue <kbd>E</kbd></button>
        </div>
      </aside>
    </div>
  );
}

function Gallery({ photos }: { photos: NonNullable<Discovery['gallery']> }) {
  const [i, setI] = useState(0);
  const n = photos.length, p = photos[i];
  const go = (k: number) => setI((v) => (v + k + n) % n);
  // the wall lights the photo being looked at (Discoveries.tsx PhotoWall)
  useEffect(() => { director.photo = i; return () => { director.photo = -1; }; }, [i]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'ArrowRight') go(1); if (e.code === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="gallery">
      <figure className="info__figure gallery__main">
        <img key={p.src} src={p.src} alt={p.title ?? `Photo ${i + 1}`} />
        {p.placeholder && <span className="info__badge">Placeholder photo</span>}
        <button type="button" className="gallery__nav gallery__nav--prev" onClick={() => go(-1)} aria-label="Previous photo">‹</button>
        <button type="button" className="gallery__nav gallery__nav--next" onClick={() => go(1)} aria-label="Next photo">›</button>
      </figure>
      <div className="gallery__meta">
        <span className="gallery__count">{i + 1} / {n}</span>
        {p.title && <strong>{p.title}</strong>}
        {p.date && <span className="gallery__date">{p.date}</span>}
      </div>
      {p.description && <p className="gallery__desc">{p.description}</p>}
      <div className="gallery__thumbs">
        {photos.map((ph, k) => (
          <button key={k} type="button" className={`gallery__thumb${k === i ? ' is-active' : ''}`} onClick={() => setI(k)} aria-label={`Photo ${k + 1}`}>
            <img src={ph.src} alt="" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** the photo wall, one photograph at a time: the camera leans in to it (Discoveries.tsx PhotoWall) and its caption
 *  sits at the bottom as plain text, no box. ← → (or A / D, the wheel, a click on either side) move along the wall;
 *  E or Esc steps back. Photos without their own description borrow the collection's lines, in order. */
function PhotoViewer({ d, photos, close }: { d: Discovery; photos: NonNullable<Discovery['gallery']>; close: () => void }) {
  const [i, setI] = useState(0);
  const n = photos.length, p = photos[i];
  const go = (k: number) => setI((v) => Math.min(n - 1, Math.max(0, v + k)));
  useEffect(() => { director.photo = i; }, [i]);
  useEffect(() => () => { director.photo = -1; }, []);
  useEffect(() => {
    let lastWheel = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); go(1); }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); go(-1); }
    };
    const onWheel = (e: WheelEvent) => {
      const now = performance.now(), dy = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(dy) < 8 || now - lastWheel < 650) return;
      lastWheel = now; go(dy > 0 ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('wheel', onWheel); };
  });
  const lines = [d.intro, ...d.body].filter(Boolean) as string[];
  const text = p.description || lines[i] || '';
  return (
    <div className="photoview" role="dialog" aria-modal="true" aria-label={d.title}
      onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; go(e.clientX < window.innerWidth * 0.4 ? -1 : 1); }}>
      <div className="photoview__caption" key={i}>
        <p className="photoview__count">{d.title} · {i + 1} / {n}{p.date ? ` · ${p.date}` : ''}</p>
        {p.title && <h2 className="photoview__title">{p.title}</h2>}
        {text && <p className="photoview__text">{text}</p>}
      </div>
      <div className="photoview__nav">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous photo">‹</button>
        <button type="button" className="photoview__back" onClick={close}>Step back <kbd>E</kbd></button>
        <button type="button" onClick={() => go(1)} disabled={i === n - 1} aria-label="Next photo">›</button>
      </div>
    </div>
  );
}
