"""
Contextual-question statistics from data/question_ratings.csv.

Every number is derived from the CSV; nothing about the cohort is hard-coded.
The only literals below are the expected values asserted in verify(), which
exist precisely to fail loudly if the data or the arithmetic drifts.

Usage:
    python scripts/compute_stats.py              # verify, print, write CSV + PNGs
    python scripts/compute_stats.py --no-render  # skip the PNG rendering step

Definitions
    contextual question   a turn rated 2a, 2b, 3a or 3b (rating 1 is not)
    2s / 3s               counts of 2a+2b and 3a+3b
    Score                 2 x 2s + 3 x 3s
    %3s                   3s / (2s + 3s), one decimal; blank when there are no
                          contextual questions (never "nan")
    P.A.S.T. activated    contextual questions whose lens_1 is non-empty and
                          not "Not specified"

No mean or per-question yield is computed anywhere: Score is never divided by
a question count.

Output
    output/stats/learner_N/{table1_counts,table2_scores,table3_past}.png
    output/stats/all_learners/{same three}.png
    output/stats/_html/*.html          source for the PNGs, kept for restyling
    output/stats/summary_stats.csv     long format: learner, phase, metric, value
"""

from __future__ import annotations

import argparse
import csv
import subprocess
import sys
from collections import OrderedDict
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = REPO_ROOT / "data" / "question_ratings.csv"
OUT_DIR = REPO_ROOT / "output" / "stats"

PHASE_ORDER = ["pre", "post"]
PHASE_LABEL = {"pre": "Pre", "post": "Post"}
TWO_RATINGS = {"2a", "2b"}
THREE_RATINGS = {"3a", "3b"}
CONTEXTUAL = TWO_RATINGS | THREE_RATINGS
VALID_RATINGS = CONTEXTUAL | {"1"}
NO_LENS = {"", "not specified"}

PAST_NOTE = (
    "P.A.S.T. activation indicates uptake of the framework, not completeness of "
    "contextual thinking. The framework supports contextual reasoning but is not its "
    "only form; for example, 2a questions concern the motivations of individuals "
    "rather than larger context, and are fully contextual without a lens."
)

# ── palette ────────────────────────────────────────────────────────────────
CREAM = "#F8F8EC"       # solid card background
INK = "#2C3E3A"         # dark teal text
TABLE_ACCENT = {1: "#C4923A", 2: "#A33829", 3: "#2C3E3A"}   # amber, oxide red, deep teal
HEADER_WHITE = 0.60     # accent mixed this far toward white for the header row
STRIPE_WHITE = 0.80     # ... and this far for the alternating stripes


def mix_white(hex_colour: str, weight: float) -> str:
    """Blend a hex colour toward white; weight 1.0 is pure white."""
    r, g, b = (int(hex_colour[i : i + 2], 16) for i in (1, 3, 5))
    blend = lambda c: round(c * (1 - weight) + 255 * weight)
    return f"#{blend(r):02X}{blend(g):02X}{blend(b):02X}"


def round_half_up(value: float, places: int = 1) -> float:
    """
    Round half away from zero. Python's built-in round() is banker's rounding,
    which would turn 56.25 into 56.2; this reports 56.3 as a reader expects.
    """
    quantum = Decimal(1).scaleb(-places)
    return float(Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP))


# ── statistics ─────────────────────────────────────────────────────────────
@dataclass
class Stats:
    """One learner in one phase."""

    questions: int = 0      # all turns, including rating-1 turns
    twos: int = 0
    threes: int = 0
    activated: int = 0      # contextual questions carrying a named lens

    @property
    def contextual(self) -> int:
        return self.twos + self.threes

    @property
    def score(self) -> int:
        return 2 * self.twos + 3 * self.threes

    @property
    def pct_threes(self) -> float | None:
        """None — rendered as a blank cell — when there are no contextual questions."""
        if self.contextual == 0:
            return None
        return round_half_up(100 * self.threes / self.contextual)

    def add(self, other: "Stats") -> "Stats":
        return Stats(
            questions=self.questions + other.questions,
            twos=self.twos + other.twos,
            threes=self.threes + other.threes,
            activated=self.activated + other.activated,
        )


