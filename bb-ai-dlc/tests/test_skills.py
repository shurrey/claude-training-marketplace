"""Validates skill metadata and AUTO-REFS integrity."""
import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SKILLS_DIR = REPO_ROOT / "skills"

FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)
AUTO_REFS_RE = re.compile(
    r"<!-- AUTO-REFS:START -->\n(.*?)\n<!-- AUTO-REFS:END -->",
    re.DOTALL,
)

REQUIRED_SKILLS = [
    "aidlc",
    "aidlc-common",
    "aidlc-inception",
    "aidlc-construction",
    "aidlc-operations",
]


def _parse_frontmatter(text: str) -> dict[str, str]:
    match = FRONTMATTER_RE.search(text)
    assert match, "SKILL.md must start with YAML frontmatter"
    out = {}
    for line in match.group(1).splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            out[k.strip()] = v.strip()
    return out


@pytest.mark.parametrize("skill_name", REQUIRED_SKILLS)
def test_required_skill_present(skill_name):
    skill_md = SKILLS_DIR / skill_name / "SKILL.md"
    assert skill_md.is_file(), f"Missing SKILL.md for required skill {skill_name}"


@pytest.mark.parametrize("skill_name", REQUIRED_SKILLS)
def test_skill_frontmatter(skill_name):
    skill_md = SKILLS_DIR / skill_name / "SKILL.md"
    fm = _parse_frontmatter(skill_md.read_text())
    assert fm.get("name") == skill_name, f"frontmatter name mismatch in {skill_name}"
    assert fm.get("description"), f"frontmatter description missing in {skill_name}"
    assert len(fm["description"]) > 20, f"description too short in {skill_name}"


def test_all_skills_have_auto_refs():
    """Every SKILL.md should have an AUTO-REFS section so sync can regenerate."""
    for skill_md in SKILLS_DIR.glob("*/SKILL.md"):
        content = skill_md.read_text()
        assert AUTO_REFS_RE.search(content), \
            f"{skill_md} missing AUTO-REFS markers"


def test_auto_refs_point_at_existing_files():
    """References listed in AUTO-REFS sections must exist on disk."""
    for skill_md in SKILLS_DIR.glob("*/SKILL.md"):
        content = skill_md.read_text()
        match = AUTO_REFS_RE.search(content)
        if not match:
            continue
        block = match.group(1)
        for ref_match in re.finditer(r"references/([^\s)]+\.md)", block):
            ref_path = skill_md.parent / "references" / ref_match.group(1)
            assert ref_path.is_file(), f"{skill_md} references missing file {ref_path}"


def test_no_auto_stub_in_required_skills():
    """The 5 core skills must not carry AUTO-STUB warnings — those need maintainer pass."""
    for skill_name in REQUIRED_SKILLS:
        skill_md = SKILLS_DIR / skill_name / "SKILL.md"
        content = skill_md.read_text()
        assert "AUTO-STUB" not in content, \
            f"{skill_name} still has AUTO-STUB marker; refine its SKILL.md"
