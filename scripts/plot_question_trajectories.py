"""
Question-trajectory charts: pre/post context-rating plots, one pair per learner.

Reads every value from data/question_ratings.csv — nothing about the cohort,
the turn counts or the ratings is hard-coded here.

Usage:
    python scripts/plot_question_trajectories.py                # verify, then plot
    python scripts/plot_question_trajectories.py --animate      # also write GIFs
    python scripts/plot_question_trajectories.py --verify-only  # verify, then stop

Encoding
    y position   rating band: 1, 2 (2a/2b), 3 (3a/3b)
    shape        "a" variants and rating 1 are circles; "b" variants are squares
    fill         rating 1 is hollow; every other rating is filled
    phase        pre-test is dashed and grey; post-test is solid and oxide red

The lens_1 / lens_2 columns are deliberately ignored — the charts carry no
lens colouring.

Animation
    Each line is an ordered list of PointSpec and all drawing goes through
    draw_trajectory(), so --animate simply calls it with progressively longer
    slices. The GIFs are written without a Netscape loop block, so they draw
    themselves once and then hold the finished chart.
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
import textwrap
from collections import Counter, OrderedDict
from dataclasses import dataclass
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from PIL import Image

# ── paths ──────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = REPO_ROOT / "data" / "question_ratings.csv"
QUESTIONS_FILE = REPO_ROOT / "data" / "tour_questions.csv"
OUT_DIR = REPO_ROOT / "output" / "charts"

# ── palette ────────────────────────────────────────────────────────────────
# Oxide red: the Provenance brand mark colour. It is a bare hex literal in the
# repo rather than a CSS custom property — see the logo fill in
# public/brand/provenance-mark.svg and src/components/onboarding/AnimatedMark.tsx.
# NB: this is *not* the --th-primary token in src/app/globals.css, which is the
# cranberry #8B2538.
OXIDE_RED = "#A33829"

NEUTRAL = "#898781"        # pre-test markers
PRE_LINE_GREY = "#B4B2AC"  # pre-test connecting line
MARKER_HALO = "white"      # edge stroke separating overlapping points
GRID_GREY = "#E4E2DD"      # the three horizontal rules
AXIS_GREY = "#5A5852"      # spines, ticks, labels

# ── encoding ───────────────────────────────────────────────────────────────
RATING_ORDER = ["1", "2a", "2b", "3a", "3b"]
RATING_Y = {"1": 1, "2a": 2, "2b": 2, "3a": 3, "3b": 3}
RATING_MARKER = {"1": "o", "2a": "o", "2b": "s", "3a": "o", "3b": "s"}
HOLLOW_RATINGS = {"1"}

PHASE_ORDER = ["pre", "post"]
PHASE_LABEL = {"pre": "Pre-test", "post": "Post-test"}

MARKER_SIZE = 12.5
LINE_WIDTH = 1.0
EDGE_WIDTH = 1.5           # white stroke around every marker
HALO_WIDTH = 3.4           # wider white ring under hollow markers
STACKED_LEARNER = "Learner 2"

# ── animation ──────────────────────────────────────────────────────────────
# Matches the static PNG dpi so the last frame and the still are the same size.
GIF_DPI = 300
STEPS_PER_SEGMENT = 4      # interpolated frames between consecutive turns
FRAME_MS = 50              # per-frame delay
FIRST_FRAME_MS = 400       # brief settle before the line starts moving
LAYER_HOLD_MS = 600        # pause after each phase finishes drawing
TYPE_CHARS_PER_FRAME = 3   # footer typing speed
TYPE_FRAME_MS = 45
STATIC_DPI = 300
BBOX_PAD_IN = 0.1          # matplotlib's own default for bbox_inches="tight"

# ── tour-question footer ───────────────────────────────────────────────────
FOOTER_SIZE = 11.5
FOOTER_GAP = 0.055         # figure fractions between the x-label and the footer
FOOTER_LINESPACING = 1.5
FOOTER_CHAR_IN = 0.082     # rough advance width, used only to choose a wrap column

# ── typography ─────────────────────────────────────────────────────────────
plt.rcParams.update(
    {
        "font.family": "serif",
        "font.serif": ["Charter", "Georgia", "Times New Roman", "DejaVu Serif"],
        "axes.labelsize": 13,
        "axes.titlesize": 15,
        "xtick.labelsize": 11.5,
        "ytick.labelsize": 11.5,
        "legend.fontsize": 11.5,
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        "savefig.facecolor": "white",
    }
)


# ── point specs & phase styling ────────────────────────────────────────────
@dataclass(frozen=True)
class PointSpec:
    """One plotted question turn — everything needed to draw it, and nothing else."""

    turn: int
    y: int
    marker: str      # 'o' or 's'
    hollow: bool     # rating 1: white fill, phase-coloured edge


@dataclass(frozen=True)
class PhaseStyle:
    """How one phase's line and markers are drawn."""

    colour: str          # marker fill (and hollow-marker edge)
    line_colour: str
    linestyle: object    # matplotlib dash spec
    opacity: float


