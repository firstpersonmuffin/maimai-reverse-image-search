# maimai Tools Portal

A collection of web-based utilities for maimai players, including a Reverse Image Search engine and a Pair Selection tool.

## Project Structure

- `src/scrape`: Scripts for fetching metadata and thumbnails from [arcade-songs](https://github.com/zetaraku/arcade-songs) and [arcade-songs-fetch](https://github.com/zetaraku/arcade-songs-fetch).
- `src/processing`: Core computer vision algorithms, built on OpenCV's SIFT descriptors and Flann based matching.
- `src/applet/backend`: A robust FastAPI backend exposing search functionality and statically serving the web frontend.
- `models`: Stores the precomputed `sift_cache.pkl` built from the chart thumbnails.
  - `raw/thumbnails`: Raw scraped image files for chart covers.
  - `processed/metadata.csv`: Parsed song metadata mapping for fast retrieval.
- `frontend`: React-based web portal containing multiple applets (Reverse Image Search, Pair Selection) styled with Tailwind CSS v4.

## Installation

### Prerequisites

- Python 3.8+
- pip (Python package manager)

### Quick Start

1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run Data Generation (Only required if you want to rebuild the local cache)**
   By default, the cache logic allows building your own database. If this is a fresh pull, you need to populate the database:

   ```bash
   # Download metadata and cover thumbnails 
   # (Note: Set to fetch Level 13+ Non-Utage songs by default)
   python src/scrape/fetch_data.py

   # Compute SIFT descriptors and store to models/sift_cache.pkl
   python src/processing/compute_sift.py
   ```

3. **Start the server**
   ```bash
   python -m uvicorn src.applet.backend.main:app --host 0.0.0.0 --port 8000
   ```
   Or if using npm scripts (optional setup):
   ```bash
   npm run start
   ```

4. **Open the web interface**
   Navigate your browser to [http://localhost:8000](http://localhost:8000).

## Usage

The application serves as a portal with multiple applets:

### 1. Reverse Image Search
- **File Upload via Drag and Drop:** Drag any cropped or uncropped screenshot of a maimai chart into the upload zone, or click it to browse files.
- **Clipboard Paste:** Copy an image to your clipboard and simply press `Ctrl+V` while on the webpage. 
- The application processes the image locally (via OpenCV WebAssembly) and displays the top matches, allowing robust difficulty and type filtering.

### 2. Pair Selection
- **Player Filtering:** Select rating brackets for Player 1 and Player 2 (<10k, 10k-15k in 500 increments, 15k-16.2k in 100 increments).
- **Chart Filtering:** Set internal level bounds and toggle STD/DX types.
- **Hidden Charts:** Hide specific charts per player using the "X" button (persisted in local storage). Easily unhide charts fitting the current filter criteria.
- **Matching:** Automatically finds and displays chart difficulties that simultaneously satisfy the constraints for both players.
