import json

with open('c:/dev/projects/2026/maimai_reverse_image/frontend/public/metadata.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

count_13_5 = 0
intl_false_13_5 = 0
intl_true_13_5 = 0
titles_intl_false = []

for filename, song in data.items():
    has_13_5 = False
    for chart in song.get('charts', []):
        if chart.get('internalLevel') == "13.5":
            has_13_5 = True
            break
    
    if has_13_5:
        count_13_5 += 1
        is_restricted = str(song.get('intl')).lower() in ['1', 'true', 'yes']
        if not is_restricted:
            intl_false_13_5 += 1
            titles_intl_false.append(song.get('title'))
        else:
            intl_true_13_5 += 1

print(f"Total songs with 13.5 charts: {count_13_5}")
print(f"International (intl: False) 13.5 songs: {intl_false_13_5}")
print(f"Japan-only (intl: True) 13.5 songs: {intl_true_13_5}")
print(f"International Titles: {titles_intl_false}")
