#!/usr/bin/env python3
"""
Generate src/app/tenant-guide/guide-data.json from /home/ubuntu/Guide.docx.

The Tenant User Guide docx is parsed into chapters → sections → blocks so the
/tenant-guide page can render it with a table of contents.

Usage:
    python3 scripts/generate-tenant-guide.py [path-to-Guide.docx]
"""
import json
import re
import sys
import zipfile
from html import unescape

DOCX_PATH = sys.argv[1] if len(sys.argv) > 1 else "/home/ubuntu/Guide.docx"
OUT_PATH = "src/app/tenant-guide/guide-data.json"

# ── helpers ──────────────────────────────────────────────────────────────────
def extract_paragraphs(docx_path):
    """Return list of stripped paragraph texts from the docx (original order)."""
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read("word/document.xml").decode("utf-8")
    paras = re.findall(r"<w:p[ >].*?</w:p>", xml, re.S)
    lines = []
    for p in paras:
        texts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, re.S)
        line = unescape("".join(texts)).strip()
        lines.append(line)
    return lines


def is_skip_line(line):
    """Lines we never render (pure emoji, video markers, AI artifacts)."""
    if not line.strip():
        return True
    emoji_only = re.sub(r"[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\U0001F900-\U0001F9FF\U0001FA70-\U0001FAFF]", "", line).strip()
    if not emoji_only:
        return True
    if line == "🎥 Video":
        return True
    if line.startswith("To help you keep track of these connection states"):
        return True
    if "Would you like me to generate that for you?" in line:
        return True
    if "I can create a slide deck" in line:
        return True
    return False


def classify_and_group(lines):
    """
    Turn a list of raw paragraph strings into block objects.

    Block types:
      p         paragraph
      sub       subheading (short heading line)
      tips      {'title': str, 'items': [...]}  — 💡 Tips callout
      callout   {'title': str, 'items': [...]}  — 💡 How ... works
      howto     collapsible "How to X" title
      bullets   list of bullet strings
      cta       action pill ("Add Supplier →")
      steps     numbered step heading
    """
    blocks = []
    pending_tips = None
    pending_callout = None
    pending_bullets = None

    def flush_containers():
        nonlocal pending_tips, pending_callout, pending_bullets
        if pending_tips is not None:
            blocks.append({"t": "tips", "title": "Tips", "items": pending_tips})
            pending_tips = None
        if pending_callout is not None:
            blocks.append({"t": "callout", "title": pending_callout[0], "items": pending_callout[1]})
            pending_callout = None
        if pending_bullets is not None:
            blocks.append({"t": "bullets", "items": pending_bullets})
            pending_bullets = None

    for line in lines:
        if is_skip_line(line):
            continue

        if line.startswith("💡"):
            flush_containers()
            title = line.lstrip("💡 ").strip() or "How it works"
            pending_callout = (title, [])
            continue

        # while a callout is open, "Label: description" lines become its items
        if pending_callout is not None and re.match(r"^[A-Za-z][A-Za-z0-9 /()+_-]*?:\s", line):
            pending_callout[1].append(line)
            continue

        if line.startswith("•"):
            item = line.lstrip("• ").strip()
            if pending_tips is not None:
                pending_tips.append(item)
            elif pending_callout is not None:
                pending_callout[1].append(item)
            else:
                if pending_bullets is None:
                    pending_bullets = []
                pending_bullets.append(item)
            continue

        if line.startswith("▶") and line.endswith("▼"):
            flush_containers()
            blocks.append({"t": "howto", "title": line.strip("▶▼ ").strip()})
            continue

        if line.rstrip().endswith("→") and len(line) < 70:
            flush_containers()
            blocks.append({"t": "cta", "label": line.rstrip().rstrip("→").strip()})
            continue

        if re.match(r"^\d+\.\s", line):
            flush_containers()
            blocks.append({"t": "steps", "items": [line]})
            continue

        # subheading heuristics: short, no terminal punctuation
        if (8 <= len(line) <= 90 and not re.search(r"[.!?:;]$", line)
                and not line.startswith(("(", "[", "•", "\"", "'")) and " " in line):
            flush_containers()
            blocks.append({"t": "sub", "text": line})
            continue

        flush_containers()
        blocks.append({"t": "p", "text": line})

    flush_containers()
    return blocks


