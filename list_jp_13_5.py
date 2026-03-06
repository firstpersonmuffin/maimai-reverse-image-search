import json

with open('c:/dev/projects/2026/maimai_reverse_image/frontend/public/metadata.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

titles_intl_true = []

for filename, song in data.items():
    has_13_5 = False
    for chart in song.get('charts', []):
        if chart.get('internalLevel') == "13.5":
            has_13_5 = True
            break
    
    if has_13_5:
        is_restricted = str(song.get('intl')).lower() in ['1', 'true', 'yes']
        if is_restricted:
            titles_intl_true.append(song.get('title'))

print(f"Total Japan-only (intl: True) 13.5 songs: {len(titles_intl_true)}")
print(f"Titles: {titles_intl_true[:20]}...")
