#!/usr/bin/env python3
"""Generate the icon components from the Figma style guide export.

Reads design/Icons.svg — a flat sheet of paths at absolute coordinates —
and emits src/components/icons/index.tsx.

The sheet has no group ids or names, so icons are recovered by computing
each path's bounding box, clustering the boxes vertically, and centring
each cluster in a 24x24 viewBox. Names come from ICON_NAMES below, which
is ordered top-to-bottom and must be updated if the designer adds, drops,
or reorders an icon (the script asserts the count matches).

Most icons are filled paths; the lock is a stroked outline. Both are
handled, and colour is replaced with currentColor either way so the
components inherit from CSS.

    python scripts/extract_icons.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "design" / "Icons.svg"
OUT_TSX = ROOT / "src" / "components" / "icons" / "index.tsx"

# Top-to-bottom order on the style guide sheet.
ICON_NAMES = [
    "lock", "menu", "chevron-left", "chevron-right", "chevron-down", "close",
    "plus", "refresh", "share", "star", "trash", "check",
    "chevron-left-lg", "chevron-right-lg", "search", "map-pin", "eye", "note",
]

# Paths above this y are the card background and header, not icons.
CONTENT_TOP = 190.0
# Anything larger than this is a background or a run of title glyphs.
MAX_ICON_EXTENT = 40.0
# Two paths closer together than this vertically belong to the same icon.
CLUSTER_GAP = 14.0

NUMBER = re.compile(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?")
COMMAND = re.compile(r"([MmLlHhVvCcSsQqTtAaZz])")
ARG_COUNT = {"M": 2, "L": 2, "H": 1, "V": 1, "C": 6, "S": 4, "Q": 4, "T": 2, "A": 7, "Z": 0}


def path_bbox(d: str) -> tuple[float, float, float, float] | None:
    """Bounding box of a path.

    Curve control points are included rather than solved for, which can
    overshoot the true bounds slightly. That is harmless here: it only
    shifts an icon's centring by a fraction of a pixel on a 24px grid.
    """
    tokens = [t for t in COMMAND.split(d) if t.strip()]
    x = y = start_x = start_y = 0.0
    points: list[tuple[float, float]] = []
    i = 0
    while i < len(tokens):
        command = tokens[i]
        i += 1
        if not COMMAND.fullmatch(command):
            continue
        upper, relative = command.upper(), command.islower()
        if upper == "Z":
            x, y = start_x, start_y
            points.append((x, y))
            continue
        raw = []
        if i < len(tokens) and not COMMAND.fullmatch(tokens[i]):
            raw = [float(n) for n in NUMBER.findall(tokens[i])]
            i += 1
        step = ARG_COUNT[upper]
        for offset in range(0, len(raw) - step + 1, step):
            args = raw[offset:offset + step]
            if upper == "H":
                next_x, next_y = (x + args[0]) if relative else args[0], y
            elif upper == "V":
                next_x, next_y = x, (y + args[0]) if relative else args[0]
            elif upper == "A":
                next_x = (x + args[5]) if relative else args[5]
                next_y = (y + args[6]) if relative else args[6]
            else:
                for k in range(0, step - 2, 2):
                    points.append((
                        (x + args[k]) if relative else args[k],
                        (y + args[k + 1]) if relative else args[k + 1],
                    ))
                next_x = (x + args[step - 2]) if relative else args[step - 2]
                next_y = (y + args[step - 1]) if relative else args[step - 1]
            if upper == "M" and offset == 0:
                start_x, start_y = next_x, next_y
            points.append((next_x, next_y))
            x, y = next_x, next_y
    if not points:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def attr(source: str, name: str) -> str | None:
    match = re.search(r'(?:^|\s)' + re.escape(name) + r'="([^"]*)"', source)
    return match.group(1) if match else None


def collect_icons(svg: str) -> list[dict]:
    candidates = []
    for match in re.finditer(r"<path([^>]*?)/?>", svg):
        attrs = match.group(1)
        d = attr(attrs, "d")
        if not d:
            continue
        box = path_bbox(d)
        if not box:
            continue
        width, height = box[2] - box[0], box[3] - box[1]
        if box[1] < CONTENT_TOP or width > MAX_ICON_EXTENT or height > MAX_ICON_EXTENT:
            continue
        candidates.append({"box": box, "d": d, "attrs": attrs})

    candidates.sort(key=lambda c: c["box"][1])
    clusters: list[list[dict]] = []
    for candidate in candidates:
        if clusters and candidate["box"][1] - clusters[-1][-1]["box"][1] < CLUSTER_GAP:
            clusters[-1].append(candidate)
        else:
            clusters.append([candidate])

    if len(clusters) != len(ICON_NAMES):
        raise SystemExit(
            f"found {len(clusters)} icons but ICON_NAMES has {len(ICON_NAMES)}; "
            "the sheet changed — update ICON_NAMES to match top-to-bottom order"
        )

    icons = []
    for name, cluster in zip(ICON_NAMES, clusters):
        x0 = min(c["box"][0] for c in cluster)
        x1 = max(c["box"][2] for c in cluster)
        y0 = min(c["box"][1] for c in cluster)
        y1 = max(c["box"][3] for c in cluster)
        origin_x = round((x0 + x1) / 2 - 12, 3)
        origin_y = round((y0 + y1) / 2 - 12, 3)

        paths = []
        for c in cluster:
            entry: dict[str, str] = {"d": c["d"]}
            if attr(c["attrs"], "stroke"):
                # Outline icon: keep the geometry, drop the baked colour.
                entry["stroke"] = "currentColor"
                entry["fill"] = "none"
                for key in ("stroke-width", "stroke-linecap", "stroke-linejoin"):
                    value = attr(c["attrs"], key)
                    if value:
                        entry[key] = value
            else:
                entry["fill"] = "currentColor"
                for key in ("fill-rule", "clip-rule"):
                    value = attr(c["attrs"], key)
                    if value:
                        entry[key] = value
            paths.append(entry)

        icons.append({"name": name, "viewBox": f"{origin_x} {origin_y} 24 24", "paths": paths})
    return icons


CAMEL = {
    "stroke-width": "strokeWidth",
    "stroke-linecap": "strokeLinecap",
    "stroke-linejoin": "strokeLinejoin",
    "fill-rule": "fillRule",
    "clip-rule": "clipRule",
}


def pascal(name: str) -> str:
    return "".join(part.capitalize() for part in name.split("-")) + "Icon"


def render_tsx(icons: list[dict]) -> str:
    lines = [
        "/**",
        " * Icon set — generated by scripts/extract_icons.py from",
        " * design/Icons.svg. Do not edit by hand; re-run the script when the",
        " * style guide changes.",
        " *",
        " * Every icon is normalised to a 24x24 viewBox and draws in",
        " * currentColor, so size and colour come from CSS:",
        " *",
        " *   <SearchIcon className=\"w-5 h-5\" style={{ color: 'var(--ds-cardinal)' }} />",
        " */",
        "",
        "import type { ReactElement, SVGProps } from 'react';",
        "",
        "type IconProps = SVGProps<SVGSVGElement>;",
        "",
        "export type IconName =",
    ]
    for i, icon in enumerate(icons):
        suffix = ";" if i == len(icons) - 1 else ""
        lines.append(f"  | '{icon['name']}'{suffix}")
    lines.append("")

    for icon in icons:
        component = pascal(icon["name"])
        lines.append(f"export function {component}(props: IconProps) {{")
        lines.append("  return (")
        lines.append(
            f'    <svg viewBox="{icon["viewBox"]}" width="24" height="24" '
            'xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" {...props}>'
        )
        for path in icon["paths"]:
            attrs = " ".join(
                f'{CAMEL.get(key, key)}="{value}"'
                for key, value in path.items()
                if key != "d"
            )
            lines.append(f'      <path {attrs} d="{path["d"]}" />')
        lines.append("    </svg>")
        lines.append("  );")
        lines.append("}")
        lines.append("")

    lines.append("export const ICONS: Record<IconName, (props: IconProps) => ReactElement> = {")
    for icon in icons:
        lines.append(f"  '{icon['name']}': {pascal(icon['name'])},")
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    svg = SOURCE.read_text(encoding="utf-8")
    icons = collect_icons(svg)
    OUT_TSX.parent.mkdir(parents=True, exist_ok=True)
    OUT_TSX.write_text(render_tsx(icons), encoding="utf-8")
    for icon in icons:
        kind = "outline" if icon["paths"][0].get("stroke") else "filled"
        print(f"  {icon['name']:<18} {len(icon['paths'])} path(s)  {kind}")
    print(f"\nwrote {len(icons)} icons -> {OUT_TSX.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
