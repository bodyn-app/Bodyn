#!/usr/bin/env python3
"""
Regenerates docs/test-cases.xlsx from a vitest JSON report, so the tracker can never drift from
the tests that actually run.

    npm run test-docs

Reads .test-report.json (produced by `vitest run --reporter=json`) and rewrites the workbook.
The file is generated: anything typed into it by hand is lost on the next run.
"""
import json
import pathlib
import sys
from datetime import datetime, timezone

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPORT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else ".test-report.json")
OUT = ROOT / "docs" / "test-cases.xlsx"

# Friendly area names per test file; anything new falls back to its filename, so adding a test
# file never requires editing this script.
AREAS = {
    "src/metrics/engine.test.ts": "Metrics engine",
    "src/metrics/fitness-profile.test.ts": "Fitness age",
    "src/metrics/stress-fitness.test.ts": "Stress & fitness age",
    "src/coach/coach.test.ts": "Coach",
    "src/lib/units.test.ts": "Units",
    "src/notifications/notifications.test.ts": "Notifications",
    "src/state/home-layout.test.ts": "Home layout",
    "src/state/ring-order.test.ts": "Home rings",
}

FONT = "Arial"
LIME = "B8F53D"
INK = "10140D"
GREY = "5B6454"
BORDER = Side(style="thin", color="DDE2D6")


def rel(path: str) -> str:
    try:
        return pathlib.Path(path).resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return pathlib.Path(path).as_posix()


def load_rows():
    if not REPORT.exists():
        sys.exit(f"No {REPORT.name}. Run: npm run test-docs")
    data = json.loads(REPORT.read_text(encoding="utf-8"))
    rows = []
    for f in sorted(data["testResults"], key=lambda x: rel(x["name"])):
        path = rel(f["name"])
        area = AREAS.get(path, pathlib.Path(path).name.replace(".test.ts", ""))
        for a in f["assertionResults"]:
            rows.append({
                "area": area,
                "file": path,
                "suite": " › ".join(a.get("ancestorTitles") or []) or "(top level)",
                "title": a["title"],
                "status": a["status"],
                "ms": round(a.get("duration") or 0, 1),
            })
    return rows, data


def main():
    rows, data = load_rows()
    wb = Workbook()
    # LibreOffice isn't available on Windows, so openpyxl ships these formulas without cached
    # results. This flag makes Excel (and Numbers/Sheets) recalculate the moment the file opens.
    wb.calculation.fullCalcOnLoad = True

    # ---------- Test Cases ----------
    ws = wb.active
    ws.title = "Test Cases"
    headers = ["ID", "Area", "Test file", "Suite", "Test case", "Status", "Time (ms)"]
    ws.append(headers)
    for c, _ in enumerate(headers, 1):
        cell = ws.cell(row=1, column=c)
        cell.font = Font(name=FONT, bold=True, color=INK, size=11)
        cell.fill = PatternFill("solid", fgColor=LIME)
        cell.alignment = Alignment(vertical="center")
        cell.border = Border(bottom=BORDER)
    ws.row_dimensions[1].height = 22

    for i, r in enumerate(rows, start=1):
        ws.append([i, r["area"], r["file"], r["suite"], r["title"], r["status"], r["ms"]])
        row = i + 1
        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=row, column=c)
            cell.font = Font(name=FONT, size=10)
            cell.alignment = Alignment(vertical="top", wrap_text=(c in (4, 5)))
            cell.border = Border(bottom=BORDER)
        passed = r["status"] == "passed"
        ws.cell(row=row, column=6).font = Font(name=FONT, size=10, bold=True,
                                               color="17A34A" if passed else "E5483D")
        ws.cell(row=row, column=7).number_format = "0.0"

    for col, width in zip("ABCDEFG", (6, 20, 34, 30, 74, 10, 11)):
        ws.column_dimensions[col].width = width
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(rows) + 1}"

    # ---------- Summary ----------
    s = wb.create_sheet("Summary")
    last = len(rows) + 1
    area_col = f"'Test Cases'!$B$2:$B${last}"
    status_col = f"'Test Cases'!$F$2:$F${last}"

    s["A1"] = "Bodyn — test case tracker"
    s["A1"].font = Font(name=FONT, bold=True, size=16, color=INK)
    s["A2"] = f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} from a live vitest run"
    s["A2"].font = Font(name=FONT, size=10, color=GREY)
    s["A3"] = "Generated file — regenerate with `npm run test-docs`. Anything typed in by hand is overwritten."
    s["A3"].font = Font(name=FONT, size=10, italic=True, color="D69200")

    s["A5"] = "Total test cases"
    s["B5"] = f"=COUNTA('Test Cases'!$A$2:$A${last})"
    s["A6"] = "Passing"
    s["B6"] = f'=COUNTIF({status_col},"passed")'
    s["A7"] = "Failing"
    s["B7"] = f'=COUNTA(\'Test Cases\'!$A$2:$A${last})-COUNTIF({status_col},"passed")'
    s["A8"] = "Test files"
    s["B8"] = str(len(data["testResults"]))
    for r in range(5, 9):
        s.cell(row=r, column=1).font = Font(name=FONT, size=11, bold=True, color=INK)
        s.cell(row=r, column=2).font = Font(name=FONT, size=11, color=INK)
    s["B7"].font = Font(name=FONT, size=11, bold=True, color="E5483D")

    s["A10"] = "By area"
    s["A10"].font = Font(name=FONT, bold=True, size=12, color=INK)
    s["A11"], s["B11"] = "Area", "Test cases"
    for c in ("A11", "B11"):
        s[c].font = Font(name=FONT, bold=True, color=INK, size=11)
        s[c].fill = PatternFill("solid", fgColor=LIME)

    areas = sorted({r["area"] for r in rows})
    for i, area in enumerate(areas):
        row = 12 + i
        s.cell(row=row, column=1, value=area).font = Font(name=FONT, size=10)
        c = s.cell(row=row, column=2, value=f'=COUNTIF({area_col},$A{row})')
        c.font = Font(name=FONT, size=10)
    total_row = 12 + len(areas)
    s.cell(row=total_row, column=1, value="Total").font = Font(name=FONT, bold=True, size=10)
    tc = s.cell(row=total_row, column=2, value=f"=SUM($B$12:$B${total_row - 1})")
    tc.font = Font(name=FONT, bold=True, size=10)

    s.column_dimensions["A"].width = 58
    s.column_dimensions["B"].width = 14

    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)
    print(f"{OUT.relative_to(ROOT).as_posix()}: {len(rows)} test cases across {len(data['testResults'])} files")


if __name__ == "__main__":
    main()
