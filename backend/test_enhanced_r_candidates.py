import re
import itertools
from typing import List, Set

from test_r_repair_unit import COMMON_ENGLISH_WORDS, preserve_case

def generate_enhanced_r_candidates(word: str) -> List[str]:
    candidates = []
    
    # 1. 'iv' -> 'w' and 'iv' -> 'r'
    if 'iv' in word:
        candidates.append(word.replace('iv', 'w'))
        candidates.append(word.replace('iv', 'r'))

    # 2. Confused characters: 'x', 'n', 'v', 'z', 'j'
    confused_indices = [i for i, ch in enumerate(word) if ch in ('x', 'n', 'v', 'z', 'j')]
    for r_count in range(1, min(len(confused_indices) + 1, 4)):
        for combo in itertools.combinations(confused_indices, r_count):
            cand_chars = list(word)
            for idx in combo:
                cand_chars[idx] = 'r'
            candidates.append("".join(cand_chars))

    # 3. Omission of 'r' (e.g. 'netwok' -> 'network', 'sever' -> 'server', 'tansfer' -> 'transfer', 'anwer' -> 'answer')
    if len(word) >= 3:
        for i in range(len(word) + 1):
            candidates.append(word[:i] + 'r' + word[i:])

    return candidates

def repair_r_confusions_in_word(raw_word: str) -> str:
    m = re.match(r'^([^a-zA-Z0-9]*)([a-zA-Z0-9_-]+)([^a-zA-Z0-9]*)$', raw_word)
    if not m:
        return raw_word

    prefix, core, suffix = m.groups()
    
    if '_' in core and len(core) > 2:
        parts = core.split('_')
        repaired_parts = [repair_r_confusions_in_word(p) for p in parts if p]
        return prefix + " ".join(repaired_parts) + suffix

    lower_core = core.lower()

    if lower_core in COMMON_ENGLISH_WORDS:
        return raw_word

    candidates = generate_enhanced_r_candidates(lower_core)
    for cand in candidates:
        if cand in COMMON_ENGLISH_WORDS and cand != lower_core:
            return prefix + preserve_case(core, cand) + suffix

    return raw_word

def repair_ocr_text(text: str) -> str:
    if not text:
        return ""
    lines = []
    for line in text.splitlines():
        tokens = line.split()
        repaired_tokens = [repair_r_confusions_in_word(t) for t in tokens]
        lines.append(" ".join(repaired_tokens))
    return "\n".join(lines)

test_inputs = [
    ("netwok", "network"),
    ("othez", "other"),
    ("shaje", "share"),
    ("tansfer", "transfer"),
    ("anwer", "answer"),
    ("corect", "correct"),
    ("eror", "error"),
    ("sever", "server"),
    ("computex", "computer"),
    ("computens", "computers")
]

print("Testing enhanced candidate repair:")
for raw, expected in test_inputs:
    res = repair_ocr_text(raw)
    print(f"  '{raw}' -> '{res}' (Expected: '{expected}') -> {'[PASS]' if res == expected else '[FAIL]'}")