PRE_STYLE = PhaseStyle(
    colour=NEUTRAL,
    line_colour=PRE_LINE_GREY,
    linestyle=(0, (4, 2.5)),   # dashed
    opacity=0.5,
)
POST_STYLE = PhaseStyle(
    colour=OXIDE_RED,
    line_colour=OXIDE_RED,
    linestyle="-",             # solid
    opacity=1.0,
)

# Draw order: pre line, pre markers, post line, post markers. Each phase's line
# sits beneath its own markers; the post-test layer sits above the pre-test one.
PHASE_ZORDER = {"pre": 1, "post": 3}


@dataclass
class Layer:
    """One phase drawn on one axes — the unit both static and animated output use."""

    ax: object
    points: list
    style: PhaseStyle
    zorder: int
    # False = present in full from the first frame, as context rather than motion.
    animate: bool = True


def build_points(rows: list) -> list:
    """Turn CSV rows for one learner+phase into an ordered list of PointSpec."""
    points = []
    for row in sorted(rows, key=lambda r: r["turn"]):
        rating = row["rating"]
        points.append(
            PointSpec(
                turn=row["turn"],
                y=RATING_Y[rating],
                marker=RATING_MARKER[rating],
                hollow=rating in HOLLOW_RATINGS,
            )
        )
    return points


# ── drawing ────────────────────────────────────────────────────────────────
def draw_trajectory(
    ax,
    points: list,
    style: PhaseStyle,
    opacity: float | None = None,
    zorder: int = 1,
    tail: tuple | None = None,
) -> list:
    """
    Draw one trajectory: the connecting line with its markers on top.

    `tail` is an optional (x, y) appended to the line but given no marker — it
    is how a partially drawn segment reaches past the last completed turn.

    Returns the artists it created, in draw order. This is the single entry
    point for rendering a line: an animation calls it with growing slices of
    `points`, removing the previous frame's artists in between.
    """
    alpha = style.opacity if opacity is None else opacity
    artists = []

    xs = [p.turn for p in points]
    ys = [p.y for p in points]
    if tail is not None:
        xs.append(tail[0])
        ys.append(tail[1])

    if len(xs) > 1:
        (line,) = ax.plot(
            xs,
            ys,
            color=style.line_colour,
            linestyle=style.linestyle,
            linewidth=LINE_WIDTH,
            alpha=alpha,
            zorder=zorder,
            solid_capstyle="round",
            dash_capstyle="round",
        )
        artists.append(line)

    for point in points:
        artists.extend(_draw_marker(ax, point, style, alpha, zorder + 1))

    return artists


