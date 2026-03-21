import os
import glob

components = glob.glob('client/src/components/classroom/*.tsx') + ['client/src/pages/ClassroomPage.tsx']

for path in components:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # In classroom components
    content = content.replace("from './Icons.js';", "from '../Icons.js';")
    # In pages
    content = content.replace("from '../components/classroom/Icons.js';", "from '../components/Icons.js';")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Icons import paths fixed!")