def fmt_pct(value: float | None) -> str:
    return "" if value is None else f"{value:.1f}"


def net_pct_value(pre: Stats, post: Stats) -> float | None:
    """
    Net %3s in percentage points, taken from the two displayed (rounded) figures
    so the table is internally consistent: a reader subtracting the cells sees
    the same number. None if either phase has no contextual questions.
    """
    if pre.pct_threes is None or post.pct_threes is None:
        return None
    return round_half_up(post.pct_threes - pre.pct_threes)


def net_pct(pre: Stats, post: Stats) -> str:
    """The signed display form used in the tables."""
    value = net_pct_value(pre, post)
    return "" if value is None else f"{value:+.1f}"


def load_rows(path: Path) -> list:
    if not path.exists():
        sys.exit(f"Data file not found: {path}")

    rows = []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        missing = {"learner", "phase", "turn", "rating", "lens_1"} - set(reader.fieldnames or [])
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
            if rating not in VALID_RATINGS:
                sys.exit(f'{path}:{lineno}: unknown rating "{raw["rating"]}"')

            rows.append(
                {
                    "learner": learner,
                    "phase": phase,
                    "rating": rating,
                    "lens_1": (raw["lens_1"] or "").strip(),
                }
            )
    return rows


def compute(rows: list) -> "OrderedDict":
    """{learner: {phase: Stats}}, learners in first-appearance order."""
    table: OrderedDict = OrderedDict()
    for row in rows:
        phases = table.setdefault(row["learner"], {p: Stats() for p in PHASE_ORDER})
        stats = phases[row["phase"]]
        stats.questions += 1

        rating = row["rating"]
        if rating in TWO_RATINGS:
            stats.twos += 1
        elif rating in THREE_RATINGS:
            stats.threes += 1
        else:
            continue  # rating 1: counted as a question, never as contextual

        if row["lens_1"].lower() not in NO_LENS:
            stats.activated += 1
    return table


def totals(table: "OrderedDict") -> dict:
    """The All row: every learner summed, per phase."""
    combined = {p: Stats() for p in PHASE_ORDER}
    for phases in table.values():
        for phase in PHASE_ORDER:
            combined[phase] = combined[phase].add(phases[phase])
    return combined


# ── verification ───────────────────────────────────────────────────────────
def verify(table: "OrderedDict") -> None:
    """Fail loudly if the numbers drift from the values this analysis was built on."""
    all_rows = totals(table)
    pre, post = all_rows["pre"], all_rows["post"]

    checks = [
        ("Pre 2s", pre.twos, 18),
        ("Pre 3s", pre.threes, 10),
        ("Pre contextual total", pre.contextual, 28),
        ("Post 2s", post.twos, 21),
        ("Post 3s", post.threes, 27),
        ("Post contextual total", post.contextual, 48),
        ("Pre score", pre.score, 66),
        ("Post score", post.score, 123),
        ("Pre %3s", pre.pct_threes, 35.7),
        ("Post %3s", post.pct_threes, 56.3),
        ("Pre P.A.S.T. activated", pre.activated, 15),
        ("Post P.A.S.T. activated", post.activated, 33),
    ]

    expected_questions = {"pre": [7, 15, 6, 7, 8, 7], "post": [8, 14, 6, 6, 11, 9]}
    for phase, expected in expected_questions.items():
        actual = [phases[phase].questions for phases in table.values()]
        checks.append((f"{PHASE_LABEL[phase]} question counts", actual, expected))

    failures = [f"  {name}: got {got!r}, expected {want!r}" for name, got, want in checks if got != want]
    if failures:
        sys.exit("Verification FAILED:\n" + "\n".join(failures))

    print(f"Verification passed: {len(checks)} checks against data/question_ratings.csv")


# ── console output ─────────────────────────────────────────────────────────
def print_table(title: str, headers: list, rows: list) -> None:
    widths = [max(len(str(headers[i])), *(len(str(r[i])) for r in rows)) for i in range(len(headers))]
    line = "  ".join(str(h).ljust(widths[i]) for i, h in enumerate(headers))
    # The console may be on a codepage that cannot encode the em dash.
    print(f"\n{title.replace(chr(8212), '-')}")
    print(line)
    print("-" * len(line))
    for row in rows:
        print("  ".join(str(c).ljust(widths[i]) for i, c in enumerate(row)))