def build_glossary(lines):
    """Alternating term/definition rows starting after 'Term'/'Definition' headers."""
    rows = []
    # find the header pair ("Term", "Definition") and start pairing after it
    i = 0
    for i in range(len(lines) - 1):
        if lines[i].strip() == "Term" and lines[i + 1].strip() == "Definition":
            i += 2
            break
    while i + 1 < len(lines):
        term = lines[i].strip()
        definition = lines[i + 1].strip()
        if term and definition:
            rows.append([term, definition])
        i += 2
    return {"t": "glossary", "rows": rows}


def build_quiz(lines):
    """Comprehension quiz lines are 'Question? Answer' on a single line."""
    items = []
    for line in lines:
        if is_skip_line(line):
            continue
        if line.startswith("Instructions:") or line.startswith("Part "):
            continue
        q, a = line, ""
        m = re.match(r"^(.*?\?)\s+(.*)$", line)
        if m:
            q, a = m.group(1), m.group(2)
        else:
            # questions without a '?' end with '. ' before the answer
            m2 = re.match(r"^(.*?\.)\s+(.*)$", line)
            if m2 and len(m2.group(1)) < len(line) - 10:
                q, a = m2.group(1), m2.group(2)
        items.append({"q": q, "a": a})
    return {"t": "quiz", "items": items}


def build_essays(lines):
    """Essay prompts are 'Title: prompt'."""
    items = []
    for line in lines:
        if is_skip_line(line) or line.startswith("Instructions:") or line.startswith("Part "):
            continue
        parts = line.split(": ", 1)
        title = parts[0]
        prompt = parts[1] if len(parts) > 1 else ""
        items.append({"title": title, "prompt": prompt})
    return {"t": "essays", "items": items}


def build_answer_key(lines):
    """Answer key lines → numbered list."""
    items = [l.strip() for l in lines if l.strip() and not l.startswith("Part ")]
    return {"t": "bullets", "items": items}


def slice_lines(lines, start, end, exclude=()):
    out = []
    for i in range(start, min(end, len(lines))):
        if i in exclude:
            continue
        out.append(lines[i])
    return out


