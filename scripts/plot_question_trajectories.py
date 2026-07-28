"""
Question-trajectory charts: pre/post context-rating plots, one pair per learner.

Reads every value from data/question_ratings.csv — nothing about the cohort,
the turn counts or the ratings is hard-coded here.

Usage:
    python scripts/plot_question_trajectories.py                # verify, then plot
    python scripts/plot_question_trajectories.py --verify-only  # verify, then stop

Encoding
    y position   rating band: 1, 2 (2a/2b), 3 (3a/3b)
    shape        "a" variants and rating 1 are circles; "b" variants are squares
    fill         rating 1 is hollow; every other rating is filled
    phase        pre-test is dashed and grey; post-test is solid and oxide red

The lens_1 / lens_2 columns are deliberately ignored — the charts carry no
lens colouring.

Animation
    Each line is materialised as an ordered list of PointSpec, and all drawing
    goes through draw_trajectory(). To animate the line being drawn, call
    draw_trajectory() repeatedly with progressively longer slices of the same
    list — no other part of this module needs to change.
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter, OrderedDict
from dataclasses import dataclass
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

# ── paths ──────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = REPO_ROOT / "data" / "question_ratings.csv"
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
PHASE_STYLE = {"pre": PRE_STYLE, "post": POST_STYLE}

# Draw order: pre line, pre markers, post line, post markers. Each phase's line
# sits beneath its own markers; the post-test layer sits above the pre-test one.
PHASE_ZORDER = {"pre": 1, "post": 3}


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
    label: str | None = None,
) -> list:
    """
    Draw one trajectory: the connecting line with its markers on top.

    Returns the artists it created, in draw order. This is the single entry
    point for rendering a line — an animation can call it with growing slices
    of `points` (and remove the previous artists) to draw the line out over time.
    """
    alpha = style.opacity if opacity is None else opacity
    artists = []

    xs = [p.turn for p in points]
    ys = [p.y for p in points]
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

    # A proxy artist carries the legend entry, so the legend shows one clean
    # swatch per phase instead of one per marker.
    if label:
        ax.plot(
            [],
            [],
            color=style.line_colour,
            linestyle=style.linestyle,
            linewidth=LINE_WIDTH,
            marker="o",
            markerfacecolor=style.colour,
            markeredgecolor=MARKER_HALO,
            markeredgewidth=EDGE_WIDTH,
            markersize=MARKER_SIZE * 0.8,
            alpha=alpha,
            label=label,
        )

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


# ── figure scaffolding ─────────────────────────────────────────────────────
def figure_width(max_turn: int) -> float:
    """Width that keeps the turn axis legible at print size."""
    return min(9.0, max(5.2, 1.7 + 0.45 * max_turn))


def new_figure(max_turn: int):
    fig, ax = plt.subplots(figsize=(figure_width(max_turn), 3.7))
    return fig, ax


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


def save(fig, stem: Path) -> None:
    for suffix in ("png", "svg"):
        fig.savefig(stem.with_suffix(f".{suffix}"), dpi=300, bbox_inches="tight")
    plt.close(fig)


# ── charts ─────────────────────────────────────────────────────────────────
def plot_pre(learner: str, points: list, out_dir: Path) -> None:
    max_turn = max(p.turn for p in points)
    fig, ax = new_figure(max_turn)
    style_axes(ax, max_turn, title=learner)
    draw_trajectory(ax, points, PRE_STYLE, zorder=PHASE_ZORDER["pre"])
    save(fig, out_dir / f"{slug(learner)}_pre")


def plot_prepost(learner: str, pre: list, post: list, out_dir: Path) -> None:
    max_turn = max(p.turn for p in pre + post)
    fig, ax = new_figure(max_turn)
    style_axes(ax, max_turn, title=learner)

    draw_trajectory(ax, pre, PRE_STYLE, zorder=PHASE_ZORDER["pre"], label=PHASE_LABEL["pre"])
    draw_trajectory(ax, post, POST_STYLE, zorder=PHASE_ZORDER["post"], label=PHASE_LABEL["post"])

    # Sits above the axes, so it can never collide with a dense trajectory.
    ax.legend(
        loc="lower right",
        bbox_to_anchor=(1.0, 1.005),
        ncol=2,
        frameon=False,
        handletextpad=0.6,
        columnspacing=1.8,
        labelcolor=AXIS_GREY,
    )
    save(fig, out_dir / f"{slug(learner)}_prepost")


def plot_stacked(learner: str, pre: list, post: list, out_dir: Path) -> None:
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

    draw_trajectory(ax_pre, pre, PRE_STYLE, zorder=PHASE_ZORDER["pre"])
    draw_trajectory(ax_post, post, POST_STYLE, zorder=PHASE_ZORDER["pre"])

    # One shared y-label rather than the long string repeated on both panels.
    fig.supylabel("Context Rating Scale for Inquiries", fontsize=13, color=AXIS_GREY, x=0.02)
    fig.suptitle(learner, fontsize=15, color=AXIS_GREY, x=0.125, y=1.005, ha="left")

    save(fig, out_dir / f"{slug(learner)}_stacked")


def plot_legend(out_dir: Path) -> None:
    """A standalone key: marker shapes, hollow vs filled, and the two phases."""
    fig, (ax_shape, ax_phase) = plt.subplots(1, 2, figsize=(9.4, 2.2))
    for ax in (ax_shape, ax_phase):
        ax.axis("off")

    def marker(**kwargs):
        base = dict(linestyle="none", markersize=MARKER_SIZE, color="none")
        return Line2D([], [], **{**base, **kwargs})

    def hollow(colour):
        return marker(
            marker="o",
            markerfacecolor="white",
            markeredgecolor=colour,
            markeredgewidth=EDGE_WIDTH,
        )

    shape_handles = [
        (hollow(NEUTRAL), "Rating 1 — hollow circle"),
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
        (
            Line2D(
                [],
                [],
                color=PRE_STYLE.line_colour,
                linestyle=PRE_STYLE.linestyle,
                linewidth=LINE_WIDTH,
                marker="o",
                markerfacecolor=PRE_STYLE.colour,
                markeredgecolor=MARKER_HALO,
                markeredgewidth=EDGE_WIDTH,
                markersize=MARKER_SIZE,
                alpha=PRE_STYLE.opacity,
            ),
            PHASE_LABEL["pre"],
        ),
        (
            Line2D(
                [],
                [],
                color=POST_STYLE.line_colour,
                linestyle=POST_STYLE.linestyle,
                linewidth=LINE_WIDTH,
                marker="o",
                markerfacecolor=POST_STYLE.colour,
                markeredgecolor=MARKER_HALO,
                markeredgewidth=EDGE_WIDTH,
                markersize=MARKER_SIZE,
            ),
            PHASE_LABEL["post"],
        ),
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

    save(fig, out_dir / "legend")


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
    parser.add_argument("--out", type=Path, default=OUT_DIR, help="output directory")
    parser.add_argument("--verify-only", action="store_true", help="print the table and stop")
    args = parser.parse_args()

    rows = load_rows(args.data)
    grouped = group(rows)
    verify(grouped, args.data)

    if args.verify_only:
        print("\n--verify-only: stopping before plotting.")
        return

    args.out.mkdir(parents=True, exist_ok=True)
    written = 0

    for learner, phases in grouped.items():
        pre = build_points(phases.get("pre", []))
        post = build_points(phases.get("post", []))

        if not pre:
            print(f"! {learner}: no pre-test rows - skipping both charts.")
            continue

        plot_pre(learner, pre, args.out)
        written += 2

        if post:
            plot_prepost(learner, pre, post, args.out)
            written += 2
            if learner == STACKED_LEARNER:
                plot_stacked(learner, pre, post, args.out)
                written += 2
        else:
            print(f"! {learner}: no post-test rows - pre-only chart written.")

    plot_legend(args.out)
    written += 2

    print(f"\nWrote {written} files to {args.out}")


if __name__ == "__main__":
    main()
