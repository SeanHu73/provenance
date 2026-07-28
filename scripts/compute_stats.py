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


def slug(name: str) -> str:
    """Learner name to folder name: "Learner 5" -> "learner_5"."""
    return "".join(c if c.isalnum() else "_" for c in name.strip().lower()).strip("_")


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
    """
    The signed display form used in the tables. No % sign: this is a change in
    percentage points, so the unit sits in the column heading instead.
    """
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
        ("Post 2s", post.twos, 22),
        ("Post 3s", post.threes, 27),
        ("Post contextual total", post.contextual, 49),
        ("Pre score", pre.score, 66),
        ("Post score", post.score, 125),
        ("Pre %3s", pre.pct_threes, 35.7),
        ("Post %3s", post.pct_threes, 55.1),
        ("Pre P.A.S.T. activated", pre.activated, 15),
        ("Post P.A.S.T. activated", post.activated, 33),
    ]

    expected_questions = {"pre": [7, 15, 6, 7, 8, 7], "post": [8, 14, 6, 6, 12, 9]}
    for phase, expected in expected_questions.items():
        actual = [phases[phase].questions for phases in table.values()]
        checks.append((f"{PHASE_LABEL[phase]} question counts", actual, expected))

    failures = [f"  {name}: got {got!r}, expected {want!r}" for name, got, want in checks if got != want]
    if failures:
        sys.exit("Verification FAILED:\n" + "\n".join(failures))

    print(f"Verification passed: {len(checks)} checks against data/question_ratings.csv")


# ── table models ───────────────────────────────────────────────────────────
@dataclass
class TableSpec:
    """
    One table, described once and consumed by the console, HTML and fallback
    renderers. Column indices in `bold_cols` and `dividers` are into a full row,
    where index 0 is the row label.
    """

    row_header: str          # heading over the label column ("Learner" / "Phase")
    headers: list            # data-column headings (excludes the label column)
    rows: list               # each row is [label, *data]
    bold_cols: set = None    # net columns, rendered slightly bolder
    groups: list = None      # [(label, span), ...] spanning the data columns
    dividers: set = None     # columns that open a group: get a left rule

    def __post_init__(self):
        self.bold_cols = self.bold_cols or set()
        self.dividers = self.dividers or set()


def fmt_pct_display(value: float | None) -> str:
    """Percentages carry a % sign in the rendered tables (never in the CSV)."""
    return "" if value is None else f"{value:.1f}%"


def fmt_activated(stats: Stats, with_pct: bool = False) -> str:
    """"n/m", optionally with the share it represents — used only on the All row."""
    base = f"{stats.activated}/{stats.contextual}"
    if not with_pct or stats.contextual == 0:
        return base
    return f"{base} ({round_half_up(100 * stats.activated / stats.contextual):.1f}%)"


def per_learner_threes(table: "OrderedDict", pre: Stats, post: Stats) -> float | None:
    """
    What the %3s shift is worth as a countable number of 3-rated questions for
    a typical learner: hold the pre-test 3s rate against the post-test volume,
    take the shortfall against the actual 3s, and spread it over the cohort.
    """
    if not table or pre.contextual == 0 or post.contextual == 0:
        return None
    expected = post.contextual * (pre.threes / pre.contextual)
    return round_half_up((post.threes - expected) / len(table))


# ── console output ─────────────────────────────────────────────────────────
def console_safe(text) -> str:
    """
    The console may be on a codepage that cannot encode typographic dashes, and
    a two-line cell has to collapse onto one line here.
    """
    flat = str(text).replace("\n", " ")
    return flat.replace("—", "-").replace("−", "-").replace("–", "-")


def print_table(title: str, spec: TableSpec) -> None:
    headers = [console_safe(spec.row_header)] + [console_safe(h) for h in spec.headers]
    rows = [[console_safe(c) for c in row] for row in spec.rows]
    widths = [max(len(headers[i]), *(len(r[i]) for r in rows)) for i in range(len(headers))]
    print(f"\n{console_safe(title)}")

    if spec.groups:
        # The group tier starts above the first data column, not the label column.
        cells = [" " * widths[0]]
        column = 1
        for label, span in spec.groups:
            width = sum(widths[column : column + span]) + 2 * (span - 1)
            cells.append(console_safe(label).ljust(width))
            column += span
        print("  ".join(cells).rstrip())

    line = "  ".join(headers[i].ljust(widths[i]) for i in range(len(headers)))
    print(line)
    print("-" * len(line))
    for row in rows:
        print("  ".join(row[i].ljust(widths[i]) for i in range(len(row))))


# ── per-learner tables ─────────────────────────────────────────────────────
def learner_table1(phases: dict) -> TableSpec:
    return TableSpec(
        row_header="Phase",
        headers=["Rating: 2s", "Rating: 3s", "Total Context Inquiries"],
        rows=[
            [PHASE_LABEL[p], phases[p].twos, phases[p].threes, phases[p].contextual]
            for p in PHASE_ORDER
        ],
    )