# ── table models ───────────────────────────────────────────────────────────
# Each returns (headers, rows, bold_columns) so console, HTML and the fallback
# renderer all read from one description.
def learner_table1(phases: dict):
    headers = ["Phase", "2s", "3s", "Contextual total"]
    rows = [
        [PHASE_LABEL[p], phases[p].twos, phases[p].threes, phases[p].contextual]
        for p in PHASE_ORDER
    ]
    return headers, rows, set()


def learner_table2(phases: dict):
    headers = ["Phase", "Score", "%3s"]
    rows = [[PHASE_LABEL[p], phases[p].score, fmt_pct(phases[p].pct_threes)] for p in PHASE_ORDER]
    return headers, rows, set()


def learner_table3(phases: dict):
    headers = ["Phase", "P.A.S.T. activated"]
    rows = [
        [PHASE_LABEL[p], f"{phases[p].activated}/{phases[p].contextual}"]
        for p in PHASE_ORDER
    ]
    return headers, rows, set()


def combined_table1(table: "OrderedDict"):
    headers = ["Learner", "Pre 2s", "Pre 3s", "Pre total", "Post 2s", "Post 3s", "Post total", "Net total"]
    rows = []
    for name, phases in list(table.items()) + [("All", totals(table))]:
        pre, post = phases["pre"], phases["post"]
        rows.append(
            [
                name,
                pre.twos, pre.threes, pre.contextual,
                post.twos, post.threes, post.contextual,
                f"{post.contextual - pre.contextual:+d}",
            ]
        )
    return headers, rows, {7}


def combined_table2(table: "OrderedDict"):
    headers = ["Learner", "Pre score", "Pre %3s", "Post score", "Post %3s", "Net score", "Net %3s (pp)"]
    rows = []
    for name, phases in list(table.items()) + [("All", totals(table))]:
        pre, post = phases["pre"], phases["post"]
        rows.append(
            [
                name,
                pre.score, fmt_pct(pre.pct_threes),
                post.score, fmt_pct(post.pct_threes),
                f"{post.score - pre.score:+d}",
                net_pct(pre, post),
            ]
        )
    return headers, rows, {5, 6}


def combined_table3(table: "OrderedDict"):
    headers = ["Learner", "Pre activated", "Post activated", "Net activations"]
    rows = []
    for name, phases in list(table.items()) + [("All", totals(table))]:
        pre, post = phases["pre"], phases["post"]
        rows.append(
            [
                name,
                f"{pre.activated}/{pre.contextual}",
                f"{post.activated}/{post.contextual}",
                f"{post.activated - pre.activated:+d}",
            ]
        )
    return headers, rows, {3}


TABLE_TITLES = {
    1: "Contextual Question Counts",
    2: "Contextual Question Scores",
    3: "P.A.S.T. Activation",
}
TABLE_FILES = {1: "table1_counts", 2: "table2_scores", 3: "table3_past"}


