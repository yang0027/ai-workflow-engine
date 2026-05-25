# -*- coding: utf-8 -*-
import re

with open(r'e:\开发\ai-workflow-engine\canvas\src\App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.splitlines()
print(f"Total lines: {len(lines)}")

# Let's search for some patterns
keywords = ["MiniMap", "minimap", "Map", "map", "地图", "缩略图", "panel", "zoom", "control", "Control"]
for kw in keywords:
    matches = []
    for idx, line in enumerate(lines):
        if re.search(r'\b' + re.escape(kw) + r'\b', line, re.IGNORECASE) or (kw in line):
            matches.append((idx + 1, line.strip()))
    print(f"\n--- Keyword '{kw}' matches: {len(matches)} ---")
    for num, text in matches[:30]:
        print(f"Line {num}: {text[:120]}")
