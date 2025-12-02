#!/usr/bin/env python3
"""
Build script for converting Obsidian markdown essays to HTML.

Usage:
    python build.py           # Build only Published essays
    python build.py --drafts  # Also build Drafts for local preview

Source: ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain/Writing/
Output: essay/*.html and essays.html
"""

import os
import re
import argparse
from pathlib import Path
from datetime import datetime

# Try to import optional dependencies
try:
    import markdown
    HAS_MARKDOWN = True
except ImportError:
    HAS_MARKDOWN = False

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

# Paths
OBSIDIAN_BASE = Path.home() / "Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain/Writing"
PUBLISHED_DIR = OBSIDIAN_BASE / "Published"
DRAFTS_DIR = OBSIDIAN_BASE / "Drafts"
SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR / "essay"
TEMPLATE_PATH = SCRIPT_DIR / "templates" / "essay.html"
INDEX_OUTPUT = SCRIPT_DIR / "essays.html"


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from markdown content."""
    if not content.startswith('---'):
        return {}, content

    # Find the closing ---
    end_match = re.search(r'\n---\s*\n', content[3:])
    if not end_match:
        return {}, content

    frontmatter_str = content[3:end_match.start() + 3]
    body = content[end_match.end() + 3:]

    if HAS_YAML:
        try:
            frontmatter = yaml.safe_load(frontmatter_str)
        except yaml.YAMLError:
            frontmatter = {}
    else:
        # Simple fallback parser
        frontmatter = {}
        for line in frontmatter_str.strip().split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                frontmatter[key.strip()] = value.strip().strip('"\'')

    return frontmatter or {}, body


def process_sidenotes(html: str) -> str:
    """Convert {.sidenote}...{/.sidenote} syntax to HTML sidenotes."""
    sidenote_counter = [0]  # Use list for closure mutability

    def replace_sidenote(match):
        sidenote_counter[0] += 1
        n = sidenote_counter[0]
        content = match.group(1).strip()
        return f'''<label for="sn-{n}" class="sidenote-toggle sidenote-number"></label>
<input type="checkbox" id="sn-{n}" class="sidenote-toggle-input">
<span class="sidenote">{content}</span>'''

    # Match {.sidenote}...{/.sidenote}
    html = re.sub(
        r'\{\.sidenote\}\s*(.*?)\s*\{/\.sidenote\}',
        replace_sidenote,
        html,
        flags=re.DOTALL
    )

    # Also handle margin notes: {.marginnote}...{/.marginnote}
    margin_counter = [0]

    def replace_marginnote(match):
        margin_counter[0] += 1
        n = margin_counter[0]
        content = match.group(1).strip()
        return f'''<label for="mn-{n}" class="margin-toggle">&#8853;</label>
<input type="checkbox" id="mn-{n}" class="margin-toggle-input">
<span class="marginnote">{content}</span>'''

    html = re.sub(
        r'\{\.marginnote\}\s*(.*?)\s*\{/\.marginnote\}',
        replace_marginnote,
        html,
        flags=re.DOTALL
    )

    return html


def convert_markdown(content: str) -> str:
    """Convert markdown to HTML."""
    if HAS_MARKDOWN:
        md = markdown.Markdown(extensions=['extra', 'smarty', 'sane_lists'])
        html = md.convert(content)
    else:
        # Very basic fallback conversion
        html = content
        # Paragraphs
        html = re.sub(r'\n\n+', '</p>\n\n<p>', html)
        html = f'<p>{html}</p>'
        # Bold
        html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
        # Italic
        html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)
        # Links
        html = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', html)
        # Headers
        html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
        html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)

    return html


def slugify(title: str) -> str:
    """Convert title to URL-friendly slug."""
    slug = title.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def format_date(date_str) -> tuple[str, str]:
    """Format date for display and datetime attribute."""
    if isinstance(date_str, datetime):
        dt = date_str
    elif isinstance(date_str, str):
        # Try parsing common formats
        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y', '%B %d, %Y']:
            try:
                dt = datetime.strptime(date_str, fmt)
                break
            except ValueError:
                continue
        else:
            return date_str, date_str
    else:
        return str(date_str), str(date_str)

    return dt.strftime('%Y-%m-%d'), dt.strftime('%B %d, %Y')


def build_essay(md_path: Path, is_draft: bool = False) -> dict:
    """Build a single essay from markdown file. Returns metadata for index."""
    print(f"  Building: {md_path.name}")

    content = md_path.read_text(encoding='utf-8')
    frontmatter, body = parse_frontmatter(content)

    # Extract metadata
    title = frontmatter.get('title', md_path.stem.replace('-', ' ').title())
    date_str = frontmatter.get('date', '')
    description = frontmatter.get('description', '')

    # Clean title of [DRAFT] markers
    title = re.sub(r'\s*\[DRAFT\].*$', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\s*\[EARLY DRAFT\].*$', '', title, flags=re.IGNORECASE)

    # Format date
    date_iso, date_formatted = format_date(date_str) if date_str else ('', '')

    # Convert markdown to HTML
    html_content = convert_markdown(body)

    # Process sidenotes
    html_content = process_sidenotes(html_content)

    # Load template
    template = TEMPLATE_PATH.read_text(encoding='utf-8')

    # Apply template
    output = template
    output = output.replace('{{title}}', title)
    output = output.replace('{{date}}', date_iso)
    output = output.replace('{{formatted_date}}', date_formatted)
    output = output.replace('{{content}}', html_content)

    # Handle optional description
    if description:
        output = re.sub(r'\{\{#description\}\}(.+?)\{\{/description\}\}',
                       rf'\1'.replace('{{description}}', description),
                       output, flags=re.DOTALL)
    else:
        output = re.sub(r'\{\{#description\}\}.+?\{\{/description\}\}', '', output, flags=re.DOTALL)

    # Generate output filename
    slug = slugify(title)
    if is_draft:
        slug = f"draft-{slug}"
    output_path = OUTPUT_DIR / f"{slug}.html"

    # Write output
    OUTPUT_DIR.mkdir(exist_ok=True)
    output_path.write_text(output, encoding='utf-8')

    return {
        'title': title,
        'slug': slug,
        'date': date_str,
        'date_iso': date_iso,
        'date_formatted': date_formatted,
        'description': description,
        'is_draft': is_draft,
        'path': f"essay/{slug}.html"
    }


def build_index(essays: list[dict]):
    """Generate essays.html index page."""
    print("  Building index: essays.html")

    # Sort by date (newest first), drafts at end
    essays.sort(key=lambda e: (e['is_draft'], e.get('date_iso', '') or '0000'), reverse=True)

    # Build essay list HTML
    essay_items = []
    for essay in essays:
        draft_badge = ' <span style="color: #666; font-size: 0.8em;">[draft]</span>' if essay['is_draft'] else ''
        date_display = f'<span style="color: #6b7280; font-size: 0.9em;">{essay["date_formatted"]}</span>' if essay['date_formatted'] else ''
        desc = f'<br><span style="color: #555; font-size: 0.9em;">{essay["description"]}</span>' if essay['description'] else ''

        essay_items.append(f'''        <li style="margin-bottom: 1.5rem;">
            <a href="{essay['path']}">{essay['title']}</a>{draft_badge}
            {date_display}{desc}
        </li>''')

    essays_html = '\n'.join(essay_items)

    # Index page template
    index_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="css/styles.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/bitmaks/cm-web-fonts@latest/fonts.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
    <link rel="icon" href="assets/favicon.ico" type="image/x-icon">
    <title>Essays - Vidyut Baradwaj</title>
</head>
<body>
    <header id="banner">
        <div class="header-container">
            <div class="header-left">
                <h1><a href="index.html">Vidyut Baradwaj</a> <span class="slash-title">/ Essays</span></h1>
            </div>
            <button id="theme-toggle" aria-label="Toggle theme" title="Toggle theme"></button>
        </div>
    </header>

    <main id="content">
        <p>Long-form writing on technology, culture, and ideas. For shorter updates, see my <a href="https://vidyuts.substack.com/">Substack</a>.</p>

        <ul style="list-style: none; padding: 0; margin-top: 2rem;">
{essays_html}
        </ul>
    </main>

    <footer id="footer">
        <p>
            <a href="projects.html">Projects</a>
            <a href="contact.html">Socials</a>
            <a href="hobbies.html">Hobbies</a>
        </p>
        <p>2025 Vidyut Baradwaj.</p>
    </footer>

    <script>
        const updateBannerOffset = () => {{
            const y = window.scrollY || window.pageYOffset;
            const x = Math.sin(y / 120) * 80;
            document.body.style.setProperty('--vb-banner-offset', (y % 120) + 'px');
            document.body.style.setProperty('--vb-banner-x-offset', x + 'px');
        }};
        window.addEventListener('scroll', updateBannerOffset, {{ passive: true }});
        updateBannerOffset();

        const themeToggle = document.getElementById('theme-toggle');
        const body = document.body;
        const renderIcon = () => {{
            const isDark = document.body.classList.contains('dark-theme');
            themeToggle.innerHTML = isDark
                ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
        }};

        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {{
            body.classList.add(savedTheme);
            renderIcon();
        }}

        themeToggle.addEventListener('click', () => {{
            body.classList.toggle('dark-theme');
            const isDark = body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark-theme' : '');
            renderIcon();
        }});
        if (!savedTheme) renderIcon();
    </script>
</body>
</html>
'''

    INDEX_OUTPUT.write_text(index_html, encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description='Build essays from Obsidian markdown')
    parser.add_argument('--drafts', action='store_true', help='Also build drafts')
    args = parser.parse_args()

    print("Building essays...")
    print(f"  Source: {OBSIDIAN_BASE}")
    print(f"  Output: {OUTPUT_DIR}")

    if not HAS_MARKDOWN:
        print("  Warning: 'markdown' package not installed. Using basic conversion.")
        print("           Install with: pip install markdown")

    if not HAS_YAML:
        print("  Warning: 'pyyaml' package not installed. Using basic frontmatter parsing.")
        print("           Install with: pip install pyyaml")

    essays = []

    # Build published essays
    if PUBLISHED_DIR.exists():
        for md_file in PUBLISHED_DIR.glob('*.md'):
            try:
                essay = build_essay(md_file, is_draft=False)
                essays.append(essay)
            except Exception as e:
                print(f"    Error building {md_file.name}: {e}")
    else:
        print(f"  Warning: Published directory not found: {PUBLISHED_DIR}")

    # Build drafts if requested
    if args.drafts and DRAFTS_DIR.exists():
        print("  Including drafts...")
        for md_file in DRAFTS_DIR.glob('*.md'):
            try:
                essay = build_essay(md_file, is_draft=True)
                essays.append(essay)
            except Exception as e:
                print(f"    Error building {md_file.name}: {e}")

    # Build index
    build_index(essays)

    print(f"\nDone! Built {len(essays)} essay(s).")
    print(f"  View at: file://{OUTPUT_DIR}")


if __name__ == '__main__':
    main()
