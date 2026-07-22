#!/usr/bin/env python3
"""Generate technical line-art covers for the project cards.

Transparent background so they inherit the card surface in both themes.
Neutral grey linework + the site's signal blue for anything the system
'detects'. 16:10, sized to match the card aspect.
"""
import math, os

W, H = 1400, 875
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "projects")
GREY   = "#8A9099"
ACCENT = "#2F6BB0"
AMBER  = "#C08A2E"

def head(extra=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
            f'fill="none" stroke-linecap="round" stroke-linejoin="round">{extra}')

def grid(step=70, op=0.10):
    p = [f'<g stroke="{GREY}" stroke-width="1" opacity="{op}">']
    for x in range(0, W + 1, step):
        p.append(f'<path d="M{x} 0V{H}"/>')
    for y in range(0, H + 1, step):
        p.append(f'<path d="M0 {y}H{W}"/>')
    p.append("</g>")
    return "".join(p)

def dots(step=50, op=0.16):
    p = [f'<g fill="{GREY}" opacity="{op}">']
    for x in range(step, W, step):
        for y in range(step, H, step):
            p.append(f'<circle cx="{x}" cy="{y}" r="1.4"/>')
    p.append("</g>")
    return "".join(p)

def brackets(x, y, w, h, c=26, col=ACCENT, sw=2.6, op=1):
    return (f'<g stroke="{col}" stroke-width="{sw}" opacity="{op}">'
            f'<path d="M{x} {y+c}V{y}H{x+c}"/>'
            f'<path d="M{x+w-c} {y}H{x+w}V{y+c}"/>'
            f'<path d="M{x+w} {y+h-c}V{y+h}H{x+w-c}"/>'
            f'<path d="M{x+c} {y+h}H{x}V{y+h-c}"/></g>')

def label(x, y, text, col=ACCENT, size=22):
    return (f'<text x="{x}" y="{y}" fill="{col}" font-size="{size}" '
            f'font-family="ui-monospace,SFMono-Regular,Menlo,monospace" '
            f'letter-spacing="1">{text}</text>')

def zoom(body, s):
    """Scale content about the canvas centre so figures fill the frame."""
    return (f'<g transform="translate({W/2*(1-s):.1f} {H/2*(1-s):.1f}) scale({s})">'
            + body + "</g>")

def write(name, body):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w") as f:
        f.write(head() + body + "</svg>")
    print("wrote", name)


# ── 1. racing: cone track + optimal line ────────────────────────────────
def racing():
    def centre(t):                      # parametric track centreline
        x = 90 + t * (W - 180)
        y = H/2 + 190*math.sin(t*2.6) - 120*math.sin(t*1.1)
        return x, y

    pts = [centre(i/220) for i in range(221)]
    line = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)

    cones = []
    for i in range(0, 221, 14):
        x, y = pts[i]
        nx, ny = pts[min(i+1, 220)]
        dx, dy = nx - x, ny - y
        L = math.hypot(dx, dy) or 1
        px, py = -dy/L, dx/L                       # unit normal
        for side, col in ((1, ACCENT), (-1, AMBER)):
            cx, cy = x + px*135*side, y + py*135*side
            cones.append(
                f'<path d="M{cx:.0f} {cy-13:.0f}l11 22h-22z" fill="{col}" '
                f'opacity="0.85" stroke="none"/>')

    car_x, car_y = pts[6]
    rays = "".join(
        f'<path d="M{car_x:.0f} {car_y:.0f}L{car_x+math.cos(a)*300:.0f} '
        f'{car_y+math.sin(a)*300:.0f}" stroke="{ACCENT}" stroke-width="1" opacity="0.14"/>'
        for a in [(-0.6 + i*0.15) for i in range(9)])

    return (grid() + rays
            + f'<path d="{line}" stroke="{ACCENT}" stroke-width="3.4" opacity="0.9"/>'
            + "".join(cones)
            + f'<path d="M{car_x-16:.0f} {car_y-16:.0f}l34 16-34 16z" fill="{GREY}" stroke="none"/>'
            + label(90, H-52, "optimal trajectory")
            + label(W-250, 88, "cones · 32", GREY))


