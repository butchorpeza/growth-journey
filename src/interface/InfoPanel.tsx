/* The information panel a discovery opens (E at a white diamond). Content comes from data/chapter01.ts and
   data/photos.ts; older entries from data/narrative.ts still open (as text only).
   Layout: the picture side (a photo, a gallery with arrows and thumbnails, or a view rendered from the scene, plus an
   optional sungka demonstration) and the text side (kicker, title, intro, narrative, date, an optional action).
   Movement and mouse look are paused while it is open (game mode "reading"); E, Esc or Continue close it and return
   to first person. Only one panel can be open at a time (it is the game's single `reading` state). */
import { useEffect, useRef, useState } from 'react';
import { DISCOVERIES, type Discovery } from '../data/chapter01';
import { narrative } from '../data/narrative';
import { discover, setGame, useGame } from '../game/GameState';
import { clearInput } from '../player/PlayerInput';
import { getRender } from '../rendering/snapshots';
import { SungkaDemo } from './SungkaDemo';

export function InfoPanel({ onClose }: { onClose: () => void }) {
  const id = useGame((s) => s.reading);
  const close = () => { setGame({ reading: null }); onClose(); };
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { clearInput(); closeBtn.current?.focus(); }, [id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!id) return null;
  const d: Discovery | null = DISCOVERIES[id] ?? (narrative[id] ? { id, title: narrative[id].title, intro: '', body: [narrative[id].body] } : null);
  if (!d) return null;
  const image = d.image?.startsWith('render:') ? getRender(d.image.slice(7)) : d.image;
  const hasMedia = !!(d.gallery?.length || image || d.demo);

  const act = () => {
    if (d.action?.kind === 'enter-next-chapter') { discover('survival-exit'); setGame({ reading: 'survival-road' }); }
  };

  return (
    // text-only discoveries sit to the side without blurring the scene, so the object (the lamp's swelling flame,
    // the cat) stays in view beside the words
    <div className={`info${hasMedia ? '' : ' info--side'}`} role="dialog" aria-modal="true" aria-labelledby="info-title">
      <div className={`info__panel${hasMedia ? '' : ' info__panel--text'}`}>
        <button ref={closeBtn} type="button" className="info__x" onClick={close} aria-label="Close">×</button>
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
        <div className="info__text">
          {d.kicker && <p className="info__kicker">{d.kicker}</p>}
          <h2 id="info-title" className="info__title">{d.title}</h2>
          {d.intro && <p className="info__intro">{d.intro}</p>}
          {d.body.map((p, i) => <p key={i} className="info__body">{p}</p>)}
          <div className="info__actions">
            {d.action && <button type="button" className="info__primary" onClick={act}>{d.action.label}</button>}
            <button type="button" className="info__continue" onClick={close}>Continue <kbd>E</kbd></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Gallery({ photos }: { photos: NonNullable<Discovery['gallery']> }) {
  const [i, setI] = useState(0);
  const n = photos.length, p = photos[i];
  const go = (k: number) => setI((v) => (v + k + n) % n);
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
