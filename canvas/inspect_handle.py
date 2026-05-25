import os
import sys

output_path = "output_handle.txt"
sys.stdout = open(output_path, "w", encoding="utf-8")

app_path = r"src\App.tsx"
if os.path.exists(app_path):
    with open(app_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    idx = content.find("handleInjectCommunityTemplate")
    if idx != -1:
        print("Found handleInjectCommunityTemplate at char index:", idx)
        print("Context:\n", content[idx-100:idx+1500])
    else:
        print("handleInjectCommunityTemplate NOT found")

sys.stdout.close()
