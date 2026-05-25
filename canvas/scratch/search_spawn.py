import os

app_path = r"e:\开发\ai-workflow-engine\canvas\src\App.tsx"
if os.path.exists(app_path):
    print("App.tsx exists!")
    with open(app_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    lines = content.splitlines()
    print(f"Total lines: {len(lines)}")
    
    # search for 'spawn' (case-insensitive) or 'spawnLinkedNode'
    for i, line in enumerate(lines):
        if "spawn" in line.lower() or "linked" in line.lower():
            print(f"Line {i+1}: {line.strip()}")
else:
    print("App.tsx does not exist at", app_path)
