/* Light loading veil over the 3D layer only: the HTML story underneath is readable immediately. */
import { useJourney } from '../../state/journey';

export function Loader() {
  const quality = useJourney((s) => s.quality);
  const ready = useJourney((s) => s.sceneReady);
  const loaded = useJourney((s) => s.loaded);
  if (quality === 'off') return null;
  return (
    <div className={`loader${ready ? ' is-done' : ''}`} aria-hidden="true">
      <p className="loader__label">Preparing the journey</p>
      <div className="loader__track"><div className="loader__fill" style={{ transform: `scaleX(${Math.max(0.04, loaded)})` }} /></div>
    </div>
  );
}
