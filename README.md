# Counting down to you, Sofia

A pixel-art Christmas room counting down to **Saturday, December 19, 2026 at 7:00 PM in Toronto**.
Click the ornament with the arrow to open a surprise, which leads to **Sofia’s Christmas Run**.

Everything is static HTML, CSS and JavaScript, with art drawn on `<canvas>`. There's no build step, backend or paid service.

| File | What it is |
| --- | --- |
| `index.html`, `styles.css`, `script.js` | The countdown scene and the ornament popup |
| `game.html`, `game.css`, `game.js` | The runner game |
| `pixel.js` | Small pixel-art helpers shared by both pages |
| `src/clickable.jpg` | Photo shown in the popup |
| `src/head.png` | Sofia’s face for the game (transparent PNG) |

## Deploy to GitHub Pages

1. Commit and push to `main`:
   ```bash
   git add -A
   git commit -m "Christmas countdown and Sofia's Christmas Run"
   git push origin main
   ```
2. On GitHub, open **Settings → Pages**. Set **Source** to *Deploy from a branch*, then pick **main** and **/ (root)**.
3. After a minute the site is live at `https://alp-duras.github.io/`, and the game is at `/game.html`.

All paths are relative, so the same files also work from a project repository at `https://<user>.github.io/<repo>/`.

## Preview locally

```bash
python -m http.server 8765
```

Then open http://localhost:8765. To see the finale, add `?preview=5` to the URL. That counts down 5 seconds instead of to the real date.

## Changing things

- **Target time:** `TARGET_ISO` at the top of `script.js`. Keep the `-05:00` offset (Toronto in December).
- **Popup photo:** replace `src/clickable.jpg`. Any proportions work, and nothing gets cropped.
- **Game face:** `HEAD_SRC` in `game.js` sets the crop of `src/head.png`.
- **Best score:** saved in the browser's local storage on each device.
