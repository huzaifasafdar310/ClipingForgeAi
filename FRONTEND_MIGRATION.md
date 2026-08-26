# 🚀 Frontend React Migration Note — ClipAI Studio

## Summary of Changes
The frontend of **ClipAI Studio** has been completely overhauled from a monolithic 2,175-line vanilla HTML/JS file (`templates/index.html`) into a modern, production-grade **React 18 + Vite + TypeScript + Tailwind CSS** Single-Page Application (SPA).

---

## 🏗️ New Architecture & Stack

- **Framework & Build**: React 18, Vite 6, TypeScript 5
- **Styling & Design System**: Tailwind CSS (PostCSS build with tokens for OLED dark surfaces `#070A11` and brand amber `#FACC15`), Lucide Icons
- **Server State & Polling**: TanStack Query (React Query) v5
- **UI Primitives**: Headless accessible components (Radix UI primitives for Modals, Dropdowns, Sliders, and Tooltips)
- **Routing**: React Router DOM v6
- **Auth**: Modern React AuthProvider & Google Identity Services integration

### Directory Structure (`frontend/`)
```
frontend/
├── package.json
├── tsconfig.json
├── vite.config.ts              # Configured with proxy to Flask (:5000)
├── tailwind.config.ts          # OLED dark tokens, typography, and animations
├── index.html
├── src/
│   ├── main.tsx                # Mounts QueryClientProvider, AuthProvider, Router
│   ├── App.tsx                 # Route tree (/ landing, /app dashboard, /app/studio, /app/projects)
│   ├── types/
│   │   ├── api.ts              # Clip, Job, Metadata, Payload interfaces
│   │   └── auth.ts             # Google user & token session interfaces
│   ├── lib/
│   │   ├── api.ts              # Fully typed API client for Flask backend
│   │   ├── queryClient.ts      # TanStack Query client setup
│   │   └── utils.ts            # Class merging, timestamp formatting, virality math
│   ├── context/
│   │   └── AuthContext.tsx     # Google OAuth 2.0 token management & session restoration
│   ├── components/
│   │   ├── ui/                 # Button, Badge, Card, Input, Modal, Skeleton
│   │   └── layout/             # Header, Sidebar, MobileDrawer, NotificationDropdown
│   ├── features/
│   │   ├── landing/            # LandingHero, FeatureGrid, SocialProofMarquee, LiveDemoSection, CTAFooter
│   │   ├── dashboard/          # QuickIngestCard, RecentClipsGrid, PublishHub
│   │   ├── studio/             # StudioEditor, VideoPlayer, TimelineScrubber, SegmentList, SegmentCard, CaptionControls, AspectRatioSwitcher, MetadataEditor, ExportModal, ProcessingModal
│   │   └── projects/           # MetricCards, FilterToolbar, ProjectsTable
│   └── pages/
│       ├── LandingPage.tsx     # Marketing & Instant Ingest page
│       ├── DashboardPage.tsx   # Dashboard workspace with Quick Ingest & Publish Hub
│       ├── StudioPage.tsx      # 3-Column Video Editor workspace with live preview
│       └── ProjectsPage.tsx    # Library table, filtering, and video uploads
```

---

## 🛠️ Development & Production Commands

### 1. Running in Development Mode
Start the Flask backend (Port 5000):
```bash
python app.py
```

In a separate terminal, start the Vite development server (Port 3000):
```bash
cd frontend
npm run dev
```
Vite automatically proxies all `/api/*` and `/clips/*` requests to `http://127.0.0.1:5000`, providing instantaneous Hot Module Replacement (HMR).

### 2. Building for Production
Inside the `frontend/` directory:
```bash
npm run build
```
This compiles the TypeScript code and bundles optimized static assets into `frontend/dist/`.

Flask in `app.py` is configured to serve `frontend/dist/` automatically on `http://127.0.0.1:5000` with client-side SPA fallback.

---

## 🛡️ Backend Contract Compliance
The Flask backend remains 100% untouched in its business logic and API contracts:
- `POST /api/analyze`
- `POST /api/analyze-local`
- `POST /api/upload`
- `GET /api/status/<job_id>`
- `GET /api/download/<clip_id>`
- `PATCH /api/clip/<clip_id>/caption-style`
- `GET /api/projects`
- `POST /api/admin/cleanup`
- `GET /clips/<filename>`
