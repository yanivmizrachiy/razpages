from pathlib import Path

p = Path('summary-5.html')
s = p.read_text(encoding='utf-8')

s = s.replace('<section class="sheet page" aria-label="לוח אירועים">', '<section class="sheet page" aria-label="מצפן">', 1)
s = s.replace('<div class="page-head"><div><h2 class="page-title">לוח אירועים</h2>', '<div class="page-head"><div><h2 class="page-title">מצפן</h2>', 1)
s = s.replace('<section class="sheet page" aria-label="מה צפוי">\n  <div class="page-head">', '<section class="sheet page" aria-label="מה צפוי">\n  <div class="page-head upcoming-head">', 1)

anchor = '.hello-block{display:grid;grid-template-columns:1fr;gap:8px;padding:2px 0 4px}'
replacement = '.upcoming-head{flex-direction:row-reverse}.author{flex-direction:row-reverse}.hello-block{display:grid;grid-template-columns:1fr;gap:8px;padding:2px 0 4px;text-align:right}.hello-block .hello{text-align:right}'
if anchor not in s:
    raise SystemExit('CSS anchor not found')
s = s.replace(anchor, replacement, 1)

p.write_text(s, encoding='utf-8')
