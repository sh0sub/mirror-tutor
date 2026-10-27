# mirror-tutor

**Mirror Tutor** teaches K-beauty makeup on your own face: YouCam Face Analyzer picks the technique for your features, VTO renders each step as the answer key, and you grade your own attempt against it.

Built for the YouCam API VTO Hackathon (deadline 2026-11-02 PST). Uses YouCam Face Analyzer and Makeup VTO; one full flow is about 14 units.

- Capture, analyze, lesson (step-by-step VTO overlays), grade, shop, share
- Unit guard per session, demo mode when credits run low, no image stored server-side

## Status

Core flow (F1–F9, S3) implemented and running in **mock mode** (no YouCam key yet). See `docs/plan.md`, `docs/api-notes.md`, `docs/design.md`.

## Run

```bash
npm install
cp .env.example .env      # optional: YOUCAM_API_KEY + YOUCAM_MODE=live, ANTHROPIC_API_KEY
npm run dev               # http://localhost:3000 (mock mode without a key)
npm test                  # vitest: unit + integration (tests/), no network, no units
npm run typecheck && npm run lint
npm run spike -- all      # D1 real-API spikes (needs YOUCAM_API_KEY + .local/face.jpg, ≤55u guard)
```

## Privacy

Photos are processed in memory only (EXIF stripped, never written to disk or logs); YouCam keeps uploaded files up to 30 days; only the 5 face attributes stay in localStorage (deletable); share cards are drawn on the device; keys live only in `.env`.

## License

MIT
