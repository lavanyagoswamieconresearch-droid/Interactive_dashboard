# Time Use Explorer
A static, no-backend dashboard for time-use panel data: filter by demographic
characteristics and watch a "day in the life" stacked-area chart show what
the filtered group is doing at every hour, plus a summary table of
participation rates and average minutes per activity. Pure HTML/CSS/JS — no
build step, no server, hosts free on GitHub Pages.
It ships with a small synthetic sample (`data/aggregated\_cube.csv` and
`data/timeline\_cube.csv`) so you can see it working immediately. Swap in
your own data by following the steps below.
## Run it locally
Browsers block `fetch()` of local files from `file://`, so serve the folder
instead of double-clicking `index.html`:
```bash
cd dataset-explorer
python3 -m http.server 8000
# then open http://localhost:8000
```
## How the data pipeline works
Because the underlying dataset has 10M+ raw episode-level rows, the
dashboard doesn't load raw rows at all. Instead, `build\_dashboard\_cubes.do`
(the Stata script) pre-aggregates everything into two small CSVs:
`aggregated\_cube.csv` — one row per (demographic combination x
activity), with participation counts, participation rate, and average
minutes. Powers the activity summary table.
`timeline\_cube.csv` — one row per (demographic combination x time
slot x activity), with how many people were doing that activity at that
time. Powers the stacked-area day chart.
Both are joined in the browser by matching demographic columns against
whatever filters are currently selected — no raw microdata ever touches the
browser.
## Use your own dataset
Run `build\_dashboard\_cubes.do` in Stata against your real data (edit the
`>>> EDIT <<<` sections for your file path and small-cell suppression
thresholds).
## Drop the two resulting CSVs into `data/`.
Open `js/app.js` and edit the `CONFIG` object at the top:
```js
const CONFIG = {
  aggregatedCsvPath: "data/aggregated\_cube.csv",
  timelineCsvPath: "data/timeline\_cube.csv",
  title: "Time Use Explorer",
  subtitle: "Filter by who they are, watch what they're doing all day.",

  demoFilters: \[
    { column: "gender", label: "Gender", type: "radio" },
    { column: "sector", label: "Sector", type: "radio" },
    { column: "religion", label: "Religion", type: "checkbox" },
    { column: "social\_group", label: "Social group", type: "checkbox" },
    { column: "marital\_status", label: "Marital status", type: "checkbox" },
    { column: "day\_of\_week", label: "Day of week", type: "checkbox" },
    { column: "principal\_activity\_status", label: "Principal activity status", type: "checkbox" }
  ],

  activityColumn: "activity\_type",

  // Optional: map raw activity codes to readable names
  activityLabels: {
    // "1": "Sleeping",
  },

  topActivitiesInChart: 8
};
```
Column names must match your CSV headers exactly. Filter option lists are
detected automatically from the data — you don't set them by hand. Use
`type: "radio"` for filters where only one value makes sense at a time (e.g.
gender), and `type: "checkbox"` for filters where the user might want
several selected at once (e.g. religion, day of week).
If your activity codes are numeric or abbreviated, fill in
`activityLabels` so the chart legend and table show readable names instead
of raw codes.
## Deploy to GitHub Pages
Settings → Pages → Source → Deploy from a branch → `main` / `(root)`. See
the full click-by-click walkthrough in the chat where this was built if
needed — same steps apply regardless of the CSV changes.
## File structure
```
dataset-explorer/
├── index.html                 # page structure
├── css/style.css               # design system (edit CSS variables at top to re-theme)
├── js/app.js                    # CONFIG + all filtering/chart/table logic
├── data/aggregated\_cube.csv     # swap for your real cube (from the .do file)
├── data/timeline\_cube.csv       # swap for your real cube (from the .do file)
├── build\_dashboard\_cubes.do     # Stata script that builds the two cubes from raw data
└── README.md
```
## Notes on the chart
Only the top `topActivitiesInChart` activities (by overall participation)
get their own stacked colour; everything else is folded into "Other".
Click a legend chip or a row in the activity table to focus the chart on
just that one activity (shows a single area instead of the full stack).
Click again, or "Show all activities", to go back.
The metric toggle switches the y-axis between raw people-count and % of
the currently filtered group.
Small cells are suppressed at the Stata stage (thresholds are the
`>>> EDIT <<<` lines in the `.do` file) — adjust those to match your own
disclosure rules before publishing.
