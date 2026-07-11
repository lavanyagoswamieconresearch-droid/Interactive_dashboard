# Dataset Explorer

The plan is to create an interactive dashboard that helps to summarise dataset based 
on the given filters. Today, I added a basic template for this project made using Claude AI. 
I will subsequently change the filters and add cleaned data. I am planning to add data from Indian NSS
surveys so that it's easier to interpret and understand. 

A static, no-backend dashboard: filter a dataset with sliders/radios/checkboxes
and watch summary statistics (count, mean, median, std dev, min/max, category
splits) update live. Pure HTML/CSS/JS — no build step, no server, hosts free
on GitHub Pages.

It currently ships with a synthetic 240-row sample (`data/sample.csv`:
age, gender, region, income, satisfaction) so you can see it working
immediately. Swap in your own data by following the steps below.

## Run it locally

Browsers block `fetch()` of local files from `file://`, so serve the folder
instead of double-clicking `index.html`:

```bash
cd dataset-explorer
python3 -m http.server 8000
# then open http://localhost:8000
```

## Use your own dataset

1. Drop your CSV into `data/` (e.g. `data/mydata.csv`). First row must be
   column headers.
2. Open `js/app.js` and edit the `CONFIG` object at the top of the file:

```js
const CONFIG = {
  csvPath: "data/mydata.csv",
  title: "My Survey Explorer",
  subtitle: "Filter respondents, see the stats update.",

  // one dual-handle slider per numeric column you want to filter on
  rangeFilters: [
    { column: "age", label: "Age" }
  ],

  // one radio group per categorical column, single-select + "All"
  radioFilters: [
    { column: "gender", label: "Gender" }
  ],

  // one checkbox group per categorical column, multi-select
  checkboxFilters: [
    { column: "region", label: "Region" }
  ],

  // numeric columns to summarise as stat cards
  numericStats: [
    { column: "age", label: "Age" },
    { column: "income", label: "Income", prefix: "$" }
  ],

  // categorical columns to show as % breakdown bars
  categoricalBreakdowns: [
    { column: "gender", label: "Gender split" }
  ]
};
```

Column names must match your CSV header exactly. Slider min/max and the
option lists for radios/checkboxes are detected automatically from the data
— you don't set them by hand. Numbers in the CSV (age, income, etc.) are
auto-typed by PapaParse as long as the cells contain plain numbers.

## Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "Dataset explorer"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source → Deploy from branch → main /
(root)**. Your dashboard will be live at
`https://<you>.github.io/<repo>/` a minute or two later.

## File structure

```
dataset-explorer/
├── index.html          # page structure
├── css/style.css        # design system (edit CSS variables at top to re-theme)
├── js/app.js             # CONFIG + all filtering/stats logic
├── data/sample.csv       # swap this for your dataset (or point CONFIG.csvPath elsewhere)
└── README.md
```

## Notes

- Everything runs client-side; your CSV never leaves the browser (fine for
  GitHub Pages, but don't put sensitive data in a *public* repo).
- Large CSVs (tens of thousands of rows) will still work — computation is a
  single pass per render — but very large files (>50k rows) may feel less
  snappy on slider drag since it recomputes on every `input` event.