def _draw_marker(ax, point: PointSpec, style: PhaseStyle, alpha: float, zorder: int) -> list:
    """
    One marker. Filled markers are phase-coloured with a white edge; hollow
    (rating 1) markers are white-filled with a phase-coloured ring, sitting on a
    wider white halo so the edge stroke still separates overlapping points.
    """
    common = dict(
        marker=point.marker,
        linestyle="none",
        markersize=MARKER_SIZE,
        alpha=alpha,
        clip_on=False,
    )

    if not point.hollow:
        (artist,) = ax.plot(
            point.turn,
            point.y,
            markerfacecolor=style.colour,
            markeredgecolor=MARKER_HALO,
            markeredgewidth=EDGE_WIDTH,
            zorder=zorder,
            **common,
        )
        return [artist]

    (halo,) = ax.plot(
        point.turn,
        point.y,
        markerfacecolor="white",
        markeredgecolor=MARKER_HALO,
        markeredgewidth=HALO_WIDTH,
        zorder=zorder,
        **common,
    )
    (ring,) = ax.plot(
        point.turn,
        point.y,
        markerfacecolor="white",
        markeredgecolor=style.colour,
        markeredgewidth=EDGE_WIDTH,
        zorder=zorder + 0.1,
        **common,
    )
    return [halo, ring]


def phase_handle(style: PhaseStyle, size: float = MARKER_SIZE) -> Line2D:
    """A legend proxy showing one phase's line and marker treatment."""
    return Line2D(
        [],
        [],
        color=style.line_colour,
        linestyle=style.linestyle,
        linewidth=LINE_WIDTH,
        marker="o",
        markerfacecolor=style.colour,
        markeredgecolor=MARKER_HALO,
        markeredgewidth=EDGE_WIDTH,
        markersize=size,
        alpha=style.opacity,
    )


# ── tour-question footer ───────────────────────────────────────────────────
@dataclass
class Footer:
    """The learner's tour question(s), typeset beneath the chart."""

    text: str        # already wrapped; newlines are the line breaks
    x: float         # figure fraction, aligned to the axes' left spine
    y: float         # figure fraction, top of the text block


def load_questions(path: Path) -> dict:
    """{learner: [(seq, question, rating)]}, each learner's list in seq order."""
    if not path.exists():
        print(f"! {path} not found - charts will carry no tour question.")
        return {}

    by_learner: dict = {}
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        missing = {"learner", "seq", "question", "rating"} - set(reader.fieldnames or [])
        if missing:
            sys.exit(f"{path} is missing column(s): {', '.join(sorted(missing))}")

        for lineno, raw in enumerate(reader, start=2):
            learner = (raw["learner"] or "").strip()
            question = (raw["question"] or "").strip()
            if not learner or not question:
                continue
            try:
                seq = int((raw["seq"] or "").strip())
            except ValueError:
                sys.exit(f'{path}:{lineno}: non-integer seq "{raw["seq"]}"')
            by_learner.setdefault(learner, []).append((seq, question, (raw["rating"] or "").strip()))

    for entries in by_learner.values():
        entries.sort(key=lambda e: e[0])
    return by_learner


def footer_text(entries: list, fig_width: float) -> str:
    """
    Wrap the tour question(s) to the figure width. A learner with more than one
    question gets them numbered; a single question needs no number.
    """
    columns = max(40, int(0.87 * fig_width / FOOTER_CHAR_IN))
    numbered = len(entries) > 1
    lines = []

    for index, (_, question, rating) in enumerate(entries, start=1):
        label = f"Tour question {index}" if numbered else "Tour question"
        if rating:
            label += f" (rated {rating})"
        lines.append(
            textwrap.fill(
                f'{label}: "{question}"',
                width=columns,
                subsequent_indent="    ",   # hanging indent under the label
            )
        )
    return "\n".join(lines)


def place_footer(fig, ax, text: str) -> Footer:
    """Anchor the footer below everything the axes occupies, incl. the x-label."""
    fig.canvas.draw()
    extent = ax.get_tightbbox(fig.canvas.get_renderer()).transformed(fig.transFigure.inverted())
    return Footer(text=text, x=ax.get_position().x0, y=extent.y0 - FOOTER_GAP)


def draw_footer(fig, footer: Footer, chars: int | None = None):
    """
    Render the footer, optionally truncated to the first `chars` characters —
    that prefix is the whole typing animation. Top-anchored, so the block grows
    downward into space the fixed crop box already accounts for.
    """
    if footer is None:
        return []
    visible = footer.text if chars is None else footer.text[:chars]
    if not visible:
        return []
    return [
        fig.text(
            footer.x,
            footer.y,
            visible,
            ha="left",
            va="top",
            fontsize=FOOTER_SIZE,
            color=AXIS_GREY,
            linespacing=FOOTER_LINESPACING,
        )
    ]


