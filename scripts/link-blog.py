#!/usr/bin/env python3
"""One-time transform: link orphan guide/blog pages to the app + GitHub.
Adds header nav, top+bottom gold CTAs, footer GitHub link, and contextual
prose links pointing to the homepage. Idempotent (safe to re-run)."""
import re, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GH = '<a href="https://github.com/Aviatorpo/friendlybet" target="_blank" rel="noopener">GitHub</a>'

CTA = {
    'en': 'Create a Free World Cup Pool in 30 Seconds',
    'he': 'צרו הימור מונדיאל חינם ב-30 שניות',
}
NAV = {
    'en': '<nav class="site-nav"><a href="/">Play</a><a href="/blog">Blog</a>' + GH + '</nav>',
    'he': '<nav class="site-nav"><a href="/">שחקו</a><a href="/blog">בלוג</a>' + GH + '</nav>',
}
PHRASES = {
    'en': ['World Cup prediction pool', 'prediction pool', 'your pool',
           'the group stage', 'the knockouts', 'your friends', 'pools', 'the pool'],
    'he': ['הימור המונדיאל', 'ההימור שלכם', 'הימור חברים', 'שלב הבתים',
           'החברים שלכם', 'הפולים', 'ההימור', 'הימור'],
}


def add_nav(html, lang):
    if 'class="site-nav"' in html:
        return html
    return html.replace('  </div>\n</header>', '    ' + NAV[lang] + '\n  </div>\n</header>', 1)


def add_top_cta(html, lang):
    if 'cta-block' in html:
        return html
    cta = '<a class="cta-block" href="/">' + CTA[lang] + '</a>'
    m = re.search(r'<p class="lead">.*?</p>', html, re.S)
    if m:
        return html[:m.end()] + '\n\n    ' + cta + html[m.end():]
    return html


def add_bottom_cta(html, lang):
    if html.count('cta-block') >= 2:
        return html
    cta = '<a class="cta-block" href="/">' + CTA[lang] + '</a>'
    return html.replace('\n  </main>', '\n\n    ' + cta + '\n  </main>', 1)


def add_footer_gh(html, lang):
    if GH in html.split('<footer', 1)[-1]:
        return html
    guides = 'מדריכים' if lang == 'he' else 'Guides'
    old = '<a href="/guides/">%s</a>\n  </div>' % guides
    new = '<a href="/guides/">%s</a> · %s\n  </div>' % (guides, GH)
    return html.replace(old, new, 1)


def add_context_links(html, lang, limit=3):
    # start the counter at links already present so re-runs never exceed the cap
    added = sum(1 for ph in PHRASES[lang] if ('href="/">' + ph) in html)
    for ph in PHRASES[lang]:
        if added >= limit:
            break
        if 'href="/">' + ph in html:   # already linked on a previous run
            continue
        pat = re.compile(r'(<p>)([^<]*?)(' + re.escape(ph) + r')([^<]*?)(</p>)')
        m = pat.search(html)
        if m:
            repl = m.group(1) + m.group(2) + '<a href="/">' + m.group(3) + '</a>' + m.group(4) + m.group(5)
            html = html[:m.start()] + repl + html[m.end():]
            added += 1
    return html, added


def process(path, lang, is_index=False):
    with open(path, encoding='utf-8') as f:
        html = f.read()
    before = html
    html = add_nav(html, lang)
    # The blog hub (index) keeps a single hand-placed CTA; only articles get top+bottom.
    if not is_index:
        html = add_top_cta(html, lang)
        html = add_bottom_cta(html, lang)
    links = 0
    if is_index:
        # index footer has no Guides link; append Blog + GitHub
        html = html.replace(
            '<a href="/">Play free</a></div>',
            '<a href="/">Play free</a> · <a href="/blog">Blog</a> · ' + GH + '</div>', 1)
    else:
        html = add_footer_gh(html, lang)
        html, links = add_context_links(html, lang)
    if html != before:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)
        print('  updated %-58s (+%d prose links)' % (os.path.relpath(path, ROOT), links))
    else:
        print('  unchanged %s' % os.path.relpath(path, ROOT))


# index.html keeps a single hand-placed CTA; standalone pages are fully hand-built.
SKIP = {'index.html', 'friendlybet-live-vs-org.html'}

print('EN articles:')
for p in sorted(glob.glob(os.path.join(ROOT, 'guides', '*.html'))):
    if os.path.basename(p) in SKIP:
        continue
    process(p, 'en')
print('HE articles:')
for p in sorted(glob.glob(os.path.join(ROOT, 'guides', 'he', '*.html'))):
    process(p, 'he')
print('Index:')
process(os.path.join(ROOT, 'guides', 'index.html'), 'en', is_index=True)
print('Done.')
