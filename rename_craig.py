import os
import re

directories = ['src']

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Case-insensitive replacement, matching original case roughly.
    # Craig -> Admin
    # craig -> admin
    # CRAIG -> ADMIN
    
    # We can do this with re.sub with a function
    def replacer(match):
        word = match.group()
        if word == 'Craig': return 'Admin'
        if word == 'craig': return 'admin'
        if word == 'CRAIG': return 'ADMIN'
        return 'Admin' # Fallback
        
    new_content = re.sub(r'(?i)\bcraig\b', replacer, content)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {file_path}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            process_file(os.path.join(root, file))

# Rename files if necessary
for root, _, files in os.walk('src'):
    for file in files:
        if 'Craig' in file:
            old_path = os.path.join(root, file)
            new_path = os.path.join(root, file.replace('Craig', 'Admin'))
            os.rename(old_path, new_path)
            print(f"Renamed {old_path} to {new_path}")