def add_phase_legend(ax) -> None:
    """Sits above the axes, so it can never collide with a dense trajectory."""
    ax.legend(
        [phase_handle(PRE_STYLE, MARKER_SIZE * 0.8), phase_handle(POST_STYLE, MARKER_SIZE * 0.8)],
        [PHASE_LABEL["pre"], PHASE_LABEL["post"]],
        loc="lower right",
        bbox_to_anchor=(1.0, 1.005),
        ncol=2,
        frameon=False,
        handletextpad=0.6,
        columnspacing=1.8,
        labelcolor=AXIS_GREY,
    )


# ── figure scaffolding ─────────────────────────────────────────────────────
def figure_width(max_turn: int) -> float:
    """Width that keeps the turn axis legible at print size."""
    return min(9.0, max(5.2, 1.7 + 0.45 * max_turn))


def style_axes(ax, max_turn: int, title: str | None = None, xlabel: bool = True, ylabel: bool = True) -> None:
    if xlabel:
        ax.set_xlabel("Question Turn", labelpad=8, color=AXIS_GREY)
    if ylabel:
        ax.set_ylabel("Context Rating Scale for Inquiries", labelpad=10, color=AXIS_GREY)
    if title:
        # Left-aligned title keeps the top-right clear for the phase legend.
        ax.set_title(title, loc="left", pad=14, color=AXIS_GREY)

    ax.set_xlim(0.5, max_turn + 0.5)
    ax.set_xticks(range(1, max_turn + 1))
    ax.set_ylim(0.7, 3.3)
    ax.set_yticks([1, 2, 3])

    # Light horizontal rules at the three bands; no other gridlines.
    ax.set_axisbelow(True)
    ax.yaxis.grid(True, color=GRID_GREY, linewidth=0.9)
    ax.xaxis.grid(False)

    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(AXIS_GREY)
        ax.spines[side].set_linewidth(0.9)

    ax.tick_params(colors=AXIS_GREY, length=4, width=0.9)


# ── chart builders ─────────────────────────────────────────────────────────
# Each returns (fig, layers, footer) with the axes fully styled but no
# trajectory drawn. render_static() and render_gif() consume the same triple.
def build_pre(learner: str, pre: list):
    max_turn = max(p.turn for p in pre)
    fig, ax = plt.subplots(figsize=(figure_width(max_turn), 3.7))
    style_axes(ax, max_turn, title=learner)
    return fig, [Layer(ax, pre, PRE_STYLE, PHASE_ZORDER["pre"])], None


def build_prepost(learner: str, pre: list, post: list, questions: list = ()):
    max_turn = max(p.turn for p in pre + post)
    width = figure_width(max_turn)
    fig, ax = plt.subplots(figsize=(width, 3.7))
    style_axes(ax, max_turn, title=learner)
    add_phase_legend(ax)

    footer = place_footer(fig, ax, footer_text(questions, width)) if questions else None

    return fig, [
        Layer(ax, pre, PRE_STYLE, PHASE_ZORDER["pre"], animate=False),
        Layer(ax, post, POST_STYLE, PHASE_ZORDER["post"]),
    ], footer


def build_stacked(learner: str, pre: list, post: list):
    """Two panels sharing the x-axis: pre-test above, post-test below."""
    max_turn = max(p.turn for p in pre + post)
    fig, (ax_pre, ax_post) = plt.subplots(
        2,
        1,
        figsize=(figure_width(max_turn), 6.0),
        sharex=True,
        gridspec_kw={"hspace": 0.28},
    )

    style_axes(ax_pre, max_turn, title=PHASE_LABEL["pre"], xlabel=False, ylabel=False)
    style_axes(ax_post, max_turn, title=PHASE_LABEL["post"], ylabel=False)
    # Panel labels sit a step below the learner name in the hierarchy.
    for ax in (ax_pre, ax_post):
        ax.title.set_fontsize(13)

    # One shared y-label rather than the long string repeated on both panels.
    fig.supylabel("Context Rating Scale for Inquiries", fontsize=13, color=AXIS_GREY, x=0.02)
    fig.suptitle(learner, fontsize=15, color=AXIS_GREY, x=0.125, y=1.005, ha="left")

    return fig, [
        Layer(ax_pre, pre, PRE_STYLE, PHASE_ZORDER["pre"], animate=False),
        Layer(ax_post, post, POST_STYLE, PHASE_ZORDER["pre"]),
    ], None


