# 🐻💕 Dudu & Bubu Adventure — Game Guide

## ✅ Game is Running!

The server is live at:
- **Local**: [http://localhost:3000](http://localhost:3000)
- **LAN (Player 2)**: http://192.168.56.1:3000

---

## 🎮 How to Start Playing

### Step 1 — Player 1 (Dudu 🐻 Brown Bear)
1. Open **http://localhost:3000** in your browser
2. Click **"Create Room"**
3. You'll see a **4-letter room code** (e.g. `AB3X`)
4. Share that code with Player 2!

### Step 2 — Player 2 (Bubu 🐻 White Bear)
1. Open the **LAN URL** in your browser: `http://192.168.56.1:3000`
   - Or open `http://localhost:3000` on the **same laptop** to test
2. Type the room code and click **"Join Room"**
3. The game starts automatically! 🎉

---

## 🕹️ Controls

| Player | Character | Move | Jump |
|--------|-----------|------|------|
| **Player 1** | 🐻 Dudu (Brown) | `W A S D` | `W` or `Space` |
| **Player 2** | 🐻 Bubu (White) | `← ↑ → ↓` | `↑` or `Enter` |

---

## 🗺️ The 5 Levels

| # | Level | Challenge |
|---|-------|-----------|
| 1 | 🌸 Sweet Meadow | Tutorial — 1 key, meet at heart portal |
| 2 | 🍯 Honey Forest | Split up — each find a key, reunite |
| 3 | 🌺 Blossom Bridge | **Pressure plate puzzle** — one holds button, other passes |
| 4 | ☁️ Cloud Steps | Climb high clouds, grab 2 keys |
| 5 | 💕 Summit of Hearts | Final challenge — 3 keys + pressure plate + big jumps |

---

## 💡 Pico Park Cooperative Rules

> **Both bears MUST be inside the Heart Portal 💖 at the same time to complete a level!**

- 🔑 **Keys**: Walk into them to collect. Either bear can grab any key.
- 🟡 **Pressure Plates**: Stand on the yellow button to open the red wall. One bear holds it while the other passes through!
- 💖 **Heart Portal**: Only activates (glows pink) when ALL keys are collected. Then BOTH bears step in together!

---

## 🌐 Two Laptops on Different Networks?

If you're not on the same WiFi, use **ngrok** to get a public URL:

```bash
npx ngrok http 3000
```

Share the ngrok URL with Player 2 — they can play from anywhere in the world! 🌍

---

## 🔄 To Restart the Server

```bash
node server.js
```

Run this in the `krishna` folder.

---

## 🚀 Deployment

### Option 1: Railway (Recommended for Socket.io)
This project is already configured for **Railway**. It supports persistent WebSockets which is perfect for this game.
1. Create a [Railway account](https://railway.app/).
2. Connect your GitHub repo.
3. Railway will automatically detect the `railway.toml` and deploy!

### Option 2: Vercel
I have added a `vercel.json` to support Vercel.
1. Install [Vercel CLI](https://vercel.com/download): `npm i -g vercel`
2. Run `vercel` in the project root.
3. Follow the prompts to deploy.
> [!WARNING]
> Socket.io behaves differently on Vercel (serverless). Connections might drop after a few minutes of inactivity. For a stable game, Railway is better!
