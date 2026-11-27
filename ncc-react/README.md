# NCC Two-Day Event — React + Vite + Tailwind + Framer Motion

Mobile-first registration portal for the college's two-day NCC event (Drill, Quiz, Map Reading, Obstacle Course, and Firing — *subject to approvals*), built to run immediately in **Demo Mode** (`localStorage`) with zero backend setup and optional Supabase configuration later.

## Local Development

```bash
cd ncc-react
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Free Deployment (Vercel or Netlify)

- **Vercel**: Import repository, set **Root Directory** to `ncc-react`, Build Command `npm run build`, Output Directory `dist`.
- **Netlify**: Set **Base directory** to `ncc-react`, Build Command `npm run build`, Publish directory `ncc-react/dist`.
- Leave `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` unset for Demo Mode, or copy `.env.example` when ready to connect Supabase (never put a `service_role` key in `VITE_*` variables).

## Animations & Where to Tweak Speed / Intensity

All motion uses GPU-composited `transform` and `opacity` and automatically honors `prefers-reduced-motion`:

- **Gradient Aurora & Parallax Particles**: `src/components/AnimatedBackground.jsx` — adjust `duration` (currently `18`–`26s`), blur radius (`blur-3xl`), or opacity (`/15`) on the orb divs and `PARTICLES` array.
- **Splash Crest Intro (0.95s once per session)**: `src/components/SplashIntro.jsx` — adjust `950` ms timeout or `duration: 0.45`.
- **Page Transitions**: `src/App.jsx` (`PageTransition` component) — adjust `duration: 0.22` and `y: 10`.
- **Scroll Reveal & Card Hover**: `src/components/GlassCard.jsx` — adjust `duration: 0.42`, `viewport.amount`, or `whileHover={{ y: -4 }}`.
- **Stat Count-Up**: `src/components/CountUpStat.jsx` — adjust `duration = 620` ms.
- **Active Nav / Tab Pill**: `src/components/AppShell.jsx`, `src/pages/EventsPage.jsx`, `src/pages/AuthPage.jsx` via Framer Motion `layoutId`.