def settled_bbox(fig):
    """
    The crop box of the finished chart. Static saves and animation frames both
    use it, so the last frame of a GIF lands on the same pixels as the still.
    """
    fig.canvas.draw()
    return fig.get_tightbbox(fig.canvas.get_renderer()).padded(BBOX_PAD_IN)


def render_static(fig, layers: list, footer, stem: Path) -> None:
    for layer in layers:
        draw_trajectory(layer.ax, layer.points, layer.style, zorder=layer.zorder)
    draw_footer(fig, footer)
    bbox = settled_bbox(fig)
    for suffix in ("png", "svg"):
        fig.savefig(stem.with_suffix(f".{suffix}"), dpi=STATIC_DPI, bbox_inches=bbox)
    plt.close(fig)


# ── animation ──────────────────────────────────────────────────────────────
def trajectory_states(points: list):
    """
    Progressive (visible_points, tail) states for one trajectory: the first
    marker alone, then the line growing turn by turn with a marker landing each
    time a turn is reached.
    """
    yield points[:1], None
    for i in range(len(points) - 1):
        a, b = points[i], points[i + 1]
        for step in range(1, STEPS_PER_SEGMENT + 1):
            f = step / STEPS_PER_SEGMENT
            if step == STEPS_PER_SEGMENT:
                yield points[: i + 2], None
            else:
                tail = (a.turn + (b.turn - a.turn) * f, a.y + (b.y - a.y) * f)
                yield points[: i + 1], tail


