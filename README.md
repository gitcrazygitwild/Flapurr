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

## The little cat arcade

The responsive arcade puts the flight deck and crew beside the playfield on desktop, with stacked panels on phones. A persistent in-game HUD shows personal best, clean passes, and treats to the next medal, including fullscreen.

- **Crew stamp book:** Hubert, Mack, and Mia each earn stamps for a completed flight, five treats in one flight, and 25 cumulative treats. All modes count toward cosmetic progress. The existing recent-flight log seeds the new book once; existing best-score keys and leaderboard collections are unchanged. Surprise me now picks one of the three house cats.
- **Unlockable skies:** three crew stamps unlock Peach sunset; six unlock Catnip aurora. Sky selection persists locally and changes artwork only. Classic and Daily physics, scoring, and seeded obstacle geometry stay unchanged.
- **Flight feedback:** center passes earn a separate clean-pass count and streak without bonus competitive points. Results show time airborne, clean passes, best streak, new stamps, and advice matched to the collision. Paused time is excluded.
- **Reliable score feedback:** the board can load even when the visit counter fails. A completed score write remains successful if the follow-up board refresh fails. Score entry supports a focus trap, Escape, and Enter to submit.

`crew-progress.js` contains validated, independent progress and feedback rules; `crew-ui.js` handles the stamp book and cat portraits. Progress and unlocked skies are stored on this device and need no new service. Tests include progress migration, malformed storage, mode isolation, cosmetic unlock thresholds, clean-pass boundaries, and browser checks across 320–1440px.

## Monetization: Continue with a rewarded ad

After a crash in **Classic**, a player who has at least one treat can **Continue · watch an ad** once per run. After the ad, the cat floats in the next gap until the next tap, then blinks through a short moment of protection. The course slides so the next post is a safe distance ahead. Saying no, or an ad that fails to load, ends the run normally.

- **Fair play:** Daily and Practice never offer a continue. A continued run can't post to Top Cats. The crash's best score, flight log and crew stamps are undone when you continue, so each run is counted once, when it really ends.
- **The ad sits behind one interface** in `ads.js` (`offer()` → `show()` → `rewarded | dismissed | unavailable`), so a network can be switched on without touching the game. `AD_CONFIG.provider`:
  - `'placeholder'` (now): a 5-second stand-in card, so the flow works today and earns nothing.
  - `'adsense'`: Google AdSense **H5 Games Ads**, rewarded format through the Ad Placement API (`adConfig` + `adBreak({type:'reward'})`). Continue only appears when Google has an ad ready.
  - `'none'`: hides the offer.
  - For testing, `?ads=none` or `?ads=placeholder` overrides the setting.

### Turning on real ads (AdSense)
1. **Use a custom domain.** AdSense generally won't approve a `github.io` sub-page. Point a domain at GitHub Pages (Settings → Pages → Custom domain).
2. **Sign up for AdSense** with that domain and apply for **H5 Games Ads**.
3. **Add `ads.txt`** at the domain's root with the line AdSense gives you, for example `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`.
4. **Add a privacy policy page.** For visitors in the EU, UK or Switzerland, turn on Google's consent message (AdSense → Privacy & messaging).
5. **Set `AD_CONFIG`** in `ads.js` to `{ provider:'adsense', adsenseClient:'ca-pub-XXXXXXXXXXXXXXXX', testMode:true }`. Try it, since test mode shows Google's test ads. Then set `testMode:false`.
6. **Consider restricting ad categories** in AdSense (Blocking controls), since family members play.

## The big glow-up

Six upgrades. Nothing here changes the course, the hitboxes, the score or the leaderboard: a post's hitbox is exactly the rectangle it always was.

- **Scratching-post cat trees (visual):** the posts are now sisal-wrapped cat trees with cylinder shading, frayed fibres, carpeted perches (six colours) with plush tufts along the gap, wooden bases on the roof and ceiling plates up top. Tall posts sometimes have a carpeted cubby with a cat peeking out, blinking now and then. Every post keeps its own look for its whole trip across the screen (`scenery.js`, seeded per post).
- **A living backdrop (visual):** two layers of city skyline scroll at different speeds behind the posts, with lit windows and a neighbour cat on a rooftop. Each sky gets its own centrepiece: a moon for Midnight, a banded setting sun for Peach sunset, and soft aurora curtains for Catnip aurora. Also twinkling stars, an occasional shooting star, cat-eared clouds and a tiled rooftop ground that moves with the course. The cat got inner ears, a belly, eye shine, a nose, blinks and a wagging tail, and after a crash it tumbles onto the roof with crossed eyes. Reduced-motion settings hold the scenery still.
- **Golden fish (fun):** about 40% of posts have a golden fish floating in the open air behind them. Catching one is optional, risky and worth nothing to the score. Fish go in a jar saved on this device, the run's catch shows top right, and the result card tallies it. They're placed with the cosmetic random stream, never the course stream, so Daily courses stay identical for everyone.
- **The hat rack (fun):** lifetime golden fish unlock hats your cat wears in flight: bow tie (3), party hat (8), sunglasses (15), wizard hat (25) and crown (40). Pick one in the new hat-rack panel; the choice is saved on this device (`wardrobe.js`).
- **Resume countdown (practical):** unpausing shows a 3-2-1 ring (about 2 seconds) before anything moves, so a resume never drops you straight into a post.
- **Install and play offline (practical):** a web app manifest, PNG app icons (`apple-touch-icon.png`, `icon-192/512.png`, maskable) and a network-first service worker (`sw.js`). Add Flapurr to a home screen and it opens full screen and keeps working without a connection. Online you always get the newest version; Firebase and ad requests are never cached. The worker is skipped in `?demo=1`.
