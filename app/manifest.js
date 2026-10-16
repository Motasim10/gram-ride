// Save as: app/manifest.js
// Next.js serves this at /manifest.webmanifest and links it automatically.

export default function manifest() {
  return {
    name: 'GramJatra',
    short_name: 'GramJatra',
    description: 'গ্রামের যাত্রা, সহজে — Shared rides and reserve rides for your village.',
    lang: 'bn',
    dir: 'ltr',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#026F4B',
    theme_color: '#00875A',
    categories: ['travel', 'transportation'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}