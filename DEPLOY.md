# Alcohol Detection System — Render Deployment Guide

## Project Structure

```
alcohol-detection-system/
├── app.py                  # Flask application + /detect endpoint
├── requirements.txt        # Python dependencies
├── render.yaml             # Render deployment config
├── gunicorn.conf.py        # Gunicorn server config
├── templates/
│   └── index.html          # Frontend UI (dark theme)
├── static/
│   ├── css/style.css       # Stylesheet
│   └── js/app.js           # Camera & API logic
└── sample_data/
    └── sample_response.json  # Sample API responses
```

## API Endpoint

### POST /detect

Send a base64-encoded image and receive a detection result.

**Request:**
```json
{
  "image": "data:image/jpeg;base64,<base64-encoded-image>"
}
```

**Response:**
```json
{
  "success": true,
  "result": "Drunk",
  "status": "drunk",
  "confidence": 78.3,
  "face_detected": true,
  "message": "Detection complete"
}
```

`result` is always one of: `"Drunk"`, `"Not Drunk"`, `"No Face Detected"`, `"Error"`

### GET /health

Returns service health status.

```json
{ "status": "ok", "service": "Alcohol Detection System" }
```

## Deploying on Render

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Alcohol Detection System"
git remote add origin https://github.com/YOUR_USERNAME/alcohol-detection-system.git
git push -u origin main
```

### Step 2 — Create a New Web Service on Render

1. Go to [https://render.com](https://render.com) and sign in.
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository.
4. Render will auto-detect `render.yaml`. If not, configure manually:
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`

### Step 3 — Set Environment Variables (Optional)

| Key         | Value       |
|-------------|-------------|
| FLASK_ENV   | production  |

### Step 4 — Deploy

Click **Create Web Service**. Render will:
1. Install dependencies from `requirements.txt`
2. Start the app with Gunicorn
3. Provide a live URL like `https://alcohol-detection-system.onrender.com`

## Local Development

```bash
cd alcohol-detection-system
pip install -r requirements.txt
python app.py
```

Open http://localhost:5000

## Detection Logic

The system uses **OpenCV's Haar Cascade** for face detection. When a face is detected, a random probability score determines the result (for demonstration). Replace the `detect_intoxication_logic()` function in `app.py` with real ML inference for production use.