# ── 2. hsr: person + skeleton + detection box ───────────────────────────
def hsr():
    cx, cy = W/2 - 40, H/2
    kp = {  # rough COCO-ish keypoints
        "head": (cx, cy-215), "neck": (cx, cy-140),
        "lsh": (cx-78, cy-130), "rsh": (cx+78, cy-130),
        "lel": (cx-120, cy-20), "rel": (cx+128, cy-30),
        "lwr": (cx-138, cy+85), "rwr": (cx+196, cy-108),
        "hip": (cx, cy+40), "lhp": (cx-56, cy+45), "rhp": (cx+56, cy+45),
        "lkn": (cx-66, cy+190), "rkn": (cx+64, cy+190),
        "lan": (cx-72, cy+320), "ran": (cx+70, cy+320),
    }
    bones = [("head","neck"),("neck","lsh"),("neck","rsh"),("lsh","lel"),
             ("lel","lwr"),("rsh","rel"),("rel","rwr"),("neck","hip"),
             ("hip","lhp"),("hip","rhp"),("lhp","lkn"),("lkn","lan"),
             ("rhp","rkn"),("rkn","ran")]

    sk = "".join(
        f'<path d="M{kp[a][0]:.0f} {kp[a][1]:.0f}L{kp[b][0]:.0f} {kp[b][1]:.0f}" '
        f'stroke="{ACCENT}" stroke-width="2.6" opacity="0.75"/>' for a, b in bones)
    joints = "".join(
        f'<circle cx="{x:.0f}" cy="{y:.0f}" r="6" fill="{ACCENT}" stroke="none"/>'
        for x, y in kp.values())
    headc = f'<circle cx="{cx:.0f}" cy="{cy-235:.0f}" r="46" stroke="{ACCENT}" stroke-width="2.6" opacity="0.75"/>'

    # raised hand, gesture keypoints
    hx, hy = kp["rwr"]
    fingers = "".join(
        f'<path d="M{hx} {hy}L{hx+math.cos(a)*54:.0f} {hy+math.sin(a)*54:.0f}" '
        f'stroke="{ACCENT}" stroke-width="2" opacity="0.6"/>'
        f'<circle cx="{hx+math.cos(a)*54:.0f}" cy="{hy+math.sin(a)*54:.0f}" r="4.5" fill="{ACCENT}" stroke="none"/>'
        for a in (-2.3, -1.95, -1.6, -1.25, -0.85))

    return (dots() + headc + sk + joints + fingers
            + brackets(cx-215, cy-300, 470, 660)
            + label(cx-215, cy-315, "person · 0.98")
            + brackets(hx-72, hy-78, 150, 150, c=16, sw=2, op=0.85)
            + label(hx-72, hy-90, "hand", ACCENT, 18))


# ── 3. anomaly: part + localised defect contours ────────────────────────
def anomaly():
    px, py, pw, ph = 300, 210, 800, 470
    part = (f'<path d="M{px} {py+40}a40 40 0 0 1 40-40h{pw-160}l120 120v{ph-160}'
            f'a40 40 0 0 1 -40 40h{-(pw-40)}a40 40 0 0 1 -40-40z" '
            f'stroke="{GREY}" stroke-width="3" opacity="0.8"/>')
    fold = f'<path d="M{px+pw-120} {py}v120h120" stroke="{GREY}" stroke-width="3" opacity="0.5"/>'

    dx, dy = 640, 500
    rings = "".join(
        f'<ellipse cx="{dx}" cy="{dy}" rx="{28+i*26}" ry="{20+i*19}" '
        f'stroke="{ACCENT}" stroke-width="2" opacity="{0.62-i*0.09:.2f}"/>' for i in range(6))
    core = f'<ellipse cx="{dx}" cy="{dy}" rx="22" ry="16" fill="{ACCENT}" opacity="0.35" stroke="none"/>'

    scan = "".join(
        f'<path d="M{px+20} {py+40+i*44}h{pw-40}" stroke="{GREY}" stroke-width="1" opacity="0.13"/>'
        for i in range(10))

    return (grid(step=100, op=0.07) + part + fold + scan + rings + core
            + brackets(dx-190, dy-140, 380, 280)
            + label(dx-190, dy-155, "defect · 0.94")
            + label(px, py-40, "grad-cam", GREY))


