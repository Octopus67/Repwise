"""One-time script to add chart markers to existing articles in the DB."""
import sqlite3
import re

conn = sqlite3.connect('dev.db')
c = conn.cursor()

updates = {
    'How Close to Failure Do You Actually Need to Train?': '<!-- chart:failure-proximity -->',
    'The Anabolic Window Is (Mostly) a Myth': '<!-- chart:protein-timing -->',
    "Periodization Works — But the Type Doesn't Matter Much": '<!-- chart:periodization-comparison -->',
    "Yes, You Can Build Muscle in a Caloric Deficit (Here's How)": '<!-- chart:recomp-factors -->',
    'Creatine: The Most Proven Supplement in Sports Science': '<!-- chart:creatine-effects -->',
}

for title, marker in updates.items():
    c.execute('SELECT id, content_markdown FROM content_articles WHERE title = ?', (title,))
    row = c.fetchone()
    if not row:
        print(f'Not found: {title}')
        continue
    md = row[1] or ''
    if marker in md:
        print(f'Already has chart: {title}')
        continue
    # Insert marker after "What They Found" section, before next ## heading
    match = re.search(r'(## What They Found.*?\n\n(?:(?!## ).+\n)*)\n', md, re.DOTALL)
    if match:
        insert_pos = match.end()
        new_md = md[:insert_pos] + marker + '\n\n' + md[insert_pos:]
        c.execute('UPDATE content_articles SET content_markdown = ? WHERE id = ?', (new_md, row[0]))
        print(f'Updated: {title}')
    else:
        print(f'Pattern not found: {title}')

conn.commit()
conn.close()
print('Done!')
