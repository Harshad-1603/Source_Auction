# The Source Auction

A static, host-controlled browser game for **GSOE9010 Literature Search – Activity 1**.

It turns source evaluation into a Storage Wars-style auction while preserving the academic objective:
- judge source reliability and quality;
- rank/categorise sources;
- discuss a suggested ranking and contentious examples.

## Files

- `index.html` – game interface
- `style.css` – styling
- `app.js` – all game logic

No frameworks, packages, build tools, databases, or external services are required.

## How to run locally

Option 1:
Double-click `index.html`.

Option 2:
Run a tiny local server from this folder:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages deployment

1. Create a new GitHub repository.
2. Upload `index.html`, `style.css`, and `app.js` to the repository root.
3. Commit and push.
4. Open **Repository Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select your main branch and `/ (root)`.
7. Save.
8. GitHub will provide the public Pages URL.

## Recommended classroom flow

1. **Setup**
   - Six teams.
   - $1,000 starting budget.
   - $50 minimum bid.
   - $50 bid increment.
   - Maximum two sources per team.

2. **Auction**
   - Run Lots A–F.
   - Groups bid verbally.
   - The host clicks the bidding group and then **SOLD!**

3. **Market Update**
   - Reveal Update #1 after roughly half the lots have sold.
   - Reveal Final Intelligence after the auction.

4. **Trading Floor**
   - Give teams 60 seconds.
   - They can sell, transfer or swap sources.
   - Use the host controls to record the final deal.

5. **Ranking**
   - Each group ranks all sources from strongest to weakest.
   - Enter orders such as `ABCDEF`.
   - Reveal the suggested ranking only after teams commit.

6. **Results**
   - Source points:
     - A = 12
     - B = 10
     - C = 8
     - D = 6
     - E = 3
     - F = 1
   - Cash bonus:
     - +1 per $100 remaining
     - capped at +5
   - Ranking bonus:
     - +3 if top three are exactly A-B-C
     - +1 if A is ranked strongest
     - +1 if F is ranked weakest

## Suggested source meanings

- **A** – recent peer-reviewed journal article
- **B** – Australian Government technical report
- **C** – recent academic conference paper
- **D** – company technical white paper
- **E** – Wikipedia article with references
- **F** – personal blog with no references

Treat the final ordering as a **suggested classroom ranking**, not a universal rule. The point of the debrief is to discuss why context, relevance, recency, evidence and possible bias matter.

## Editing content

Open `app.js`.

Near the top you will see the `lots` array. Edit:
- `title`
- `teaser`
- `update1`
- `final`

You can also change scoring in:

```js
const SOURCE_POINTS = { A: 12, B: 10, C: 8, D: 6, E: 3, F: 1 };
```

## Important limitation

This version is intentionally **static and host-controlled**.

If every project group opens the GitHub Pages link on separate phones/laptops, their browsers will not share live state with one another.

For the tutorial, the easiest setup is:
- one host laptop connected to the projector;
- teams bid verbally;
- the host records bids, sales, trades and rankings on the site.

A future version could add Firebase/Supabase for true multi-device live bidding.