# ── 4. nav-stack: costmap + A* path ─────────────────────────────────────
def nav():
    cell = 50
    cols, rows = W//cell, H//cell
    occ = {(6,4),(7,4),(8,4),(6,5),(7,5),(8,5),
           (14,8),(15,8),(16,8),(14,9),(15,9),(16,9),(14,10),(15,10),
           (20,3),(21,3),(20,4),(21,4),(22,4),
           (10,12),(11,12),(12,12),(11,13),(12,13),
           (24,10),(25,10),(24,11),(25,11)}
    infl = set()
    for (c, r) in occ:
        for dc in (-2,-1,0,1,2):
            for dr in (-2,-1,0,1,2):
                if (c+dc, r+dr) not in occ:
                    infl.add((c+dc, r+dr))

    g = [f'<g stroke="{GREY}" stroke-width="1" opacity="0.10">']
    for c in range(cols+1): g.append(f'<path d="M{c*cell} 0V{H}"/>')
    for r in range(rows+1): g.append(f'<path d="M0 {r*cell}H{W}"/>')
    g.append("</g>")

    inf = "".join(f'<rect x="{c*cell}" y="{r*cell}" width="{cell}" height="{cell}" '
                  f'fill="{ACCENT}" opacity="0.07" stroke="none"/>' for c, r in infl)
    obs = "".join(f'<rect x="{c*cell}" y="{r*cell}" width="{cell}" height="{cell}" '
                  f'fill="{GREY}" opacity="0.55" stroke="none"/>' for c, r in occ)

    path = [(2,14),(4,14),(4,11),(6,11),(6,9),(9,9),(9,6),(12,6),(12,3),
            (17,3),(17,6),(19,6),(19,9),(23,9),(23,14),(26,14)]
    d = "M" + " L".join(f"{c*cell+cell/2} {r*cell+cell/2}" for c, r in path)
    start = path[0]; goal = path[-1]

    return (g[0] + "".join(g[1:]) + inf + obs
            + f'<path d="{d}" stroke="{ACCENT}" stroke-width="4" opacity="0.95"/>'
            + f'<circle cx="{start[0]*cell+25}" cy="{start[1]*cell+25}" r="13" fill="{ACCENT}" stroke="none"/>'
            + f'<circle cx="{goal[0]*cell+25}" cy="{goal[1]*cell+25}" r="15" stroke="{ACCENT}" stroke-width="4"/>'
            + f'<circle cx="{goal[0]*cell+25}" cy="{goal[1]*cell+25}" r="5" fill="{ACCENT}" stroke="none"/>'
            + label(60, 70, "A* global plan")
            + label(60, 105, "inflation radius · 0.35 m", GREY, 18))


