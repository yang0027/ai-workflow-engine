import os
import sys

output_path = "output_handle_full.txt"
sys.stdout = open(output_path, "w", encoding="utf-8")

app_path = r"src\App.tsx"
if os.path.exists(app_path):
    with open(app_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    # We want to print lines 600 to 750 (1-indexed: 599 to 749)
    # Wait, let's find the line index where "handleInjectCommunityTemplate" is defined
    start_line = -1
    for idx, line in enumerate(lines):
        if "const handleInjectCommunityTemplate =" in line:
            start_line = idx
            break
    
    if start_line != -1:
        print(f"Starting from line {start_line+1}:")
        for i in range(start_line, min(len(lines), start_line + 150)):
            print(f"{i+1}: {lines[i]}", end="")
    else:
        print("handleInjectCommunityTemplate NOT found")

sys.stdout.close()