# ── HTML ───────────────────────────────────────────────────────────────────
def build_html(title: str, headers: list, rows: list, bold_cols: set, accent: str, note: str | None, width: int) -> str:
    header_bg = mix_white(accent, HEADER_WHITE)
    stripe_bg = mix_white(accent, STRIPE_WHITE)
    rule = mix_white(accent, 0.45)

    def cells(values, tag, row_index=None):
        out = []
        for i, value in enumerate(values):
            classes = []
            if i in bold_cols:
                classes.append("net")
            if i > 0:
                classes.append("num")
            attr = f' class="{" ".join(classes)}"' if classes else ""
            out.append(f"<{tag}{attr}>{value}</{tag}>")
        return "".join(out)

    body = "\n".join(
        f'      <tr class="{"odd" if i % 2 else "even"}">{cells(row, "td", i)}</tr>'
        for i, row in enumerate(rows)
    )
    note_html = f'\n    <p class="note">{note}</p>' if note else ""

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ background: {CREAM}; }}
  .card {{
    /* Sized to its content with a floor, so a wide table can never be clipped
       by the screenshot; `width` below is the target, not a hard cap. */
    width: max-content;
    min-width: {width}px;
    background: {CREAM};
    padding: 40px 44px 36px;
    font-family: "Segoe UI", Inter, -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: {INK};
    -webkit-font-smoothing: antialiased;
  }}
  h1 {{
    font-size: 28px;
    font-weight: 600;
    letter-spacing: 0.1px;
    margin-bottom: 22px;
  }}
  table {{ width: 100%; border-collapse: collapse; }}
  th, td {{
    padding: 13px 16px;
    font-size: 19px;
    text-align: left;
    white-space: nowrap;               /* keep every cell on one line */
    border: none;                      /* no vertical rules anywhere */
    border-bottom: 1px solid {rule};   /* thin horizontal rules only */
  }}
  th {{
    background: {header_bg};
    font-weight: 600;
    font-size: 19px;
  }}
  td.num, th.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
  tr.odd td {{ background: {stripe_bg}; }}
  .net {{ font-weight: 650; }}
  tbody tr:last-child td {{ border-bottom: none; }}
  .note {{
    margin-top: 20px;
    max-width: {width}px;              /* wrap the note; never widen the card */
    white-space: normal;
    font-size: 15px;
    font-style: italic;
    line-height: 1.5;
    color: {INK};
    opacity: 0.82;
  }}
</style>
</head>
<body>
  <div class="card" id="card">
    <h1>{title}</h1>
    <table>
      <thead>
        <tr>{cells(headers, "th")}</tr>
      </thead>
      <tbody>
{body}
      </tbody>
    </table>{note_html}
  </div>
</body>
</html>
"""


# ── rendering ──────────────────────────────────────────────────────────────
def render_pngs(jobs: list) -> bool:
    """
    Screenshot each HTML card with headless Chromium at device scale factor 3.
    Returns False if Playwright is unavailable, so the caller can fall back.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return False

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(device_scale_factor=3)
            for html_path, png_path in jobs:
                page.goto(html_path.resolve().as_uri())
                page.locator("#card").screenshot(path=str(png_path))
            browser.close()
    except Exception as exc:                      # browser missing, launch failure
        print(f"! Playwright could not render: {exc}")
        return False
    return True


def render_fallback(jobs_data: list) -> None:
    """
    matplotlib tables in the same colour scheme, used only if Playwright is
    unavailable. Noted in docs/Build_State.md when it fires.
    """
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    for title, headers, rows, bold_cols, accent, note, width, png_path in jobs_data:
        header_bg, stripe_bg = mix_white(accent, HEADER_WHITE), mix_white(accent, STRIPE_WHITE)
        fig_w = width / 100
        fig_h = 1.4 + 0.42 * (len(rows) + 1) + (1.1 if note else 0)
        fig, ax = plt.subplots(figsize=(fig_w, fig_h))
        fig.patch.set_facecolor(CREAM)
        ax.set_facecolor(CREAM)
        ax.axis("off")

        mpl_table = ax.table(
            cellText=[[str(c) for c in row] for row in rows],
            colLabels=[str(h) for h in headers],
            cellLoc="center",
            loc="upper center",
        )
        mpl_table.auto_set_font_size(False)
        mpl_table.set_fontsize(11)
        mpl_table.scale(1, 1.6)
        for (r, c), cell in mpl_table.get_celld().items():
            cell.set_edgecolor(mix_white(accent, 0.45))
            cell.set_linewidth(0.6)
            cell.get_text().set_color(INK)
            if r == 0:
                cell.set_facecolor(header_bg)
                cell.get_text().set_fontweight("semibold")
            else:
                cell.set_facecolor(stripe_bg if r % 2 == 0 else CREAM)
                if c in bold_cols:
                    cell.get_text().set_fontweight("bold")

        ax.set_title(title, color=INK, fontsize=15, loc="left", pad=18)
        if note:
            fig.text(0.02, 0.02, note, fontsize=8, style="italic", color=INK, wrap=True)
        fig.savefig(png_path, dpi=200, facecolor=CREAM, bbox_inches="tight")
        plt.close(fig)


