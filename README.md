# Flapurr

A tap-to-fly cat game at https://gitcrazygitwild.github.io/Flapurr/.

- **Classic:** fresh randomized courses, the existing local best, and the existing online Top Cats leaderboard. Posting a score is optional after a run; the name dialog no longer interrupts retries.
- **Daily cat challenge:** the same obstacle sequence for an Eastern calendar date, with Hubert (dark brown tabby/yellow eyes), Mack (brown tabby/green eyes), or Mia (light tabby/Siamese mix/blue eyes). Daily bests stay separate from Classic and never post to Top Cats. A run keeps its starting day's course through midnight; New run picks up the new day.
- **Practice:** wider gaps, slower posts, a gentler flap, and a faint center guide. Practice has its own local best and cannot submit to the competitive leaderboard.
- **Choose your copilot:** fly with Hubert, Mack, or Mia in Classic or Practice, or choose Surprise me. The daily pilot stays locked to the shared challenge. The selection persists on the device.
- **Your flight log:** local totals and the eight most recent completed runs, labeled by mode and cat. Existing Classic bests are preserved; the new log starts from its first completed run.
- **Treat milestones:** First fish, Bronze whiskers (5), Silver paws (10), Golden cat (25), and Nine lives legend (50), with in-flight celebrations and a result card.
- **Copy your result:** a compact cat/mode/date/score card to paste wherever you like, with a selectable-text fallback when clipboard access is unavailable.
- **Pause:** use the button, P, or Escape. Leaving the tab pauses an active run; Space or Resume continues. Sound preference is saved. Fullscreen keeps pause, score entry, and results inside the play area.

**Space starts, flaps, resumes, and retries.** Tap works too; R resets to the ready screen. Typing in forms keeps normal keyboard behavior, and held Space does not generate repeated flaps or scroll the page. Score submission only opens when explicitly selected. Reduced-motion preferences suppress reward particles and drifting background cats.

The renderer clears the entire backing bitmap each frame and clips artwork to the playfield. This prevents the trails that previously accumulated in side margins on wide screens. ResizeObserver handles layout changes, and device pixel ratio is capped at 2 to bound rendering work. Simulation uses fixed 60 Hz steps, preserving Classic rules while making physics consistent at 30/60/144 Hz. `game-core.js` holds viewport calculations, physics timing, collision checks, mode rules, milestones, and local progress independently of drawing and Firebase.

Firebase loads separately so unavailable leaderboard services do not stop local play. Existing Firebase collections and saved Classic bests are preserved. The new features do not require another service or paid API.

Run `npm test` and `npm run check`. Serve this directory with a static server to preview. `?demo=1` disables Firebase connections, the play-counter increment, and online score writes for testing; local gameplay still works. Tests cover deterministic daily courses, Eastern-midnight rollover, mode isolation, viewport bounds, refresh-rate-independent physics, collision edges, and local progress. Browser checks cover Space-only play, pilots, Practice scores, fullscreen, responsive layout, and pixel checks that the canvas margins are cleared. GitHub Pages publishes the `main` branch directly.
