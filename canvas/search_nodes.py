import os
import sys

output_path = "output_nodes_search.txt"
sys.stdout = open(output_path, "w", encoding="utf-8")

nodes_dir = r"src\components\nodes"
if os.path.exists(nodes_dir):
    for fn in os.listdir(nodes_dir):
        if fn.endswith(".tsx"):
            path = os.path.join(nodes_dir, fn)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            if "add-failure-log" in content or "CustomEvent" in content:
                print(f"File {fn} has add-failure-log or CustomEvent matches.")
                # find occurrences
                for line_idx, line in enumerate(content.splitlines()):
                    if "add-failure-log" in line or "CustomEvent" in line:
                        print(f"  Line {line_idx+1}: {line.strip()}")
else:
    print("Nodes dir not found")

sys.stdout.close()