# ── chapter / section map (true original indices into the docx) ─────────────
CHAPTERS = [
    {
        "id": "getting-started",
        "title": "Getting Started",
        "icon": "🚀",
        "desc": "Create your account, understand billing and free credits, and prepare your platform for testing.",
        "sections": [
            {"id": "register-account", "title": "Register Your Account", "icon": "📝", "start": 1, "end": 6},
            {"id": "top-up-payment", "title": "Top-Up & Payment Procedures", "icon": "💳", "start": 7, "end": 11},
            {"id": "test-credits", "title": "Testing & Development Credits", "icon": "🎁", "start": 12, "end": 15},
            {"id": "financial-integration", "title": "Financial Integration", "icon": "📊", "start": 16, "end": 20},
            {"id": "crypto-payment", "title": "Cryptocurrency Payment Process", "icon": "₿", "start": 21, "end": 36},
            {"id": "login-dashboard", "title": "Login & Dashboard Quick Steps", "icon": "🔑", "start": 38, "end": 47},
            {"id": "top-up-balance", "title": "Top Up Your Balance", "icon": "💰", "start": 48, "end": 52},
        ],
    },
    {
        "id": "supplier-management",
        "title": "Supplier Management",
        "icon": "🏭",
        "desc": "Connect SMS gateway providers via SMPP or HTTP and verify their connections with Bind Status.",
        "sections": [
            {"id": "add-supplier", "title": "Add a Supplier", "icon": "🏭", "start": 73, "end": 114,
             "exclude": list(range(81, 114))},
            {"id": "supplier-process", "title": "The Add Supplier Process", "icon": "⚙️", "start": 81, "end": 100},
            {"id": "bind-status", "title": "Bind Status Monitoring", "icon": "🔗", "start": 101, "end": 113},
            {"id": "ejoin-sk", "title": "Add Ejoin/Sk Gateway", "icon": "🛠️", "start": 117, "end": 138,
             "exclude": list(range(118, 134))},
            {"id": "set-supplier-rates", "title": "Set Supplier Rates", "icon": "💲", "start": 139, "end": 145},
            {"id": "supplier-rates-bulk", "title": "Supplier Rates & Bulk Import", "icon": "📦", "start": 147, "end": 167},
        ],
    },
    {
        "id": "advanced-connectors",
        "title": "Advanced Connectors",
        "icon": "🔌",
        "desc": "Voice OTP, WhatsApp, Telegram and custom HTTP connectors for modern communication channels.",
        "sections": [
            {"id": "voice-otp", "title": "Voice OTP & SIP Config", "icon": "📞", "start": 168, "end": 195},
            {"id": "telegram-api", "title": "Telegram Business API", "icon": "✈️", "start": 196, "end": 211},
            {"id": "whatsapp-api", "title": "WhatsApp Business API", "icon": "💚", "start": 212, "end": 230},
            {"id": "ott-connect", "title": "WhatsApp & Telegram OTT Connect", "icon": "🔗", "start": 231, "end": 234},
            {"id": "http-custom-api", "title": "HTTP Custom API Connect", "icon": "🌐", "start": 234, "end": 253},
        ],
    },
    {
        "id": "routing",
        "title": "Routing",
        "icon": "🔀",
        "desc": "Build the delivery hierarchy — Trunks → Routes → Route Plans — with capacity limits and automatic failover.",
        "sections": [
            {"id": "add-trunk", "title": "Add a Trunk", "icon": "🔗", "start": 255, "end": 304,
             "exclude": list(range(270, 296))},
            {"id": "trunk-capacity", "title": "Trunk Capacity Management", "icon": "⚡", "start": 270, "end": 280},
            {"id": "mcc-lists", "title": "MCC Allow / Deny Lists", "icon": "🌍", "start": 281, "end": 295},
            {"id": "add-route", "title": "Add a Route", "icon": "🛤️", "start": 313, "end": 338},
            {"id": "country-filter", "title": "Country Code Filtering", "icon": "🏳️", "start": 339, "end": 365},
            {"id": "route-plans", "title": "Route Plans", "icon": "📋", "start": 366, "end": 386},
        ],
    },
    {
        "id": "client-management",
        "title": "Client Management",
        "icon": "👥",
        "desc": "Onboard sub-clients with credentials, security limits, routing plans and per-client rates.",
        "sections": [
            {"id": "add-client", "title": "Add a Client", "icon": "👤", "start": 418, "end": 443},
            {"id": "client-credentials", "title": "SMTP Credentials & HTTP API", "icon": "🔐", "start": 444, "end": 461},
            {"id": "tps-ip-whitelist", "title": "TPS Limits & IP Whitelisting", "icon": "🛡️", "start": 462, "end": 477},
            {"id": "assign-route-plan", "title": "Assign a Route Plan to a Client", "icon": "📌", "start": 481, "end": 497},
            {"id": "set-client-rates", "title": "Set Client Rates", "icon": "💵", "start": 498, "end": 522,
             "exclude": list(range(504, 521))},
        ],
    },
    {
        "id": "testing-support",
        "title": "Testing & Support",
        "icon": "🧪",
        "desc": "Validate your configuration with test tools and logs, then reach out through support tickets.",
        "sections": [
            {"id": "test-sms", "title": "Test SMS Sending", "icon": "🧪", "start": 572, "end": 579},
            {"id": "sms-logs", "title": "SMS Logs & Delivery Status", "icon": "📜", "start": 595, "end": 609},
            {"id": "get-support", "title": "Get Support", "icon": "🎫", "start": 611, "end": 635},
        ],
    },
    {
        "id": "translations-filters",
        "title": "Translations & Filters",
        "icon": "🔄",
        "desc": "Transform sender IDs, numbers and message content — and block unwanted traffic.",
        "sections": [
            {"id": "translations-overview", "title": "Translations & Filters Overview", "icon": "🧩", "start": 638, "end": 653},
            {"id": "sid-translation", "title": "SID (Sender ID) Translation", "icon": "🆔", "start": 654, "end": 666},
            {"id": "number-translation", "title": "Number Translation", "icon": "🔢", "start": 667, "end": 682},
            {"id": "content-translation", "title": "Content Translation", "icon": "✏️", "start": 683, "end": 698},
            {"id": "blacklist-filter", "title": "Number Blacklist & Content Filter", "icon": "🚫", "start": 699, "end": 714},
            {"id": "quick-ref-sid", "title": "SID Translation — Quick Reference", "icon": "⚡", "start": 534, "end": 540},
            {"id": "quick-ref-number", "title": "Number Translation — Quick Reference", "icon": "⚡", "start": 543, "end": 547},
            {"id": "quick-ref-content", "title": "Content Translation — Quick Reference", "icon": "⚡", "start": 552, "end": 560},
        ],
    },
    {
        "id": "study-guide",
        "title": "Study Guide",
        "icon": "📚",
        "desc": "Comprehension quiz, answer key, essay topics and the key-term glossary.",
        "sections": [
            {"id": "quiz", "title": "Part 1 — Comprehension Quiz", "icon": "📝", "start": 717, "end": 728},
            {"id": "answer-key", "title": "Part 2 — Answer Key", "icon": "✅", "start": 729, "end": 739},
            {"id": "essays", "title": "Part 3 — Essay Questions", "icon": "📄", "start": 740, "end": 746},
            {"id": "glossary", "title": "Part 4 — Glossary of Key Terms", "icon": "📖", "start": 747, "end": 769},
        ],
    },
]

