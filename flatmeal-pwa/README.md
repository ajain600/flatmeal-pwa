# 🍽️ Flat Meal Planner — PWA

A Progressive Web App for flatmates to vote on daily meals and notify their cook via WhatsApp.

---

## ✅ Features
- Vote for Breakfast, Lunch, Dinner
- Live vote bar chart
- WhatsApp integration (one tap to send)
- Push notifications at meal times
- Installs on iPhone & Android like a real app
- Settings for flatmates, cook, meal options, message format
- Works offline

---

## 🚀 Host for Free in 4 Steps

### STEP 1 — Install Node.js
Go to **nodejs.org** → Download **LTS** → Install

### STEP 2 — Set up the project
Open Terminal (Mac) or Command Prompt (Windows):

```bash
# Navigate to this folder
cd flatmeal-pwa

# Install dependencies
npm install

# Test it locally (opens in browser)
npm run dev
```

Visit `http://localhost:5173` — you should see the app ✅

### STEP 3 — Put it on GitHub
1. Go to **github.com** → Sign up free
2. Click **+** → **New repository**
3. Name: `flatmeal-pwa` → **Public** → **Create**
4. In your terminal (inside flatmeal-pwa folder):

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/flatmeal-pwa.git
git push -u origin main
```
Replace YOUR_USERNAME with your GitHub username.

### STEP 4 — Deploy to Vercel (free forever)
1. Go to **vercel.com** → Sign up with GitHub (free)
2. Click **Add New Project**
3. Select `flatmeal-pwa` from your repos
4. Click **Deploy** — wait ~60 seconds ⏳
5. You get a link like: `https://flatmeal-pwa.vercel.app` 🎉

---

## 📱 Install on Phones (Add to Home Screen)

### iPhone
1. Open your Vercel link in **Safari** (must be Safari)
2. Tap the **Share** button (box with arrow ↑)
3. Scroll down → **Add to Home Screen**
4. Tap **Add** — done!

### Android
1. Open link in **Chrome**
2. Tap **3 dots menu** (top right)
3. Tap **Add to Home Screen**
4. Tap **Add** — done!

The app will appear on the home screen with an orange icon 🟠

---

## ⚙️ First-Time Setup (inside the app)
1. Open the app → go to **Settings** tab
2. **People** section:
   - Add your flatmates' names
   - Enter cook's WhatsApp number (with country code, e.g. 919876543210)
   - Enter your Vercel app link
3. **Meals** section: Add/remove meal options
4. **Timing** section: Set what time voting opens
5. Tap **Save All Settings**
6. Tap **Enable Notifications** — allow when browser asks

---

## 📤 Share with Flatmates
Settings → People → **Share via WhatsApp**
Everyone installs it in 10 seconds — just one link.

---

## 🔄 Update the app anytime
Make changes → in terminal:
```bash
git add .
git commit -m "update"
git push
```
Vercel redeploys automatically in ~30 seconds. Same link forever.
