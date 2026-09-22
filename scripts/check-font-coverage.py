#!/usr/bin/env python3
"""CI gate: verify the *bundled* font files cover the characters Sutrata must render.

check-tofu.js renders with whatever fonts the CI machine has installed, so it cannot
catch a bundled subset that is missing glyphs. This script reads the cmaps of the
woff2 files in packages/app/public/fonts directly.

Currently checked: every ISO 15919 letter and combining mark used by romanized export
(app spec §5.8) must be present in each Noto Sans and Noto Serif Latin file, so that base letters and
marks come from the same font file and GPOS mark positioning works.

Requires: pip install fonttools brotli
Exit code: 0 = all present, 1 = something missing.
"""
import pathlib
import sys

from fontTools.ttLib import TTFont

FONTS = pathlib.Path(__file__).resolve().parent.parent / 'packages' / 'app' / 'public' / 'fonts'

ISO_15919 = (
    # vowels with macron / Sinhala vowels: ā ī ū ē ō ä æ ǣ
    '\u0101\u012B\u016B\u0113\u014D\u00E4\u00E6\u01E3'
    # consonants: ṭ ḍ ṇ ṣ ṛ ṝ ḷ ḹ ṁ ṃ ḥ ṅ ñ ś
    '\u1E6D\u1E0D\u1E47\u1E63\u1E5B\u1E5D\u1E37\u1E39\u1E41\u1E43\u1E25\u1E45\u00F1\u015B'
    # ẏ ḻ ṉ ṟ ṯ ḵ ḫ ẖ
    '\u1E8F\u1E3B\u1E49\u1E5F\u1E6F\u1E35\u1E2B\u1E96'
    # combining marks: grave, acute, circumflex, tilde, macron, breve (Sinhala n̆d), dot above,
    # diaeresis, candrabindu (m̐), dot below, ring below (r̥), macron below,
    # double macron below (k͟h)
    '\u0300\u0301\u0302\u0303\u0304\u0306\u0307\u0308\u0310\u0323\u0325\u0331\u035F'
    # modifier letter apostrophe (avagraha)
    '\u02BC'
)

LATIN_FILES = [
    'NotoSans-latin-full-400.woff2',
    'NotoSans-latin-full-700.woff2',
    'NotoSerif-latin-full-400.woff2',
    'NotoSerif-latin-full-700.woff2',
    'NotoSerif-Italic-latin-full-400.woff2',
]


def main() -> int:
    failed = False
    for name in LATIN_FILES:
        path = FONTS / name
        if not path.exists():
            print(f'FAIL {name}: file not found')
            failed = True
            continue
        cmap = TTFont(path).getBestCmap()
        missing = [f'U+{ord(ch):04X}' for ch in ISO_15919 if ord(ch) not in cmap]
        if missing:
            print(f'FAIL {name}: missing {", ".join(missing)}')
            failed = True
        else:
            print(f'ok   {name}: all {len(ISO_15919)} ISO 15919 characters present')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
