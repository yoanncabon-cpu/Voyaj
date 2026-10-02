import { Composition } from 'remotion';
import { Promo } from './Promo';
import { FPS } from './theme';

export const Root = () => (
  <Composition id="VoyajPromo" component={Promo} durationInFrames={15 * FPS} fps={FPS} width={1920} height={1080} />
);
