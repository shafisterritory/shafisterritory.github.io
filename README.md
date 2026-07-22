# Al Shafi V A — portfolio

A single-page portfolio. No build step, no `npm install`, no dependencies.
Open `index.html` in a browser and it works.

```
index.html          all the content — edit text here
css/style.css       design tokens at the top, then sections
js/lidar.js         the hero: a real 2D LiDAR simulation
js/main.js          reveals, nav, filters, tabs, counters
assets/             your images and PDFs — see assets/README.md
```

## Run it locally

Double-clicking `index.html` works, but the PDFs behave better over HTTP:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploy

**GitHub Pages** — push this folder to a repo, then Settings → Pages → deploy
from `main`, root. Naming the repo `shafisterritory.github.io` puts it at that
URL directly.

```bash
git init && git add . && git commit -m "portfolio"
git remote add origin git@github.com:shafisterritory/shafisterritory.github.io.git
git push -u origin main
```

**Custom domain** — add a file named `CNAME` containing just `alshafi.dev`
(or whatever you buy), point an ALIAS/CNAME record at `shafisterritory.github.io`,
and tick "Enforce HTTPS". Worth the €10/year on a CV.

**Vercel / Netlify** — drag the folder onto their dashboard. No config; there is
nothing to build.

## What to change first

- **Add your images.** Read `assets/README.md`. Every card currently shows a
  placeholder naming the file it wants. The racing card is the largest — put
  your best image there.
- **The "open to 2026 roles" line** in the hero, and the availability sentence
  in the Contact section. Update these when your situation changes; a recruiter
  reads them first.
- **`<meta name="description">`** in the `<head>` — this is what shows up in
  Google and in link previews.

## Notes on how it is built

**The hero** is a genuine 2D LiDAR simulation, not a video or a canned
animation. A sensor sweeps a beam through 360°; each frame casts rays across
the arc just crossed, intersects them against the room geometry (ray–segment
and ray–circle), and keeps the returns for ~3 seconds while they fade. Two
obstacles move — one drifts on a Lissajous, one tracks your cursor. Returns
that land on the cursor get clustered and boxed, and the live point and
cluster counts are what the readout in the corner is actually displaying.

Sensor range is deliberately twice the range-ring radius, because the far
corners of the room sit at ~1.9× that radius; clip the range to the rings and
the walls stop returning anything.

**Motion.** Every transition uses `cubic-bezier(0.16, 1, 0.3, 1)` — a slow,
confident settle. Nothing uses the browser default `ease`, and nothing moves
linearly. This is most of what separates a page that feels expensive from one
that does not.

**Performance.** The canvas stops rendering when the hero scrolls out of view
or the tab is hidden. Reveals fire once via `IntersectionObserver` and then
unobserve themselves. Scroll work is throttled through `requestAnimationFrame`.

**Accessibility.** Full keyboard support including arrow-key navigation on the
research tabs, a skip link, visible focus rings, and `prefers-reduced-motion`
honoured — under which the LiDAR renders one static scan instead of animating,
and nothing that carries content depends on an animation to become visible.

**Printing.** `Ctrl+P` produces a clean document: the canvas, nav, ribbon and
filters drop out, the dark section inverts to black on white, and external
links print their URLs. Recruiters do print these.

## Verified

Rendered and checked in Chrome at 485 / 545 / 885 / 1425 px. No horizontal
overflow at any width, no console errors, light and dark both pass, and the
project filters and research tabs were exercised programmatically — the filter
counts on the chips match the number of cards each one actually shows.
