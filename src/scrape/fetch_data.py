import urllib.request
import json
import os
import pandas as pd
from urllib.error import HTTPError

DATA_URL = 'https://dp4p6x0xfi5o9.cloudfront.net/maimai/data.json'
IMG_BASE_URL = 'https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover/'

RAW_DIR = os.path.join('data', 'raw', 'thumbnails')
PROCESSED_DIR = os.path.join('data', 'processed')

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

def main():
    print("Downloading data.json...")
    req = urllib.request.Request(DATA_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
    
    songs = data.get('songs', [])
    print(f"Total songs found: {len(songs)}")
    
    chart_list = []
    
    for song in songs:
        if song.get('category') == '宴会場': # Utage
            continue
            
        has_valid_chart = False
        for sheet in song.get('sheets', []):
            if sheet.get('type') == 'utage':
                continue
            
            internal = sheet.get('internalLevelValue')
            level = sheet.get('levelValue')
            val = internal if internal is not None else level
            
            if val is not None:
                has_valid_chart = True
                
                chart_info = {
                    'songId': song['songId'],
                    'title': song['title'],
                    'artist': song['artist'],
                    'imageName': song['imageName'],
                    'version': song.get('version', ''),
                    'releaseDate': song.get('releaseDate', ''),
                    'intl': str(sheet.get('regions', {}).get('intl', False)),
                    'difficulty': sheet.get('difficulty'),
                    'type': sheet.get('type'),
                    'level': sheet.get('level'),
                    'internalLevelValue': internal,
                    'levelValue': level,
                    'note_tap': sheet.get('noteCounts', {}).get('tap', 0),
                    'note_hold': sheet.get('noteCounts', {}).get('hold', 0),
                    'note_slide': sheet.get('noteCounts', {}).get('slide', 0),
                    'note_touch': sheet.get('noteCounts', {}).get('touch', 0),
                    'note_break': sheet.get('noteCounts', {}).get('break', 0),
                    'note_total': sheet.get('noteCounts', {}).get('total', 0),
                }
                chart_list.append(chart_info)
                
        if has_valid_chart and song.get('imageName'):
            img_name = song['imageName']
            img_path = os.path.join(RAW_DIR, img_name)
            if not os.path.exists(img_path):
                img_url = IMG_BASE_URL + img_name
                try:
                    img_req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(img_req) as img_resp:
                        with open(img_path, 'wb') as f:
                            f.write(img_resp.read())
                    print(f"Downloaded {img_name} for '{song['title']}'")
                except HTTPError as e:
                    print(f"Failed to download {img_url}: {e}")
                except Exception as e:
                    print(f"Error downloading {img_url}: {e}")
                    
    df = pd.DataFrame(chart_list)
    out_csv = os.path.join(PROCESSED_DIR, 'metadata.csv')
    df.to_csv(out_csv, index=False)
    print(f"Saved metadata for {len(chart_list)} charts to {out_csv}")

if __name__ == '__main__':
    main()
