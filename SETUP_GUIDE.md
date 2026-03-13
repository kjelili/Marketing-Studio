# 🚀 Complete Setup Guide with Environment Variables

## 📋 Overview

This guide shows you how to run the Direct-to-Mood Marketing Studio with your Gemini API key securely stored in a `.env` file (NOT hardcoded in the application).

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend      │  (index.html - runs in browser)
│   index.html    │
└────────┬────────┘
         │ HTTP Request
         ↓
┌─────────────────┐
│   Backend       │  (server.js - Node.js server)
│   server.js     │  Reads API key from .env
└────────┬────────┘
         │ API Call with key
         ↓
┌─────────────────┐
│  Gemini API     │  (Google's AI service)
└─────────────────┘
```

**Security:** Your API key stays on the server, never exposed to the browser!

---

## 📦 What's Included

```
marketing-studio/
├── index.html              # Frontend application
├── server.js               # Backend API server
├── package.json            # Node.js dependencies
├── .env                    # 🔑 YOUR API KEY GOES HERE
├── .env.example            # Template for .env
├── .gitignore              # Protects .env from git
├── demo-video.html         # Feature showcase
└── documentation files...
```

---

## 🔧 Setup Instructions

### Step 1: Install Node.js

**Check if you have Node.js:**
```bash
node --version
```

**If not installed, download from:**
- https://nodejs.org/ (get LTS version)

**Verify installation:**
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

### Step 2: Navigate to Project Folder

```bash
cd path/to/marketing-studio
```

For example:
```bash
# Windows
cd C:\Users\YourName\Downloads\marketing-studio

# Mac/Linux
cd ~/Downloads/marketing-studio
```

### Step 3: Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web server framework
- `dotenv` - Environment variable loader
- `cors` - Cross-origin resource sharing
- `axios` - HTTP client for API calls
- `nodemon` - Auto-restart during development

**Expected output:**
```
added 57 packages, and audited 58 packages in 3s
```

### Step 4: Get Your Gemini API Key

**Option A: Google AI Studio (Easiest)**

1. Go to: https://makersuite.google.com/app/apikey
2. Click **"Create API Key"**
3. Copy the key (starts with `AIza...`)

**Option B: Google Cloud Console**

1. Go to: https://console.cloud.google.com/
2. Create/select a project
3. Enable **"Generative Language API"**
4. Go to **APIs & Services → Credentials**
5. Click **"Create Credentials" → "API Key"**
6. Copy the key

### Step 5: Configure .env File

**Open `.env` file in a text editor:**

```bash
# Use any text editor
code .env          # VS Code
nano .env          # Terminal
notepad .env       # Windows Notepad
```

**Replace the placeholder with your actual key:**

```env
# Gemini API Configuration
GEMINI_API_KEY=AIzaSyC_your_actual_api_key_here_xyz123

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Settings
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000
```

**⚠️ Important:**
- NO spaces around the `=` sign
- NO quotes around the value
- Keep the key on one line
- Save the file

### Step 6: Verify .env File

**Check that your .env looks correct:**

```bash
# Mac/Linux
cat .env

# Windows (Command Prompt)
type .env

# Windows (PowerShell)
Get-Content .env
```

**Should show:**
```
GEMINI_API_KEY=AIzaSyC...your-key...
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000
```

---

## ▶️ Running the Application

### Start the Server

```bash
npm start
```

**You should see:**
```
╔════════════════════════════════════════════════════════╗
║                                                        ║
║  🎨 Direct-to-Mood Marketing Studio Server            ║
║                                                        ║
║  Status: Running ✓                                     ║
║  Port: 3000                                           ║
║  Environment: development                              ║
║                                                        ║
║  Endpoints:                                            ║
║  • GET  /api/health                                    ║
║  • POST /api/generate-campaign                         ║
║                                                        ║
║  Frontend: http://localhost:3000                      ║
║  API Key: ✓ Configured                                ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
```

**⚠️ If you see "API Key: ✗ Missing":**
- Check your .env file
- Make sure the file is named exactly `.env` (not `env.txt` or `.env.txt`)
- Restart the server after fixing

### Open the Application

**In your browser, go to:**
```
http://localhost:3000
```

Or click the link in the terminal output.

---

## 🧪 Testing

### Test 1: Health Check

**In your browser, visit:**
```
http://localhost:3000/api/health
```

**Should show:**
```json
{
  "status": "ok",
  "message": "Server is running",
  "timestamp": "2026-03-07T..."
}
```

### Test 2: Generate Campaign

1. Open http://localhost:3000
2. Enter a business description
3. Select a mood
4. Click "Generate Campaign"
5. Wait 3-5 seconds
6. See your AI-generated campaign!

### Test 3: Browser Console

**Open browser console (F12) and check for:**
- ✅ No errors
- ✅ Successful API calls in Network tab

---

## 🔍 Troubleshooting

### Problem: "npm: command not found"

**Solution:** Install Node.js from https://nodejs.org/

### Problem: "Cannot find module 'dotenv'"

**Solution:**
```bash
npm install
```

### Problem: "API Key: ✗ Missing"

**Solution:**
1. Check `.env` file exists
2. Verify `GEMINI_API_KEY=` line has your key
3. No extra spaces or quotes
4. Restart server

### Problem: "CORS policy violation"

**Solution:**
Add your domain to `.env`:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://yourdomain.com
```

### Problem: "Failed to generate campaign"

**Check:**
1. Server is running (terminal shows server output)
2. API key is valid (test at https://makersuite.google.com/)
3. Internet connection is working
4. No firewall blocking the request

**View detailed errors:**
- Open browser console (F12)
- Check terminal/server logs
- Look for error messages

### Problem: Port 3000 already in use

**Solution 1: Use different port**

Edit `.env`:
```env
PORT=3001
```

Then visit http://localhost:3001

**Solution 2: Kill process on port 3000**

```bash
# Mac/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <process-id> /F
```

---

## 🔒 Security Best Practices

### ✅ DO:
- Keep `.env` in `.gitignore`
- Use different API keys for dev/production
- Rotate API keys periodically
- Set API quotas in Google Cloud
- Use environment variables in production

### ❌ DON'T:
- Commit `.env` to git
- Share your API key publicly
- Hardcode keys in code
- Use production keys in development
- Expose keys in frontend JavaScript

---

## 🚀 Development Mode

**Auto-restart on file changes:**

```bash
npm run dev
```

This uses `nodemon` to automatically restart the server when you edit files.

---

## 📦 Production Deployment

### Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Add environment variable in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add `GEMINI_API_KEY` with your key

### Netlify

1. Install Netlify CLI:
```bash
npm i -g netlify-cli
```

2. Create `netlify.toml`:
```toml
[build]
  command = "npm install"
  publish = "."

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

3. Convert `server.js` to serverless function
4. Deploy and add env vars in dashboard

### Railway / Render / Fly.io

1. Connect your GitHub repo
2. Add environment variables in dashboard
3. Deploy automatically

---

## 🧹 Cleanup / Stop Server

**Stop the server:**
- Press `Ctrl + C` in the terminal

**Uninstall:**
```bash
npm uninstall
rm -rf node_modules
```

---

## 📁 File Descriptions

| File | Purpose |
|------|---------|
| `.env` | 🔑 Stores your API key (NEVER commit to git) |
| `.env.example` | Template showing what .env should look like |
| `.gitignore` | Prevents .env from being committed to git |
| `server.js` | Backend server that calls Gemini API |
| `package.json` | Lists Node.js dependencies |
| `index.html` | Frontend application |

---

## 🎯 Quick Reference

### Start Server
```bash
npm start
```

### Development Mode (auto-restart)
```bash
npm run dev
```

### Check Server Health
```
http://localhost:3000/api/health
```

### View Application
```
http://localhost:3000
```

### Stop Server
```
Ctrl + C
```

---

## 💡 Tips

1. **Keep terminal open** while using the app
2. **Check server logs** for debugging
3. **Use browser console** to see errors
4. **Test API key** at https://makersuite.google.com/
5. **Read server output** for helpful messages

---

## 📞 Still Need Help?

1. Check that `.env` file has your API key
2. Verify Node.js is installed (`node --version`)
3. Make sure dependencies are installed (`npm install`)
4. Check server is running (terminal shows server output)
5. Look at browser console for errors (F12)
6. Check server terminal for error messages

---

## ✅ Final Checklist

Before running:
- [ ] Node.js installed
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created
- [ ] API key added to `.env`
- [ ] `.gitignore` includes `.env`

To run:
- [ ] Server started (`npm start`)
- [ ] Browser opened to http://localhost:3000
- [ ] Test campaign generated successfully

---

**🎉 You're all set!** Your API key is now secure in the `.env` file and the application is ready to use!

For detailed documentation, see:
- `README.md` - General overview
- `DOCUMENTATION.md` - User guide
- `TECHNICAL_SPEC.md` - Technical details