def _capture(fig, bbox) -> Image.Image:
    """Render the figure to a PIL image at a fixed crop, so frames all match."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=GIF_DPI, bbox_inches=bbox)
    buf.seek(0)
    return Image.open(buf).convert("RGB")


def render_gif(fig, layers: list, footer, path: Path) -> None:
    """
    Draw the animated layers on in turn, then type the tour question out
    beneath them, and write a GIF that plays once. Layers already completed
    stay fully drawn while the next one grows.
    """
    # Draw the finished chart once — trajectories and the complete footer — to
    # fix the crop box. Every frame then renders at identical dimensions, so
    # the animation cannot jitter and the last frame matches the static PNG.
    settled = [draw_trajectory(l.ax, l.points, l.style, zorder=l.zorder) for l in layers]
    settled.append(draw_footer(fig, footer))
    bbox = settled_bbox(fig)
    for artists in settled:
        for artist in artists:
            artist.remove()

    # Static layers are context: drawn in full from the first frame onward.
    static = [l for l in layers if not l.animate]
    moving = [l for l in layers if l.animate]

    frames, durations = [], []

    def capture(drawn, delay):
        frames.append(_capture(fig, bbox))
        durations.append(delay)
        for artist in drawn:
            artist.remove()

    for index, layer in enumerate(moving):
        for visible, tail in trajectory_states(layer.points):
            drawn = []
            for done in static + moving[:index]:
                drawn += draw_trajectory(done.ax, done.points, done.style, zorder=done.zorder)
            drawn += draw_trajectory(
                layer.ax, visible, layer.style, zorder=layer.zorder, tail=tail
            )
            capture(drawn, FRAME_MS)
        durations[-1] += LAYER_HOLD_MS   # let each finished phase settle

    # Then the question types itself out, with every trajectory now complete.
    if footer:
        for chars in range(TYPE_CHARS_PER_FRAME, len(footer.text) + TYPE_CHARS_PER_FRAME, TYPE_CHARS_PER_FRAME):
            drawn = []
            for done in static + moving:
                drawn += draw_trajectory(done.ax, done.points, done.style, zorder=done.zorder)
            drawn += draw_footer(fig, footer, chars=chars)
            capture(drawn, TYPE_FRAME_MS)

    plt.close(fig)
    durations[0] = FIRST_FRAME_MS

    # One shared palette taken from the final frame keeps colours from shifting
    # frame to frame; no dithering keeps the flat white background clean.
    master = frames[-1].quantize(colors=128)
    quantized = [f.quantize(palette=master, dither=Image.Dither.NONE) for f in frames]

    # No `loop` argument: Pillow then omits the Netscape looping block entirely,
    # which is what makes the GIF play through once and stop on the last frame.
    quantized[0].save(
        path,
        save_all=True,
        append_images=quantized[1:],
        duration=durations,
        optimize=True,
        disposal=1,
    )

    if b"NETSCAPE2.0" in path.read_bytes():
        print(f"! {path.name}: a loop block was written - this GIF will repeat.")


# ── standalone legend ──────────────────────────────────────────────────────
def plot_legend(out_dir: Path) -> None:
    """A standalone key: marker shapes, hollow vs filled, and the two phases."""
    fig, (ax_shape, ax_phase) = plt.subplots(1, 2, figsize=(9.4, 2.2))
    for ax in (ax_shape, ax_phase):
        ax.axis("off")

    def marker(**kwargs):
        base = dict(linestyle="none", markersize=MARKER_SIZE, color="none")
        return Line2D([], [], **{**base, **kwargs})

    shape_handles = [
        (
            marker(marker="o", markerfacecolor="white", markeredgecolor=NEUTRAL, markeredgewidth=EDGE_WIDTH),
            "Rating 1 — hollow circle",
        ),
        (
            marker(marker="o", markerfacecolor=NEUTRAL, markeredgecolor=MARKER_HALO, markeredgewidth=EDGE_WIDTH),
            "Ratings 2a / 3a — filled circle",
        ),
        (
            marker(marker="s", markerfacecolor=NEUTRAL, markeredgecolor=MARKER_HALO, markeredgewidth=EDGE_WIDTH),
            "Ratings 2b / 3b — filled square",
        ),
    ]
    phase_handles = [
        (phase_handle(PRE_STYLE), PHASE_LABEL["pre"]),
        (phase_handle(POST_STYLE), PHASE_LABEL["post"]),
    ]

    for ax, handles, title in (
        (ax_shape, shape_handles, "Rating & marker"),
        (ax_phase, phase_handles, "Phase"),
    ):
        legend = ax.legend(
            [h for h, _ in handles],
            [t for _, t in handles],
            loc="upper left",
            frameon=False,
            title=title,
            handletextpad=0.8,
            labelspacing=0.9,
            labelcolor=AXIS_GREY,
        )
        legend.get_title().set_color(AXIS_GREY)
        legend.get_title().set_fontsize(12.5)

    for suffix in ("png", "svg"):
        fig.savefig(out_dir / f"legend.{suffix}", dpi=300, bbox_inches="tight")
    plt.close(fig)


def slug(name: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in name.strip().lower()).strip("_")


# ── data ───────────────────────────────────────────────────────────────────
def load_rows(path: Path) -> list:
    if not path.exists():
        sys.exit(f"Data file not found: {path}")

    rows = []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        # lens_1 / lens_2 may be present but are not read.
        missing = {"learner", "phase", "turn", "rating"} - set(reader.fieldnames or [])
        if missing:
            sys.exit(f"{path} is missing column(s): {', '.join(sorted(missing))}")

        for lineno, raw in enumerate(reader, start=2):
            learner = (raw["learner"] or "").strip()
            if not learner:
                continue  # trailing blank line

            phase = (raw["phase"] or "").strip().lower()
            rating = (raw["rating"] or "").strip().lower()
            if phase not in PHASE_ORDER:
                sys.exit(f'{path}:{lineno}: unknown phase "{raw["phase"]}"')
            if rating not in RATING_Y:
                sys.exit(f'{path}:{lineno}: unknown rating "{raw["rating"]}"')
            try:
                turn = int((raw["turn"] or "").strip())
            except ValueError:
                sys.exit(f'{path}:{lineno}: non-integer turn "{raw["turn"]}"')

            rows.append({"learner": learner, "phase": phase, "turn": turn, "rating": rating})
    return rows


def group(rows: list) -> "OrderedDict":
    """{learner: {phase: [rows]}} — learners in first-appearance order."""
    grouped: OrderedDict = OrderedDict()
    for row in rows:
        grouped.setdefault(row["learner"], {}).setdefault(row["phase"], []).append(row)
    return grouped


def verify(grouped: "OrderedDict", path: Path) -> None:
    """Print per learner and phase: turn count and the count of each rating."""
    print(f"\nVerification - {path}")
    header = f'{"Learner":<14}{"Phase":<7}{"Turns":>6}' + "".join(f"{r:>6}" for r in RATING_ORDER)
    print(header)
    print("-" * len(header))

    totals: Counter = Counter()
    total_turns = 0

    for learner, phases in grouped.items():
        for phase in PHASE_ORDER:
            rows = phases.get(phase)
            if not rows:
                print(f"{learner:<14}{phase:<7}{'-':>6}" + "".join(f"{'-':>6}" for _ in RATING_ORDER))
                continue

            counts = Counter(r["rating"] for r in rows)
            totals.update(counts)
            total_turns += len(rows)
            print(
                f"{learner:<14}{phase:<7}{len(rows):>6}"
                + "".join(f"{counts.get(r, 0):>6}" for r in RATING_ORDER)
            )

            turns = sorted(r["turn"] for r in rows)
            if turns != list(range(1, len(turns) + 1)):
                print(f"    ! {learner} {phase}: turns are not 1..{len(turns)} - got {turns}")

    print("-" * len(header))
    print(
        f'{"All":<14}{"":<7}{total_turns:>6}' + "".join(f"{totals.get(r, 0):>6}" for r in RATING_ORDER)
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, default=DATA_FILE, help="input CSV")
    parser.add_argument("--questions", type=Path, default=QUESTIONS_FILE, help="tour-question CSV")
    parser.add_argument("--out", type=Path, default=OUT_DIR, help="output directory")
    parser.add_argument("--verify-only", action="store_true", help="print the table and stop")
    parser.add_argument("--animate", action="store_true", help="also write play-once GIFs")
    args = parser.parse_args()

    rows = load_rows(args.data)
    grouped = group(rows)
    verify(grouped, args.data)

    if args.verify_only:
        print("\n--verify-only: stopping before plotting.")
        return

    args.out.mkdir(parents=True, exist_ok=True)
    all_questions = load_questions(args.questions)
    written = 0

    for learner, phases in grouped.items():
        pre = build_points(phases.get("pre", []))
        post = build_points(phases.get("post", []))

        if not pre:
            print(f"! {learner}: no pre-test rows - skipping both charts.")
            continue

        # Only the pre/post overlay is animated: it is the one that carries the
        # tour question, and the only chart that tells a before/after story.
        charts = [(f"{slug(learner)}_pre", lambda: build_pre(learner, pre), False)]
        if post:
            questions = all_questions.get(learner, [])
            charts.append(
                (f"{slug(learner)}_prepost", lambda: build_prepost(learner, pre, post, questions), True)
            )
            if learner == STACKED_LEARNER:
                charts.append((f"{slug(learner)}_stacked", lambda: build_stacked(learner, pre, post), False))
            if not questions:
                print(f"! {learner}: no tour question in {args.questions.name}.")
        else:
            print(f"! {learner}: no post-test rows - pre-only chart written.")

        for name, build, animated in charts:
            fig, layers, footer = build()
            render_static(fig, layers, footer, args.out / name)
            written += 2
            if args.animate and animated:
                fig, layers, footer = build()   # a fresh figure for the frames
                render_gif(fig, layers, footer, args.out / f"{name}.gif")
                written += 1
                print(f"  {name}.gif")

    plot_legend(args.out)
    written += 2

    print(f"\nWrote {written} files to {args.out}")


if __name__ == "__main__":
    main()