def learner_table2(phases: dict) -> TableSpec:
    return TableSpec(
        row_header="Phase",
        headers=["Score", "%3s"],
        rows=[
            [PHASE_LABEL[p], phases[p].score, fmt_pct_display(phases[p].pct_threes)]
            for p in PHASE_ORDER
        ],
    )


def learner_table3(phases: dict) -> TableSpec:
    return TableSpec(
        row_header="Phase",
        headers=["P.A.S.T. activated"],
        rows=[[PHASE_LABEL[p], fmt_activated(phases[p])] for p in PHASE_ORDER],
    )


# ── combined tables ────────────────────────────────────────────────────────
# A grouped header tier plus a rule at each group's left edge separates the
# pre-test block from the post-test block at a glance.
def _combined_rows(table: "OrderedDict"):
    """Each learner, then the All row; `is_all` marks the summary row."""
    for name, phases in list(table.items()):
        yield name, phases["pre"], phases["post"], False
    all_rows = totals(table)
    yield "All", all_rows["pre"], all_rows["post"], True


def combined_table1(table: "OrderedDict") -> TableSpec:
    rows = [
        [
            name,
            pre.twos, pre.threes, pre.contextual,
            post.twos, post.threes, post.contextual,
            f"{post.contextual - pre.contextual:+d}",
        ]
        for name, pre, post, _ in _combined_rows(table)
    ]
    return TableSpec(
        row_header="Learner",
        headers=[
            "Rating: 2s", "Rating: 3s", "Total Context Inquiries",
            "Rating: 2s", "Rating: 3s", "Total Context Inquiries",
            "Total Context Inquiries",
        ],
        rows=rows,
        bold_cols={7},
        groups=[("Pre-test", 3), ("Post-test", 3), ("Net (post − pre)", 1)],
        dividers={1, 4, 7},
    )


def combined_table2(table: "OrderedDict") -> TableSpec:
    rows = []
    for name, pre, post, is_all in _combined_rows(table):
        net = net_pct(pre, post)
        if is_all:
            # Only here: the shift restated as a count of questions, on its own
            # line beneath the percentage. "\n" splits a cell across two lines.
            equivalent = per_learner_threes(table, pre, post)
            if net and equivalent is not None:
                net = f"{net}\n({equivalent:+.1f} more 3s per learner)"
        rows.append(
            [
                name,
                pre.score, fmt_pct_display(pre.pct_threes),
                post.score, fmt_pct_display(post.pct_threes),
                f"{post.score - pre.score:+d}",
                net,
            ]
        )
    return TableSpec(
        row_header="Learner",
        # The Net group's %3s is a change in percentage points, not a percentage:
        # the unit is carried in the heading and the cells stay unsuffixed.
        headers=["Score", "%3s", "Score", "%3s", "Score", "%3s (pp)"],
        rows=rows,
        bold_cols={5, 6},
        groups=[("Pre-test", 2), ("Post-test", 2), ("Net (post − pre)", 2)],
        dividers={1, 3, 5},
    )


def combined_table3(table: "OrderedDict") -> TableSpec:
    rows = [
        [
            name,
            fmt_activated(pre, with_pct=is_all),
            fmt_activated(post, with_pct=is_all),
            f"{post.activated - pre.activated:+d}",
        ]
        for name, pre, post, is_all in _combined_rows(table)
    ]
    return TableSpec(
        row_header="Learner",
        headers=["P.A.S.T. activated", "P.A.S.T. activated", "Activations"],
        rows=rows,
        bold_cols={3},
        groups=[("Pre-test", 1), ("Post-test", 1), ("Net (post − pre)", 1)],
        dividers={1, 2, 3},
    )


TABLE_TITLES = {
    1: "Contextual Question Counts",
    2: "Contextual Question Scores",
    3: "P.A.S.T. Activation",
}
TABLE_FILES = {1: "table1_counts", 2: "table2_scores", 3: "table3_past"}


