#!/usr/bin/env python3
"""Regenerate AUTO-REFS sections in SKILL.md files.

A SKILL.md file may contain a block delimited by:

    <!-- AUTO-REFS:START -->
    ...content...
    <!-- AUTO-REFS:END -->

When run on a SKILL.md, this script replaces the content between the markers
with a bullet list of the .md files in the sibling `references/` directory.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

START_MARKER = "<!-- AUTO-REFS:START -->"
END_MARKER = "<!-- AUTO-REFS:END -->"


def slug_to_title(slug: str) -> str:
    """Convert a kebab-case filename stem to a Title Case label."""
    return " ".join(word.capitalize() for word in slug.split("-"))


def render_refs_block(references_dir: Path) -> str:
    """Render the bullet list of references in a directory."""
    refs = sorted(p.name for p in references_dir.glob("*.md"))
    if not refs:
        return f"{START_MARKER}\n<!-- no references yet -->\n{END_MARKER}"
    lines = [START_MARKER, "For deep guidance, consult:"]
    for ref in refs:
        stem = ref[:-3]  # strip .md
        label = slug_to_title(stem)
        lines.append(f"- [{label}](references/{ref})")
    lines.append(END_MARKER)
    return "\n".join(lines)


def regenerate(skill_md_path: Path) -> bool:
    """Regenerate the AUTO-REFS block in a SKILL.md file. Returns True if changed."""
    references_dir = skill_md_path.parent / "references"
    if not references_dir.is_dir():
        return False
    content = skill_md_path.read_text(encoding="utf-8")
    new_block = render_refs_block(references_dir)
    pattern = re.compile(
        re.escape(START_MARKER) + r".*?" + re.escape(END_MARKER),
        re.DOTALL,
    )
    if not pattern.search(content):
        return False
    new_content = pattern.sub(new_block, content, count=1)
    if new_content != content:
        skill_md_path.write_text(new_content, encoding="utf-8")
        return True
    return False


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: auto_refs.py <skills_dir>", file=sys.stderr)
        return 2
    skills_dir = Path(argv[1])
    if not skills_dir.is_dir():
        print(f"not a directory: {skills_dir}", file=sys.stderr)
        return 2
    changed = 0
    for skill_md in skills_dir.glob("*/SKILL.md"):
        if regenerate(skill_md):
            changed += 1
            print(f"regenerated {skill_md}")
    print(f"updated {changed} SKILL.md files")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
