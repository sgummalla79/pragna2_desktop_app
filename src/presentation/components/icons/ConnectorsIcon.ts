/**
 * Connectors icon — the interlocking-links glyph used for MCP connectors,
 * both in the Settings main menu ("Connectors") and on the flow editor's
 * MCP node (palette + canvas card). One definition, two consumers.
 *
 * Built with `createLucideIcon` so it's a real `LucideIcon` (drops into
 * anything typed for lucide icons) and inherits lucide's defaults:
 * `viewBox 0 0 24 24`, `fill none`, `stroke currentColor`, round caps/joins,
 * and a caller-overridable `size` / `strokeWidth` / `className`.
 */

import { createLucideIcon } from 'lucide-react';

export const ConnectorsIcon = createLucideIcon('Connectors', [
  [
    'path',
    {
      d: 'M3.49994 11.7501L11.6717 3.57855C12.7762 2.47398 14.5672 2.47398 15.6717 3.57855C16.7762 4.68312 16.7762 6.47398 15.6717 7.57855M15.6717 7.57855L9.49994 13.7501M15.6717 7.57855C16.7762 6.47398 18.5672 6.47398 19.6717 7.57855C20.7762 8.68312 20.7762 10.474 19.6717 11.5785L12.7072 18.543C12.3167 18.9335 12.3167 19.5667 12.7072 19.9572L13.9999 21.2499',
      key: 'connectors-a',
    },
  ],
  [
    'path',
    {
      d: 'M17.4999 9.74921L11.3282 15.921C10.2237 17.0255 8.43272 17.0255 7.32823 15.921C6.22373 14.8164 6.22373 13.0255 7.32823 11.921L13.4999 5.74939',
      key: 'connectors-b',
    },
  ],
]);