def note_fallback_in_build_state() -> None:
    path = REPO_ROOT / "docs" / "Build_State.md"
    line = (
        "\n- Stats tables (`scripts/compute_stats.py`): rendered with the matplotlib "
        "fallback, not Playwright — headless Chromium could not be installed in this "
        "environment. The styled HTML in `output/stats/_html/` remains the source of truth.\n"
    )
    with path.open("a", encoding="utf-8") as fh:
        fh.write(line)
    print(f"Noted the matplotlib fallback in {path}")


# ── summary CSV ────────────────────────────────────────────────────────────
def write_summary_csv(table: "OrderedDict", path: Path) -> None:
    metrics = [
        ("questions", lambda s: s.questions),
        ("twos", lambda s: s.twos),
        ("threes", lambda s: s.threes),
        ("contextual", lambda s: s.contextual),
        ("score", lambda s: s.score),
        ("pct_3s", lambda s: fmt_pct(s.pct_threes)),
        ("past_activated", lambda s: s.activated),
    ]

    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["learner", "phase", "metric", "value"])
        for name, phases in list(table.items()) + [("All", totals(table))]:
            for phase in PHASE_ORDER:
                for metric, get in metrics:
                    writer.writerow([name, phase, metric, get(phases[phase])])
            # net rows: post - pre, and percentage points for %3s
            pre, post = phases["pre"], phases["post"]
            for metric, get in metrics:
                if metric == "pct_3s":
                    value = net_pct_value(pre, post)
                    writer.writerow([name, "net", metric, "" if value is None else f"{value:.1f}"])
                else:
                    writer.writerow([name, "net", metric, get(post) - get(pre)])


# ── main ───────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, default=DATA_FILE)
    parser.add_argument("--out", type=Path, default=OUT_DIR)
    parser.add_argument("--no-render", action="store_true", help="write HTML and CSV, skip PNGs")
    args = parser.parse_args()

    table = compute(load_rows(args.data))
    verify(table)

    html_dir = args.out / "_html"
    html_dir.mkdir(parents=True, exist_ok=True)

    jobs, fallback_jobs = [], []

    def emit(folder: str, label: str, number: int, headers, rows, bold, width: int) -> None:
        title = f"{label} — {TABLE_TITLES[number]}"
        note = PAST_NOTE if number == 3 else None
        accent = TABLE_ACCENT[number]

        print_table(title, headers, rows)
        if note:
            print(f"  note: {note}")

        html = build_html(title, headers, rows, bold, accent, note, width)
        html_path = html_dir / f"{folder}_{TABLE_FILES[number]}.html"
        html_path.write_text(html, encoding="utf-8")

        target = args.out / folder
        target.mkdir(parents=True, exist_ok=True)
        png_path = target / f"{TABLE_FILES[number]}.png"

        jobs.append((html_path, png_path))
        fallback_jobs.append((title, headers, rows, bold, accent, note, width, png_path))

    # Per-learner: fewer columns, so a proportionally narrower card.
    for name, phases in table.items():
        folder = "".join(c if c.isalnum() else "_" for c in name.strip().lower()).strip("_")
        for number, builder in ((1, learner_table1), (2, learner_table2), (3, learner_table3)):
            headers, rows, bold = builder(phases)
            emit(folder, name, number, headers, rows, bold, width=680)

    # Combined: ~800 CSS px at device scale factor 3 lands near 2400px.
    for number, builder in ((1, combined_table1), (2, combined_table2), (3, combined_table3)):
        headers, rows, bold = builder(table)
        emit("all_learners", "All Learners", number, headers, rows, bold, width=800)

    csv_path = args.out / "summary_stats.csv"
    write_summary_csv(table, csv_path)
    print(f"\nWrote {csv_path}")

    if args.no_render:
        print(f"--no-render: {len(jobs)} HTML files in {html_dir}, no PNGs written.")
        return

    if render_pngs(jobs):
        print(f"Rendered {len(jobs)} PNGs with Playwright (headless Chromium, scale 3).")
    else:
        print("! Playwright unavailable - falling back to matplotlib tables.")
        render_fallback(fallback_jobs)
        note_fallback_in_build_state()
        print(f"Rendered {len(jobs)} PNGs with matplotlib.")


if __name__ == "__main__":
    main()