# ── 5. rosbridge: two graphs, one bridge ────────────────────────────────
def rosbridge():
    def node(x, y, r=34, col=GREY):
        return (f'<circle cx="{x}" cy="{y}" r="{r}" stroke="{col}" stroke-width="2.6" opacity="0.8"/>'
                f'<circle cx="{x}" cy="{y}" r="5" fill="{col}" stroke="none" opacity="0.8"/>')
    left  = [(190, 250), (150, 440), (230, 620)]
    right = [(1210, 250), (1250, 440), (1170, 620)]
    bx, by, bw, bh = 570, 355, 260, 165

    edges = ""
    for (x, y) in left:
        edges += f'<path d="M{x+40} {y}Q{(x+bx)/2} {y} {bx} {by+bh/2}" stroke="{GREY}" stroke-width="1.8" opacity="0.35" stroke-dasharray="6 7"/>'
    for (x, y) in right:
        edges += f'<path d="M{x-40} {y}Q{(x+bx+bw)/2} {y} {bx+bw} {by+bh/2}" stroke="{GREY}" stroke-width="1.8" opacity="0.35" stroke-dasharray="6 7"/>'

    flow = "".join(
        f'<circle cx="{bx-140+i*70}" cy="{by+bh/2}" r="4" fill="{ACCENT}" opacity="{0.9-i*0.16:.2f}" stroke="none"/>'
        for i in range(4))
    flow += "".join(
        f'<circle cx="{bx+bw+140-i*70}" cy="{by+bh/2}" r="4" fill="{ACCENT}" opacity="{0.9-i*0.16:.2f}" stroke="none"/>'
        for i in range(4))

    return (dots(60, 0.12) + edges
            + "".join(node(x, y) for x, y in left)
            + "".join(node(x, y) for x, y in right)
            + f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="18" '
              f'stroke="{ACCENT}" stroke-width="3"/>'
            + flow
            + label(bx+52, by+95, "bridge", ACCENT, 26)
            + label(120, 130, "ROS 1", GREY, 24)
            + label(1180, 130, "ROS 2", GREY, 24))


# ── 6. humanoid: face mesh + gesture ────────────────────────────────────
def humanoid():
    cx, cy = 520, 430
    face = (f'<path d="M{cx} {cy-190}c105 0 150 80 150 175s-70 195-150 195'
            f'-150-100-150-195 45-175 150-175z" stroke="{ACCENT}" stroke-width="2.6" opacity="0.8"/>')
    mesh = []
    for i in range(64):                       # landmark ring + interior
        a = i / 64 * math.tau
        rr = 118 + 30*math.cos(a*2)
        mesh.append((cx + math.cos(a)*rr*1.18, cy + math.sin(a)*rr*1.42))
    inner = [(cx-58, cy-40), (cx+58, cy-40), (cx, cy+10), (cx-40, cy+92),
             (cx+40, cy+92), (cx, cy+118), (cx-84, cy-8), (cx+84, cy-8)]
    pts = mesh + inner
    dotsvg = "".join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="3.6" fill="{ACCENT}" opacity="0.75" stroke="none"/>'
                     for x, y in pts)
    tri = ""
    for i in range(0, 64, 4):
        x1, y1 = mesh[i]; x2, y2 = mesh[(i+4) % 64]
        tri += f'<path d="M{x1:.0f} {y1:.0f}L{x2:.0f} {y2:.0f}" stroke="{ACCENT}" stroke-width="1.1" opacity="0.34"/>'
        tri += f'<path d="M{x1:.0f} {y1:.0f}L{cx} {cy}" stroke="{ACCENT}" stroke-width="1" opacity="0.13"/>'
    # No expression — this is a landmark mesh, not a face. Eyes and a nose
    # ridge are enough to orient it; a mouth curve turns it into a smiley.
    eyes = (f'<circle cx="{cx-58}" cy="{cy-40}" r="8" fill="{ACCENT}" stroke="none"/>'
            f'<circle cx="{cx+58}" cy="{cy-40}" r="8" fill="{ACCENT}" stroke="none"/>'
            f'<circle cx="{cx-58}" cy="{cy-40}" r="22" stroke="{ACCENT}" stroke-width="1.6" opacity="0.45"/>'
            f'<circle cx="{cx+58}" cy="{cy-40}" r="22" stroke="{ACCENT}" stroke-width="1.6" opacity="0.45"/>'
            f'<path d="M{cx} {cy-30}v52" stroke="{ACCENT}" stroke-width="1.6" opacity="0.45"/>'
            f'<path d="M{cx-30} {cy+96}h60" stroke="{ACCENT}" stroke-width="1.6" opacity="0.4"/>')

    # hand skeleton, right side
    hx, hy = 1080, 520
    palm = [(hx, hy), (hx-46, hy-30), (hx-16, hy-60), (hx+22, hy-66), (hx+58, hy-46)]
    hand = f'<path d="M{hx} {hy}m0 90a54 54 0 0 0 0-108" stroke="{GREY}" stroke-width="2" opacity="0.4"/>'
    for i, (px, py) in enumerate(palm):
        ln = 92 - abs(i - 2) * 16
        a = -1.9 + i * 0.34
        tx, ty = px + math.cos(a)*ln, py + math.sin(a)*ln
        mx, my = (px+tx)/2, (py+ty)/2
        hand += (f'<path d="M{px:.0f} {py:.0f}L{mx:.0f} {my:.0f}L{tx:.0f} {ty:.0f}" '
                 f'stroke="{ACCENT}" stroke-width="2.4" opacity="0.8"/>'
                 f'<circle cx="{px:.0f}" cy="{py:.0f}" r="5" fill="{ACCENT}" stroke="none"/>'
                 f'<circle cx="{mx:.0f}" cy="{my:.0f}" r="4" fill="{ACCENT}" stroke="none"/>'
                 f'<circle cx="{tx:.0f}" cy="{ty:.0f}" r="5" fill="{ACCENT}" stroke="none"/>')

    return (dots(56, 0.12) + face + tri + dotsvg + eyes + hand
            + brackets(cx-210, cy-230, 420, 480, c=22, sw=2.2)
            + label(cx-210, cy-248, "face · 0.99")
            + label(hx-90, hy-160, "gesture · open palm", ACCENT, 18))


