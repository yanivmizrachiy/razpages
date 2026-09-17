from pathlib import Path

p = Path('summary-5.html')
s = p.read_text(encoding='utf-8')

old = '''    <div class="row"><span class="orb" aria-hidden="true"></span><p class="text">השבוע שלחתי בקבוצה שני שאלונים: שאלון לרכז ושאלון למורה. מי שעדיין לא מילא ושלח את השאלון המתאים, מתבקש לעשות זאת עוד היום.</p></div>
    <div class="row"><span class="orb" aria-hidden="true"></span><p class="text"><span class="label">שאלון למורה בחטיבת הביניים במחוז ירושלים ובעיר ירושלים:</span> <a class="link" href="https://docs.google.com/forms/d/e/1FAIpQLSeV1YBaoT7XDslsbamt8EmwXUmEFGyTRrpUHJEV89YUopP1Ug/viewform" target="_blank" rel="noopener noreferrer">למילוי השאלון לחצו כאן</a>.</p></div>
    <div class="row"><span class="orb" aria-hidden="true"></span><p class="text"><span class="label">שאלון לרכז/ת בחטיבת הביניים במחוז ירושלים ובעיר ירושלים:</span> <a class="link" href="https://docs.google.com/forms/d/e/1FAIpQLSepbWel2xb9IYSp-mHGoa1Zvi0O-XBormYWmNX4-Dv-9dnGiw/viewform" target="_blank" rel="noopener noreferrer">למילוי השאלון לחצו כאן</a>.</p></div>'''

new = '''    <div class="row"><span class="orb" aria-hidden="true"></span><p class="text"><span class="label">שאלונים לרכזים ולמורים:</span> השבוע שלחתי בקבוצה שני שאלונים: שאלון לרכז ושאלון למורה. מי שעדיין לא מילא ושלח את השאלון המתאים, מתבקש לעשות זאת עוד היום.<br><br><span class="label">שאלון למורה בחטיבת הביניים במחוז ירושלים ובעיר ירושלים:</span> <a class="link" href="https://docs.google.com/forms/d/e/1FAIpQLSeV1YBaoT7XDslsbamt8EmwXUmEFGyTRrpUHJEV89YUopP1Ug/viewform" target="_blank" rel="noopener noreferrer">למילוי השאלון לחצו כאן</a>.<br><span class="label">שאלון לרכז/ת בחטיבת הביניים במחוז ירושלים ובעיר ירושלים:</span> <a class="link" href="https://docs.google.com/forms/d/e/1FAIpQLSepbWel2xb9IYSp-mHGoa1Zvi0O-XBormYWmNX4-Dv-9dnGiw/viewform" target="_blank" rel="noopener noreferrer">למילוי השאלון לחצו כאן</a>.</p></div>'''

if old not in s:
    raise SystemExit('questionnaire block not found')

p.write_text(s.replace(old, new, 1), encoding='utf-8')
