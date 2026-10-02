import { loadFont } from '@remotion/google-fonts/Poppins';

export const { fontFamily } = loadFont('normal', { weights: ['400', '600', '700', '800', '900'], subsets: ['latin', 'latin-ext'] });

export const C = {
  night: '#15162A',
  navy: '#1B2550',
  dusk: '#2A2D5C',
  violet: '#4A4478',
  green: '#3DDC97',
  greenSoft: 'rgba(61, 220, 151, 0.16)',
  cream: '#FFF4E2',
  sunTop: '#FFE9B8',
  sunBottom: '#F7A15E',
  muted: '#A9A8CC',
};

export const FPS = 30;