# ── 7. gps boat: waypoints + heading ────────────────────────────────────
def gps():
    waves = "".join(
        f'<path d="M0 {120+i*95}q70 -22 140 0t140 0 140 0 140 0 140 0 140 0 140 0 140 0 140 0 140 0" '
        f'stroke="{GREY}" stroke-width="1.6" opacity="0.13"/>' for i in range(8))

    wps = [(170, 640), (400, 480), (660, 560), (900, 360), (1140, 430), (1290, 250)]
    track = "M" + " L".join(f"{x} {y}" for x, y in wps)
    marks = "".join(
        f'<circle cx="{x}" cy="{y}" r="16" stroke="{ACCENT}" stroke-width="2.6" opacity="0.9"/>'
        f'<circle cx="{x}" cy="{y}" r="4" fill="{ACCENT}" stroke="none"/>' for x, y in wps)
    nums = "".join(label(x-6, y-30, f"{i+1}", GREY, 18) for i, (x, y) in enumerate(wps))

    bx, by = 660, 560
    ang = math.atan2(360-by, 900-bx)
    heading = (f'<path d="M{bx} {by}L{bx+math.cos(ang)*180:.0f} {by+math.sin(ang)*180:.0f}" '
               f'stroke="{ACCENT}" stroke-width="3" stroke-dasharray="9 8"/>')
    boat = (f'<g transform="rotate({math.degrees(ang):.1f} {bx} {by})">'
            f'<path d="M{bx-34} {by-20}l68 20-68 20z" fill="{GREY}" stroke="none" opacity="0.85"/></g>')
    rose = (f'<g stroke="{GREY}" stroke-width="1.6" opacity="0.35">'
            f'<circle cx="1230" cy="700" r="62"/><path d="M1230 626v148M1156 700h148"/></g>'
            + label(1214, 618, "N", GREY, 18))

    return (waves
            + f'<path d="{track}" stroke="{ACCENT}" stroke-width="2.4" opacity="0.45" stroke-dasharray="10 9"/>'
            + heading + marks + nums + boat + rose
            + label(90, 100, "waypoint tracking")
            + label(90, 135, "hdg 038° · xte 0.4 m", GREY, 18))


write("racing.svg",    racing())
write("hsr.svg",       dots() + zoom(hsr().split("</g>", 1)[1], 1.20))
write("anomaly.svg",   anomaly())
write("nav-stack.svg", nav())
write("rosbridge.svg", rosbridge())
write("humanoid.svg",  dots(56, 0.12) + zoom(humanoid().split("</g>", 1)[1], 1.14))
write("gps-boat.svg",  gps())
