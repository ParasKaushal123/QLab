import os, re
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('dist', exist_ok=True)
order=['simlib','tests','kit','ink','code','passes','score','grade','templates','runner','backends','views','llm','tutor','icons-data','board','stage','course-ch2','course','journey','home','algos','screens','compare','validation','lab','workbench','tour','scriptcards','blocks','platform','shell']
js='\n'.join(open(f+'.js', encoding='utf-8').read() for f in order).replace('if (typeof module !== \'undefined\') module.exports = PHYSICS_TESTS;','')
css=open('tokens.css', encoding='utf-8').read()+open('ui.css', encoding='utf-8').read()+open('screens.css', encoding='utf-8').read()+open('workbench.css', encoding='utf-8').read()
html=open('shell.html', encoding='utf-8').read().replace('/*CSS*/',css).replace('/*JS*/',js)
open('dist/index.html','w', encoding='utf-8').write(html)
open('dist/bundle.js','w', encoding='utf-8').write(js)
import shutil
for c in ['../../validation.json', '../services/runner/validation.json', 'validation.json']:
    if os.path.exists(c):
        shutil.copy(c, 'dist/validation.json')
        break
print(len(html))
