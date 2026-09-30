# The Source Auction — Live Room Version

## Visual design

This build includes a colorful animated auction theme, glass-style panels, animated background orbs, hover effects, live-status pulses, source color coding, reveal animations, and a confetti + SOLD animation. Motion automatically reduces for users who prefer reduced motion.


This version is built for your exact classroom flow:

- **You are the only auctioneer/host.**
- Students do **not** place auction bids from their devices.
- The six project groups can join using:
  - one shared **room code**;
  - their own **group number**;
  - a private **4-digit team PIN**.
- When you click **Open Ranking**, each joined group automatically gets the ranking interface.
- Each group submits **one final ranking** from its own phone/laptop.
- Your host screen receives the rankings live and uses them in the final score.

## Why Firebase is required

GitHub Pages is a static host. By itself it cannot share live room state between your laptop and six student devices.

This project therefore uses:

- **GitHub Pages** — hosts the website.
- **Firebase Authentication (Anonymous)** — gives every browser a temporary identity.
- **Cloud Firestore** — stores the room, teams and final rankings in real time.

You only need to set Firebase up once.

---

# Part 1 — Create a Firebase project

1. Go to the Firebase Console.
2. Click **Create a project**.
3. Give it a name such as:
   `source-auction-gsoe9010`
4. Google Analytics is optional for this classroom project.

---

# Part 2 — Enable Anonymous Authentication

1. Open your Firebase project.
2. Go to **Build → Authentication**.
3. Click **Get started**.
4. Open **Sign-in method**.
5. Enable **Anonymous** sign-in.
6. Save.

This lets the host and each team browser receive a temporary identity without asking students to make accounts.

---

# Part 3 — Create Firestore

1. Go to **Build → Firestore Database**.
2. Click **Create database**.
3. Choose a Firestore location close to you.
4. Start in **Production mode**.
5. Create the database.

---

# Part 4 — Install the supplied Firestore rules

Open:

**Firestore Database → Rules**

Delete the existing rules and paste the full contents of:

`firestore.rules`

Then click **Publish**.

These rules do the important separation:

- only the host browser can control auction data;
- team PINs are only readable by the host;
- a group can only join with its correct PIN;
- teams can only submit while the host has opened ranking;
- each group gets one final ranking submission.

---

# Part 5 — Register the website in Firebase

1. Open **Project settings** in Firebase.
2. Scroll to **Your apps**.
3. Click the **Web** icon (`</>`).
4. Give the app a name such as:
   `Source Auction Web`
5. You do NOT need Firebase Hosting because you are using GitHub Pages.
6. Register the app.
7. Firebase will show a configuration object that looks similar to:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Open:

`firebase-config.js`

Replace the placeholder values with the values Firebase gives you.

Do not change the variable name or the `export` line.

---

# Part 6 — Test locally

Because this version uses JavaScript modules, use a local web server instead of double-clicking the HTML file.

From the project folder:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

Test:

1. Open **Host the Game**.
2. Create a room.
3. Note the room code and one team PIN.
4. Open another browser/incognito window or phone.
5. Open:
   `http://YOUR-COMPUTER-IP:8000/team.html`
   if testing over your local network, or simply use another tab for a basic same-computer test.
6. Join with the room code + team PIN.
7. On the host, click **Open Ranking**.
8. Confirm the team screen automatically shows the ranking list.
9. Submit.
10. Confirm the host screen immediately shows the submitted ranking.

For the real tutorial, GitHub Pages will make this much easier because every phone can open the public URL.

---

# Part 7 — Put it on GitHub Pages

Upload these files to the ROOT of your GitHub repository:

```text
index.html
host.html
team.html
styles.css
host.js
team.js
game-data.js
firebase-config.js
firestore.rules
README.md
```

Then:

1. Repository → **Settings**
2. **Pages**
3. Source → **Deploy from a branch**
4. Branch → `main`
5. Folder → `/ (root)`
6. Save

Your public link will look similar to:

```text
https://YOUR-GITHUB-USERNAME.github.io/source-auction-live/
```

Host opens:

```text
https://YOUR-GITHUB-USERNAME.github.io/source-auction-live/host.html
```

Students can open:

```text
https://YOUR-GITHUB-USERNAME.github.io/source-auction-live/team.html
```

Or simply open the root page and tap **Join as a Project Group**.

---

# Classroom flow

## Before class

1. Open the website on your laptop.
2. Open **Host the Game**.
3. Click **Create Room**.
4. Project the:
   - room code;
   - six group PINs.

Example:

```text
ROOM: X7KQ2

Group 1: 4821
Group 2: 7034
Group 3: 1662
Group 4: 9450
Group 5: 3218
Group 6: 5571
```

Each project group needs only ONE phone/laptop to submit.

## During the auction

You conduct all bidding verbally.

When a group calls a bid:
- click that group on your host screen.

When bidding ends:
- click **SOLD!**

Student devices do not control bidding.

## Market update

Use:

- **Reveal Update #1**
- **Reveal Final Intelligence**

You remain in control of these.

## Trading

Teams negotiate verbally in the classroom.

You record the agreed:
- source transfer;
- purchase;
- swap

on the host page.

## Final ranking

When you are ready:

1. Open **Team Ranking** on the host page.
2. Click **Open Ranking**.
3. Every joined student group automatically sees the six-source ranking screen.
4. They use ↑ / ↓ controls to rank:
   - strongest source at the top;
   - weakest source at the bottom.
5. One person from the group presses **Submit Final Ranking**.
6. Their submission appears live on your screen.
7. Once all six groups have submitted, click **Close Ranking**.
8. Open **Results**.

---

# Scoring currently used

## Source ownership

- A = 12 points
- B = 10
- C = 8
- D = 6
- E = 3
- F = 1

## Cash

- +1 point for every $100 remaining
- maximum cash bonus = +5

## Final ranking

- +3 if the group's top three are exactly A → B → C
- +1 if A is ranked strongest
- +1 if F is ranked weakest

You can change these numbers in:

`game-data.js`

and the `rankingBonus()` function in `host.js`.

---

# Important classroom note

Treat:

`A → B → C → D → E → F`

as your **suggested ranking for this designed exercise**, not as a universal law about source types.

The educational discussion is more important than the exact numbers.

For example, you can ask:

- Could a government report be stronger than a journal article for a particular question?
- When might a company white paper still be useful?
- Can Wikipedia be useful for finding original sources even when it is not the source you ultimately cite?
- Can a high-quality paper still be irrelevant to the actual project question?

---

# If a team submits the wrong ranking accidentally

This version intentionally allows **one final submission per team**.

If there is a genuine mistake:

1. Open Firebase Console.
2. Firestore Database.
3. Find:
   `rooms → ROOMCODE → submissions → TEAMNUMBER`
4. Delete that one submission document.
5. The group can then submit again while ranking is still open.

For the tutorial, tell teams to agree before they press Submit.

---

# Files you normally edit

### Source text / hidden clues
`game-data.js`

### Firebase connection
`firebase-config.js`

### Styles
`styles.css`

### Scoring / host behaviour
`host.js`

### Team ranking behaviour
`team.js`