# ── HTML ───────────────────────────────────────────────────────────────────
def build_html(title: str, spec: TableSpec, accent: str, note: str | None, width: int) -> str:
    header_bg = mix_white(accent, HEADER_WHITE)
    stripe_bg = mix_white(accent, STRIPE_WHITE)
    rule = mix_white(accent, 0.45)
    group_rule = mix_white(accent, 0.15)   # stronger: separates pre from post

    def classes_for(index: int, extra: list = ()) -> str:
        names = list(extra)
        if index > 0:
            names.append("num")
        if index in spec.bold_cols:
            names.append("net")
        if index in spec.dividers:
            names.append("sep")
        return f' class="{" ".join(names)}"' if names else ""

    if spec.groups:
        group_cells, column = [], 1     # column 0 is the label, spanned below
        for label, span in spec.groups:
            sep = " sep" if column in spec.dividers else ""
            group_cells.append(f'<th colspan="{span}" class="grp{sep}">{label}</th>')
            column += span
        head = (
            f'        <tr><th rowspan="2" class="rowlab">{spec.row_header}</th>'
            + "".join(group_cells)
            + "</tr>\n        <tr>"
            + "".join(f"<th{classes_for(i + 1)}>{h}</th>" for i, h in enumerate(spec.headers))
            + "</tr>"
        )
    else:
        head = (
            f'        <tr><th class="rowlab">{spec.row_header}</th>'
            + "".join(f"<th{classes_for(i + 1)}>{h}</th>" for i, h in enumerate(spec.headers))
            + "</tr>"
        )

    def cell_html(value) -> str:
        """A "\\n" in a value puts the remainder on its own quieter second line."""
        head, _, tail = str(value).partition("\n")
        return head if not tail else f'{head}<span class="sub">{tail}</span>'

    body = "\n".join(
        f'        <tr class="{"odd" if i % 2 else "even"}">'
        + "".join(f"<td{classes_for(j)}>{cell_html(value)}</td>" for j, value in enumerate(row))
        + "</tr>"
        for i, row in enumerate(spec.rows)
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
    white-space: nowrap;               /* data never wraps mid-value */
    border: none;                      /* no vertical rules between columns */
    border-bottom: 1px solid {rule};   /* thin horizontal rules only */
  }}
  th {{
    background: {header_bg};
    font-weight: 600;
    font-size: 19px;
  }}
  thead th.num {{
    /* Long column names wrap rather than stretching the table sideways. This
       width lets "Total Context Inquiries" break after "Context" — two lines,
       not three, so the header row stays shallow. */
    white-space: normal;
    max-width: 158px;
    line-height: 1.2;
    vertical-align: bottom;
  }}
  th.grp {{
    text-align: center;
    white-space: nowrap;
    font-size: 20px;
    letter-spacing: 0.3px;
    padding-bottom: 9px;
  }}
  th.rowlab {{ vertical-align: bottom; }}
  /* The one vertical rule in the table: where a phase block begins. */
  .sep {{ border-left: 2px solid {group_rule}; }}
  td.num, th.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
  .sub {{
    display: block;                    /* the restated figure, one line down */
    margin-top: 4px;
    font-size: 15px;
    font-weight: 400;
    opacity: 0.85;
  }}
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
{head}
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

    for title, spec, accent, note, width, png_path in jobs_data:
        header_bg, stripe_bg = mix_white(accent, HEADER_WHITE), mix_white(accent, STRIPE_WHITE)
        # No two-tier header here: the group label is folded into each column
        # name so the fallback still distinguishes pre from post.
        prefixes = [""] * len(spec.headers)
        if spec.groups:
            column = 0
            for label, span in spec.groups:
                for offset in range(span):
                    prefixes[column + offset] = f"{label}\n"
                column += span
        headers = [spec.row_header] + [f"{p}{h}" for p, h in zip(prefixes, spec.headers)]

        fig_w = width / 100
        fig_h = 1.4 + 0.42 * (len(spec.rows) + 1) + (1.1 if note else 0)
        fig, ax = plt.subplots(figsize=(fig_w, fig_h))
        fig.patch.set_facecolor(CREAM)
        ax.set_facecolor(CREAM)
        ax.axis("off")

        mpl_table = ax.table(
            cellText=[[str(c) for c in row] for row in spec.rows],
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
                if c in spec.bold_cols:
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
    parser.add_argument(
        "--learners",
        default="",
        help="comma-separated learners whose folders to rewrite; default all. "
        "The combined tables and the summary CSV always cover the whole cohort.",
    )
    args = parser.parse_args()

    selected = {slug(name) for name in args.learners.split(",") if name.strip()}

    table = compute(load_rows(args.data))
    verify(table)

    html_dir = args.out / "_html"
    html_dir.mkdir(parents=True, exist_ok=True)

    jobs, fallback_jobs = [], []

    def emit(folder: str, label: str, number: int, spec: TableSpec, width: int) -> None:
        title = f"{label} — {TABLE_TITLES[number]}"
        note = PAST_NOTE if number == 3 else None
        accent = TABLE_ACCENT[number]

        print_table(title, spec)
        if note:
            print(f"  note: {note}")

        html = build_html(title, spec, accent, note, width)
        html_path = html_dir / f"{folder}_{TABLE_FILES[number]}.html"
        html_path.write_text(html, encoding="utf-8")

        target = args.out / folder
        target.mkdir(parents=True, exist_ok=True)
        png_path = target / f"{TABLE_FILES[number]}.png"

        jobs.append((html_path, png_path))
        fallback_jobs.append((title, spec, accent, note, width, png_path))

    # Per-learner: fewer columns, so a proportionally narrower card.
    for name, phases in table.items():
        folder = slug(name)
        if selected and folder not in selected:
            continue
        for number, builder in ((1, learner_table1), (2, learner_table2), (3, learner_table3)):
            emit(folder, name, number, builder(phases), width=680)

    # Combined: ~800 CSS px at device scale factor 3 lands near 2400px.
    for number, builder in ((1, combined_table1), (2, combined_table2), (3, combined_table3)):
        emit("all_learners", "All Learners", number, builder(table), width=800)

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
