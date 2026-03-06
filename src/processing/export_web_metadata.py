import os
import json
import pandas as pd

PROCESSED_DIR = os.path.join('data', 'processed')
WEB_DIR = os.path.join('web')
FRONTEND_DIR = os.path.join('frontend', 'public')

def main():
    metadata_csv = os.path.join(PROCESSED_DIR, 'metadata.csv')
    df = pd.read_csv(metadata_csv)
    
    # Group by imageName just like in the Python backend
    db = {}
    
    for _, row in df.iterrows():
        img = row['imageName']
        if pd.isna(img):
            continue
            
        if img not in db:
            db[img] = {
                'songId': str(row['songId']),
                'title': str(row['title']),
                'artist': str(row['artist']),
                'version': str(row['version']),
                'releaseDate': str(row.get('releaseDate', '')),
                'intl': str(row.get('intl', '')),
                'unavailable_usa': bool(row.get('unavailable_usa', False)),
                'charts': []
            }
            
        db[img]['charts'].append({
            'type': str(row.get('type', '')),
            'difficulty': str(row.get('difficulty', '')),
            'level': str(row.get('level', '')),
            'internalLevel': str(row.get('internalLevelValue', ''))
        })

    out_file = os.path.join(WEB_DIR, 'metadata.json')
    out_file_front = os.path.join(FRONTEND_DIR, 'metadata.json')
    
    for f_path in [out_file, out_file_front]:
        os.makedirs(os.path.dirname(f_path), exist_ok=True)
        with open(f_path, 'w') as f:
            json.dump(db, f)
        
    print(f"Exported metadata for {len(db)} images to {out_file} and {out_file_front}")

    # Export last updated info
    import datetime
    mtime = os.path.getmtime(metadata_csv)
    last_updated = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M')
    
    info_file = os.path.join(WEB_DIR, 'info.json')
    info_file_front = os.path.join(FRONTEND_DIR, 'info.json')
    
    for f_path in [info_file, info_file_front]:
        os.makedirs(os.path.dirname(f_path), exist_ok=True)
        with open(f_path, 'w') as f:
            json.dump({'lastUpdated': last_updated}, f)
            
    print(f"Exported info.json with lastUpdated: {last_updated}")

if __name__ == '__main__':
    main()
