// Save as: app/manifest.js
// Next.js serves this at /manifest.webmanifest and links it automatically.

export default function manifest() {
  return {
    name: 'Gram Ride',
    short_name: 'Gram Ride',
    description: 'গ্রামের যাত্রা, সহজে — Shared rides and reserve rides for your village.',
    lang: 'bn',
    dir: 'ltr',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#00875A',
    categories: ['travel', 'transportation'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}