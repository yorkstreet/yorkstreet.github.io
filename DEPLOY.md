# Deployment Guide

## Step 1: Firebase Console Setup

1. Go to https://console.firebase.google.com/ and open project `yorkstreet-c3534`
2. **Authentication** → Sign-in method → Enable **Email/Password** and **Anonymous**
3. **Realtime Database** → Rules → Replace with rules from `firebase.rules.json` → Publish
4. **Firestore Database** → Rules → Replace with rules from `firebase.rules.json` → Publish

## Step 2: Deploy (GitHub Pages)

```bash
git init
git add .
git commit -m "Initial commit"
# Create repo on GitHub, then:
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

Then in GitHub repo Settings → Pages → deploy from `main` branch `/root`.

Your site will be at `https://<username>.github.io/<repo-name>/`

## Step 3: First-Time Setup

1. Open `https://<username>.github.io/<repo-name>/init.html`
2. Enter admin email and password (8+ chars) → Click "Initialize System"
3. This creates your Firebase Auth account + Firestore schema
4. Then go to the admin login page

## Step 4: Open on Displays

Open `https://<username>.github.io/<repo-name>/monitor.html` on each display device, enter a name.

## File Structure

```
/              
├── index.html                   # Landing page
├── monitor.html                 # Display view
├── init.html                    # First-time setup
├── admin/
│   ├── login.html               # Admin login
│   ├── dashboard.html           # Dashboard + notifications
│   ├── media.html               # Media upload
│   ├── presentations.html       # Presentation builder
│   └── monitors.html            # Monitor management
├── css/
│   ├── style.css                # Base styles
│   ├── admin.css                # Admin styles
│   └── monitor.css              # Display styles
├── js/
│   ├── config.js                # Firebase + Cloudinary config
│   ├── firebase-init.js         # Firebase init
│   ├── app.js                   # Shared utils
│   ├── admin-auth.js            # Auth guard
│   ├── admin-dashboard.js       # Dashboard logic
│   ├── admin-media.js           # Media management
│   ├── admin-presentations.js   # Presentation CRUD
│   ├── admin-monitors.js        # Monitor management
│   └── monitor.js               # Display logic
├── firebase.rules.json          # Security rules
└── DEPLOY.md                    # This file
```
