# Sketch-Guess Duel

A **lightweight**, **asynchronous** 3-player “telephone” game: **Prompt → Draw (5s) → Add lines without the prompt (5s) → Guess**. Built as a **mobile web app** (HTML + Canvas + Firebase). Works well on older phones because it only stores **stroke coordinates**, not heavy images.

## Try it now (no setup)

1. Open `index.html` in a browser (Chrome/Safari on phone is ideal).
2. Tap **Local demo (same phone, 3 turns)** to run all three phases on one device—great for testing.

## Play with friends (online)

You need a **hosted URL** everyone can open (phone browsers) and a **Firebase** project (free tier is enough).

### 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/) → **Add project**.
2. Enable **Firestore** (Create database → start in **test mode** for quick setup, or publish the rules below).
3. Project **Settings** (gear) → **Your apps** → **Web** (`</>`) → register app → copy the `firebaseConfig` object.

### 2. Configure this game

1. Copy `js/config.example.js` to `js/config.js` (or edit `js/config.js`).
2. Set `useFirebase: true` and paste your `apiKey`, `authDomain`, `projectId`, etc.

### 3. Firestore rules

Deploy rules (Firebase Console → Firestore → Rules) or use the CLI. For a private friend group, the included `firestore.rules` allows read/write on `sketchGuessGames/{gameId}`.  
**Note:** `if true` is convenient but **not** safe for public production. For real launch, add **Firebase Authentication** and tighten rules.

### 4. Host the files

Upload the whole folder to **Netlify**, **Vercel**, **GitHub Pages**, or **Firebase Hosting** so you get an `https://...` link. HTTPS is recommended for mobile and for Firebase.

### 5. How a round works

| Player | What they do |
|--------|----------------|
| **Player 1** | Taps **New game (I’m Player 1)**. Sees a random prompt, draws for **5 seconds**, submits. |
| **Player 2** | Opens the **invite link** or taps **Join with code** and enters the code. Sees only Player 1’s lines (white), adds their own (green) for **5 seconds**. |
| **Player 3** | Same—join link or code. Sees the **combined** drawing and **types a guess** for the original prompt. |
| **Everyone** | The **result** screen shows the real prompt vs the guess and the full picture. |

**Tips**

- Player 1 should **finish first**, then share the code or link with Player 2, then Player 2 with Player 3.
- Invite links look like: `https://yoursite.com/index.html?g=ABCDE&r=2` (Player 2) or `&r=3` (Player 3). Opening that link auto-joins when Firebase is configured.
- Player 1’s browser **remembers** games they created (`sessionStorage`) so only they get the prompt screen for a new game.

## Install on phone (optional)

- **iPhone:** Safari → Share → **Add to Home Screen**.  
- **Android:** Chrome → menu → **Install app** / **Add to Home screen**.  
`manifest.json` is included for a simple PWA-style install.

## “Gallery” (save to camera roll)

On the result screen, use the phone’s **screenshot** (power + volume, or OS shortcut). That’s the most reliable way to save the canvas without extra native code.

## Project layout

- `index.html` – UI
- `css/style.css` – mobile-first styles
- `js/app.js` – drawing, timer, phases, Firestore sync
- `js/config.js` – your Firebase toggle + keys (don’t commit real keys to public repos)
- `firestore.rules` – example security rules

## Tech notes

- Strokes are stored as normalized **0–1** coordinates so drawings scale on different screens.
- **5 second** drawing phases use a simple countdown; input is disabled after time (submit still fires).

Enjoy the chaos.
