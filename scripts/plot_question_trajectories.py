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
    colour       lens_1's P.A.S.T. lens; a second lens splits the marker in half

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
from dataclasses import dataclass, field
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
# P.A.S.T. lens colours, copied verbatim from the brand tokens in
# src/features/context-journal/constants.ts (LENSES). Keep these in sync with
# that file; do not introduce new hues here.
LENS_COLOURS = {
    "place": "#347C4A",
    "affairs": "#B8752B",
    "society": "#9B6FC9",
    "technology": "#2C6488",
}
LENS_LABELS = OrderedDict(
    [
        ("place", "Place"),
        ("affairs", "Affairs"),
        ("society", "Society"),
        ("technology", "Technology"),
    ]
)

NEUTRAL = "#898781"        # default marker colour: no lens / "Not specified"
LINE_GREY = "#B4B2AC"      # connecting line, drawn beneath the markers
HOLLOW_EDGE = "#898781"    # rating-1 outline
SPLIT_EDGE = "#6B6A65"     # outline that holds a two-tone marker together
GRID_GREY = "#E4E2DD"      # the three horizontal rules
AXIS_GREY = "#5A5852"      # spines, ticks, labels

# ── encoding ───────────────────────────────────────────────────────────────
RATING_ORDER = ["1", "2a", "2b", "3a", "3b"]
RATING_Y = {"1": 1, "2a": 2, "2b": 2, "3a": 3, "3b": 3}
RATING_MARKER = {"1": "o", "2a": "o", "2b": "s", "3a": "o", "3b": "s"}
HOLLOW_RATINGS = {"1"}
NO_LENS_VALUES = {"", "not specified", "none", "n/a", "na"}

PHASE_ORDER = ["pre", "post"]
PHASE_LABEL = {"pre": "Pre-test", "post": "Post-test"}
PRE_OPACITY = 0.35

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

MARKER_SIZE = 11.0
LINE_WIDTH = 1.5


# ── point specs ────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class PointSpec:
    """One plotted question turn — everything needed to draw it, and nothing else."""

    turn: int
    y: int
    marker: str                          # 'o' or 's'
    hollow: bool                         # rating 1: white fill, grey edge
    colours: tuple = field(default=(NEUTRAL,))  # 1 colour, or 2 for a split marker


def lens_colour(raw: str, warnings: list) -> str | None:
    """Map a lens cell to its brand hex. Blank / "Not specified" -> None (grey)."""
    key = (raw or "").strip().lower()
    if key in NO_LENS_VALUES:
        return None
    if key not in LENS_COLOURS:
        warnings.append(f'unknown lens "{raw}": drawn in neutral grey')
        return None
    return LENS_COLOURS[key]


def build_points(rows: list, warnings: list) -> list:
    """Turn CSV rows for one learner+phase into an ordered list of PointSpec."""
    points = []
    for row in sorted(rows, key=lambda r: r["turn"]):
        rating = row["rating"]
        c1 = lens_colour(row["lens_1"], warnings)
        c2 = lens_colour(row["lens_2"], warnings)

        if c1 and c2:
            colours = (c1, c2)
        elif c1 or c2:
            colours = (c1 or c2,)
        else:
            colours = (NEUTRAL,)

        points.append(
            PointSpec(
                turn=row["turn"],
                y=RATING_Y[rating],
                marker=RATING_MARKER[rating],
                hollow=rating in HOLLOW_RATINGS,
                colours=colours,
            )
        )
    return points


# ── drawing ────────────────────────────────────────────────────────────────
def draw_trajectory(ax, points: list, opacity: float = 1.0, label: str | None = None) -> list:
    """
    Draw one trajectory: a grey connecting line with the markers on top.

    Returns the artists it created, in draw order. This is the single entry
    point for rendering a line — an animation can call it with growing slices
    of `points` (and remove the previous artists) to draw the line out over time.
    """
    artists = []

    xs = [p.turn for p in points]
    ys = [p.y for p in points]
    if len(xs) > 1:
        (line,) = ax.plot(
            xs,
            ys,
            color=LINE_GREY,
            linewidth=LINE_WIDTH,
            alpha=opacity,
            zorder=2,
            solid_capstyle="round",
        )
        artists.append(line)

    for point in points:
        artists.extend(_draw_marker(ax, point, opacity))

    # A proxy artist carries the legend entry, so the legend shows one clean
    # swatch per phase instead of one per marker.
    if label:
        ax.plot(
            [],
            [],
            color=LINE_GREY,
            marker="o",
            markerfacecolor=NEUTRAL,
            markeredgecolor=NEUTRAL,
            markersize=MARKER_SIZE * 0.8,
            linewidth=LINE_WIDTH,
            alpha=opacity,
            label=label,
        )

    return artists


