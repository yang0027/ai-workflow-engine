import os

keywords = ['download', 'Download', 'zoom', 'Zoom', '放大', '下载']
src_dir = os.path.join('canvas', 'src')

print(f"Scanning directory: {os.path.abspath(src_dir)}")

results = []
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx', '.css', '.js')):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                found = []
                for kw in keywords:
                    if kw in content:
                        found.append(kw)
                if found:
                    results.append(f"{filepath}: found {found}")
            except Exception as e:
                results.append(f"Error reading {filepath}: {str(e)}")

print(f"Total files found with keywords: {len(results)}")
for r in results:
    print(r)
