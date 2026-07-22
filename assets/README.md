# Images

## What is here now

Each project card currently shows a generated **SVG line-art cover**
(`projects/*.svg`). These are deliberately diagrammatic — a cone track, a
costmap with an A\* path, a landmark mesh. They are *illustrations of the
problem*, not screenshots of your results, because a fabricated Grad-CAM
heatmap is something you would have to defend in an interview.

They are transparent, so they pick up the card background in both light and
dark themes, and they weigh a few KB each.

**Replace them with real captures as you get them.** A real RViz screenshot of
your costmap beats a drawing of one, every time.

## Swapping in a real image

Open `index.html`, find the card, and change the `src`:

```html
<!-- from -->
<img src="assets/projects/nav-stack.svg" alt="" loading="lazy" ...>
<!-- to -->
<img src="assets/projects/nav-stack.jpg" alt="" loading="lazy" ...>
```

Then drop `nav-stack.jpg` into `assets/projects/`. If the file is missing the
card falls back to a labelled placeholder naming what it wants — nothing breaks.

## What to shoot

| File | Card | Ideal size | What works |
|---|---|---|---|
| `headshot.jpg` | About | 800×1000 (4:5) | Rendered greyscale, full colour on hover. Face in the upper third. |
| `projects/racing.*` | Autonomous Racing Car (large) | 1400×875 | The widest card — your best image. The FS car, or RViz cone detection. |
| `projects/hsr.*` | Toyota HSR | 1400×875 | The HSR itself, or the YOLO detection overlay. |
| `projects/anomaly.*` | Anomaly Detection | 1400×875 | A real Grad-CAM heatmap over a defective part. |
| `projects/nav-stack.*` | ROS 2 Nav Stack | 1400×875 | RViz with the costmap and planned path visible. |
| `projects/humanoid.*` | Semi-Humanoid | 1400×875 | The robot mid-interaction with a person. |
| `projects/rosbridge.*` | ROSbridge Container | 1400×875 | Hardest to photograph — an architecture diagram works. |
| `projects/gps-boat.*` | GPS Surface Vehicle | 1400×875 | The boat on the water beats any screenshot. |

All cards crop to fill, centred, at 16:10. Nothing important at the very edge.

## PDFs

| File | Linked from |
|---|---|
| `Al_Shafi_VA_Resume.pdf` | The **Résumé** button in the nav |
| `Towards_Embodiment_Agnostic_Retargeting.pdf` | **Read the full paper** in the Research section |

Both are already here. When you update your résumé, overwrite
`Al_Shafi_VA_Resume.pdf` and the link keeps working.

## Want a video instead of a photo?

Swap the `<img>` for a `<video>` in `index.html`:

```html
<video src="assets/projects/racing.mp4" autoplay muted loop playsinline></video>
```

A ten-second loop of cone detection running will do more for you than any
screenshot. Keep it under ~3 MB — recruiters open these on hotel wifi.

## A note on file size

Before committing, run images through [squoosh.app](https://squoosh.app) or:

```bash
# needs imagemagick
mogrify -resize 1400x -quality 82 -format jpg projects/*.jpg
```

A 4 MB DSLR photo will make the page feel slow, which undoes the point of all
the animation work.
