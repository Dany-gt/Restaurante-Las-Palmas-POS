import json, re
html = open('noun.html', 'r', encoding='utf-8', errors='ignore').read()
m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.+?)</script>', html)
data = json.loads(m.group(1))
icon = data['props']['pageProps']['initialState']['iconDetailPageSlice']['iconDetail']
print(icon.get('iconPath', 'No path found'))
