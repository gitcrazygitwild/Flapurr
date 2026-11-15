# Flapurr

A tap-to-fly cat game at https://gitcrazygitwild.github.io/Flapurr/.

- **Classic:** fresh randomized courses, existing local best, and the existing online Top Cats leaderboard.
- **Daily cat challenge:** the same obstacle sequence on every retry/device for an Eastern calendar date, with Hubert (dark brown tabby/yellow eyes), Mack (brown tabby/green eyes), or Mia (light tabby/Siamese mix/blue eyes). Bests stay on the device under separate daily keys; daily runs never submit to the Classic leaderboard. A run keeps its starting day's course through midnight; New run picks up the new day.
- **Pause:** use the button, P, or Escape. Leaving the tab pauses an active run; returning requires Resume. Sound preference is saved on the device. Fullscreen keeps the play controls and score dialog available.

Tap or Space flaps; R restarts. Shortcuts pause in text fields. Firebase loads separately so unavailable leaderboard services do not stop local play. Existing Firebase collections and saved Classic bests are preserved.

Run `npm test` and `npm run check`. Serve this directory with a static server to preview. `?demo=1` disables Firebase connections, the play-counter increment, and online score writes for browser testing; local gameplay still works. GitHub Pages publishes the `main` branch directly.
