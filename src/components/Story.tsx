/* The whole story as real HTML (prerendered at build time for search engines and screen readers).
   The 3D canvas behind it only illustrates; every fact lives here. */
import { BeginningChapter } from './chapters/BeginningChapter';
import { DiscoveryChapter } from './chapters/DiscoveryChapter';
import { FrontierChapter } from './chapters/FrontierChapter';
import { ResultsChapter } from './chapters/ResultsChapter';
import { SystemChapter } from './chapters/SystemChapter';

export function Story() {
  return (
    <>
      <BeginningChapter />
      <DiscoveryChapter />
      <SystemChapter />
      <ResultsChapter />
      <FrontierChapter />
    </>
  );
}