def _draw_marker(ax, point: PointSpec, opacity: float) -> list:
    """One marker: hollow, single-colour filled, or split left/right two-tone."""
    common = dict(
        linestyle="none",
        markersize=MARKER_SIZE,
        alpha=opacity,
        zorder=3,
        clip_on=False,
    )

    if point.hollow:
        (artist,) = ax.plot(
            point.turn,
            point.y,
            marker=point.marker,
            markerfacecolor="white",
            markeredgecolor=HOLLOW_EDGE,
            markeredgewidth=1.6,
            **common,
        )
        return [artist]

    if len(point.colours) == 2:
        # fillstyle 'left' paints the left half with markerfacecolor and the
        # right half with markerfacecoloralt — one artist, two tones.
        (artist,) = ax.plot(
            point.turn,
            point.y,
            marker=point.marker,
            fillstyle="left",
            markerfacecolor=point.colours[0],
            markerfacecoloralt=point.colours[1],
            markeredgecolor=SPLIT_EDGE,
            markeredgewidth=0.7,
            **common,
        )
        return [artist]

    colour = point.colours[0]
    (artist,) = ax.plot(
        point.turn,
        point.y,
        marker=point.marker,
        markerfacecolor=colour,
        markeredgecolor=colour,
        markeredgewidth=1.0,
        **common,
    )
    return [artist]


# ── figure scaffolding ─────────────────────────────────────────────────────
def new_figure(max_turn: int):
    """A figure sized so the turn axis stays legible at print width."""
    width = min(9.0, max(5.2, 1.7 + 0.45 * max_turn))
    fig, ax = plt.subplots(figsize=(width, 3.7))
    return fig, ax


def style_axes(ax, max_turn: int, title: str) -> None:
    ax.set_xlabel("Question Turn", labelpad=8, color=AXIS_GREY)
    ax.set_ylabel("Context Rating Scale for Inquiries", labelpad=10, color=AXIS_GREY)
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
    style_axes(ax, max_turn, learner)
    draw_trajectory(ax, points, opacity=1.0)
    save(fig, out_dir / f"{slug(learner)}_pre")


def plot_prepost(learner: str, pre: list, post: list, out_dir: Path) -> None:
    max_turn = max(p.turn for p in pre + post)
    fig, ax = new_figure(max_turn)
    style_axes(ax, max_turn, learner)

    draw_trajectory(ax, pre, opacity=PRE_OPACITY, label=PHASE_LABEL["pre"])
    draw_trajectory(ax, post, opacity=1.0, label=PHASE_LABEL["post"])

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


def plot_legend(out_dir: Path) -> None:
    """A standalone key: marker shapes, hollow vs filled, and the lens colours."""
    fig, (ax_shape, ax_lens) = plt.subplots(1, 2, figsize=(9.4, 2.5))
    for ax in (ax_shape, ax_lens):
        ax.axis("off")

    def marker(**kwargs):
        base = dict(linestyle="none", markersize=MARKER_SIZE, color="none")
        return Line2D([], [], **{**base, **kwargs})

    shape_handles = [
        (
            marker(marker="o", markerfacecolor="white", markeredgecolor=HOLLOW_EDGE, markeredgewidth=1.6),
            "Rating 1 — hollow circle",
        ),
        (
            marker(marker="o", markerfacecolor=NEUTRAL, markeredgecolor=NEUTRAL),
            "Ratings 2a / 3a — filled circle",
        ),
        (
            marker(marker="s", markerfacecolor=NEUTRAL, markeredgecolor=NEUTRAL),
            "Ratings 2b / 3b — filled square",
        ),
        (
            marker(
                marker="o",
                fillstyle="left",
                markerfacecolor=LENS_COLOURS["place"],
                markerfacecoloralt=LENS_COLOURS["society"],
                markeredgecolor=SPLIT_EDGE,
                markeredgewidth=0.7,
            ),
            "Two lenses — split marker",
        ),
        (
            Line2D([], [], color=LINE_GREY, linewidth=LINE_WIDTH),
            "Question sequence",
        ),
    ]

    lens_handles = [
        (marker(marker="o", markerfacecolor=hex_, markeredgecolor=hex_), LENS_LABELS[key])
        for key, hex_ in ((k, LENS_COLOURS[k]) for k in LENS_LABELS)
    ]
    lens_handles.append(
        (marker(marker="o", markerfacecolor=NEUTRAL, markeredgecolor=NEUTRAL), "Not specified")
    )

    for ax, handles, title in (
        (ax_shape, shape_handles, "Rating & marker"),
        (ax_lens, lens_handles, "P.A.S.T. lens"),
    ):
        legend = ax.legend(
            [h for h, _ in handles],
            [t for _, t in handles],
            loc="upper left",
            frameon=False,
            title=title,
            handletextpad=0.8,
            labelspacing=0.75,
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
        missing = {"learner", "phase", "turn", "rating", "lens_1", "lens_2"} - set(
            reader.fieldnames or []
        )
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

            rows.append(
                {
                    "learner": learner,
                    "phase": phase,
                    "turn": turn,
                    "rating": rating,
                    "lens_1": raw["lens_1"] or "",
                    "lens_2": raw["lens_2"] or "",
                }
            )
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
                print(f"    ! {learner} {phase}: turns are not 1..{len(turns)} — got {turns}")

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
    warnings: list = []
    written = 0

    for learner, phases in grouped.items():
        pre = build_points(phases.get("pre", []), warnings)
        post = build_points(phases.get("post", []), warnings)

        if not pre:
            print(f"! {learner}: no pre-test rows - skipping both charts.")
            continue

        plot_pre(learner, pre, args.out)
        written += 2

        if post:
            plot_prepost(learner, pre, post, args.out)
            written += 2
        else:
            print(f"! {learner}: no post-test rows - pre-only chart written.")

    plot_legend(args.out)
    written += 2

    for message in sorted(set(warnings)):
        print(f"! {message}")

    print(f"\nWrote {written} files to {args.out}")


if __name__ == "__main__":
    main()
