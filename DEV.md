# Development Guide: maimai Tools Portal

This project consists of a Python-based data processing pipeline and a React-based frontend portal.

## Project Structure

- `src/scrape/`: Python scripts for fetching song data from external repositories.
- `src/processing/`: Python scripts for computing image descriptors and exporting metadata.
- `frontend/`: React + Vite application (TypeScript).
- `docs/`: Compiled production build for GitHub Pages.
- `web/`: Legacy vanilla JS frontend (kept for reference/backend compatibility).

## Setup Instructions

### 1. Python Environment
Ensure you have Python 3.9+ installed.
```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### 2. Frontend Environment
```bash
cd frontend
npm install
```

## Running the Application

### Local Backend (FastAPI)
The backend is required for the "Remote" matching mode in the Image Search applet.
```bash
python -m uvicorn src.applet.backend.main:app --host 0.0.0.0 --port 8000
```

### Local Frontend (Vite)
Runs the React portal with hot-reloading.
```bash
cd frontend
npm run dev
```

## Data Management

### Updating the Song/Chart Database
If new songs are released or level constants change:

1. **Scrape New Data**:
   ```bash
   python src/scrape/fetch_data.py
   ```
2. **Export Metadata**:
   Syncs the scraped CSV data into the JSON format used by the frontend.
   ```bash
   python src/processing/export_web_metadata.py
   ```
   *Note: This script automatically updates both `web/metadata.json` and `frontend/public/metadata.json`.*

3. **Recompute SIFT (Optional)**:
   Only needed if thumbnails change or searching becomes inaccurate.
   ```bash
   python src/processing/extract_features.py
   ```

## Build & Deployment

The portal is hosted on GitHub Pages via the `/docs` folder.

1. **Build Production Bundle**:
   This script runs `npm run build` in the frontend and moves the output to `docs/`.
   ```bash
   python build_gh_pages.py
   ```
2. **Commit and Push**:
   ```bash
   git add .
   git commit -m "Update portal build"
   git push origin master
   ```

## Mocking GitHub Pages Locally
To verify routing and asset loading as it will appear on the live site:
```bash
# Uses Node 'serve' to mock the subdirectory path
mkdir -p mock_deploy/maimai-reverse-image-search
cp -r docs/* mock_deploy/maimai-reverse-image-search/
serve mock_deploy -l 8080
```
Then visit `http://localhost:8080/maimai-reverse-image-search/`.
