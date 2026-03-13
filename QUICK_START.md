# ⚡ Quick Start - TL;DR

## 🎯 Super Fast Setup (5 minutes)

### 1️⃣ Install Node.js
Download from: https://nodejs.org/

### 2️⃣ Open Terminal in Project Folder
```bash
cd path/to/marketing-studio
```

### 3️⃣ Install Dependencies
```bash
npm install
```

### 4️⃣ Add Your API Key
Edit `.env` file:
```env
GEMINI_API_KEY=AIzaSyC_your_actual_key_here
```

Get key from: https://makersuite.google.com/app/apikey

### 5️⃣ Start Server
```bash
npm start
```

### 6️⃣ Open Browser
Go to: http://localhost:3000

---

## 🔑 Where to Insert API Key

**File:** `.env`  
**Line:** `GEMINI_API_KEY=your_key_here`

**Example:**
```env
GEMINI_API_KEY=AIzaSyC-XYZ123abc...
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

---

## 📂 Updated File Structure

```
marketing-studio/
│
├── Frontend
│   ├── index.html          ← Updated (calls backend)
│   └── demo-video.html
│
├── Backend (NEW!)
│   ├── server.js           ← Node.js server
│   ├── package.json        ← Dependencies
│   ├── .env                ← 🔑 YOUR API KEY HERE
│   ├── .env.example        ← Template
│   └── .gitignore          ← Protects .env
│
└── Documentation
    ├── SETUP_GUIDE.md      ← Complete instructions
    ├── README.md
    ├── DOCUMENTATION.md
    └── TECHNICAL_SPEC.md
```

---

## 🚨 Common Issues

### "npm: command not found"
→ Install Node.js: https://nodejs.org/

### "API Key: ✗ Missing"
→ Check `.env` file has: `GEMINI_API_KEY=your_key`

### "Port 3000 already in use"
→ Change in `.env`: `PORT=3001`

### "Cannot connect to server"
→ Make sure server is running (`npm start`)

---

## ✅ Verification Checklist

Before running:
- [ ] Node.js installed (`node --version`)
- [ ] In project folder (`cd marketing-studio`)
- [ ] Dependencies installed (`npm install`)
- [ ] API key in `.env` file
- [ ] Server started (`npm start`)

---

## 🎮 Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies (once) |
| `npm start` | Start server |
| `npm run dev` | Start with auto-restart |
| `Ctrl + C` | Stop server |

---

## 🌐 URLs

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Main application |
| http://localhost:3000/api/health | Server health check |

---

## 🔒 Security

✅ **SAFE:** API key in `.env` file on server  
❌ **UNSAFE:** API key hardcoded in HTML/JavaScript  

Your setup is SAFE! ✅

---

## 💡 How It Works

```
Browser (index.html)
    ↓ sends request
Server (server.js) 
    ↓ reads .env
    ↓ adds API key
    ↓ calls Gemini
Gemini API
    ↓ returns result
Server
    ↓ sends to browser
Browser displays campaign
```

**Your API key NEVER touches the browser!**

---

## 📞 Need More Help?

Read: **SETUP_GUIDE.md** (complete step-by-step guide)

---

**Ready? Run these 3 commands:**

```bash
npm install
# Edit .env with your API key
npm start
# Open http://localhost:3000
```

**Done! 🎉**