SPECIAL = {
    "quiz": build_quiz,
    "essays": build_essays,
    "glossary": build_glossary,
    "answer-key": build_answer_key,
}


def main():
    lines = extract_paragraphs(DOCX_PATH)
    chapters_out = []
    total_sections = 0

    for chapter in CHAPTERS:
        sections_out = []
        for sec in chapter["sections"]:
            exclude = set(sec.get("exclude") or ())
            raw = slice_lines(lines, sec["start"], sec["end"], exclude)
            if sec["id"] in SPECIAL:
                blocks = [SPECIAL[sec["id"]](raw)]
            else:
                blocks = classify_and_group(raw)
            # Drop a leading sub block that duplicates the section title (ignoring emoji)
            def strip_emoji(s):
                return re.sub(r"[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\U0001F900-\U0001F9FF\U0001FA70-\U0001FAFF]", "", s).strip()

            while blocks and blocks[0]["t"] == "sub" and strip_emoji(blocks[0].get("text", "")).lower() == strip_emoji(sec["title"]).lower():
                blocks = blocks[1:]
            sections_out.append({
                "id": sec["id"],
                "title": sec["title"],
                "icon": sec.get("icon", ""),
                "blocks": blocks,
            })
            total_sections += 1
        chapters_out.append({
            "id": chapter["id"],
            "title": chapter["title"],
            "icon": chapter["icon"],
            "desc": chapter.get("desc", ""),
            "sections": sections_out,
        })

    data = {
        "title": "Net2APP Tenant User Guide",
        "subtitle": "The complete operator guide to the Net2APP SMS gateway platform — account setup, suppliers, routing, clients, translations, testing and support.",
        "chapters": chapters_out,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    print(f"Wrote {OUT_PATH}")
    print(f"Chapters: {len(chapters_out)}, Sections: {total_sections}")
    for ch in chapters_out:
        print(f"  - {ch['icon']} {ch['title']} ({len(ch['sections'])} sections)")


if __name__ == "__main__":
    main()
