import re
from typing import List, Set

from test_r_repair_unit import COMMON_ENGLISH_WORDS, preserve_case

def split_joined_words(word: str) -> List[str]:
    """Splits words that EasyOCR accidentally fused (e.g. 'computerand' -> 'computer and')."""
    lower = word.lower()
    if lower in COMMON_ENGLISH_WORDS:
        return [word]
    for i in range(3, len(lower) - 2):
        w1 = lower[:i]
        w2 = lower[i:]
        if w1 in COMMON_ENGLISH_WORDS and w2 in COMMON_ENGLISH_WORDS:
            return [word[:i], word[i:]]
    return [word]

def generate_full_r_candidates(word: str) -> List[str]:
    candidates = []
    
    # 1. 'iv' -> 'w' / 'r'
    if 'iv' in word:
        candidates.append(word.replace('iv', 'w'))
        candidates.append(word.replace('iv', 'r'))
        
    # 2. 'si' -> 'sw' (e.g. 'ansiers' -> 'answers')
    if 'si' in word:
        candidates.append(word.replace('si', 'sw'))
        
    # 3. 'wv' -> 'w'
    if 'wv' in word:
        candidates.append(word.replace('wv', 'w'))

    # 4. 'nst' -> 'nsf' (e.g. 'transter' -> 'transfer')
    if 'nst' in word:
        candidates.append(word.replace('nst', 'nsf'))

    # 5. Confused characters: 'x', 'n', 'v', 'z', 'j' -> 'r'
    import itertools
    confused_indices = [i for i, ch in enumerate(word) if ch in ('x', 'n', 'v', 'z', 'j')]
    for r_count in range(1, min(len(confused_indices) + 1, 4)):
        for combo in itertools.combinations(confused_indices, r_count):
            cand_chars = list(word)
            for idx in combo:
                cand_chars[idx] = 'r'
            candidates.append("".join(cand_chars))

    # 6. Omission of 'r' (e.g. 'netwok' -> 'network')
    if len(word) >= 3:
        for i in range(len(word) + 1):
            candidates.append(word[:i] + 'r' + word[i:])

    return candidates

def repair_token(tok: str) -> str:
    m = re.match(r'^([^a-zA-Z0-9]*)([a-zA-Z0-9_-]+)([^a-zA-Z0-9]*)$', tok)
    if not m:
        return tok

    prefix, core, suffix = m.groups()
    
    if '_' in core and len(core) > 2:
        parts = core.split('_')
        repaired_parts = [repair_token(p) for p in parts if p]
        return prefix + " ".join(repaired_parts) + suffix

    lower_core = core.lower()

    if lower_core in COMMON_ENGLISH_WORDS:
        return tok

    # Check candidate transformations
    candidates = generate_full_r_candidates(lower_core)
    for cand in candidates:
        if cand in COMMON_ENGLISH_WORDS and cand != lower_core:
            return prefix + preserve_case(core, cand) + suffix

    # Try split joined words
    splits = split_joined_words(core)
    if len(splits) > 1:
        repaired_splits = [repair_token(s) for s in splits]
        return prefix + " ".join(repaired_splits) + suffix

    return tok

def repair_sentence(text: str) -> str:
    lines = []
    for line in text.splitlines():
        tokens = line.split()
        repaired_tokens = [repair_token(t) for t in tokens]
        lines.append(" ".join(repaired_tokens))
    return "\n".join(lines)

test_sentences = [
    "These are the correctansiers",
    "TCP protocolrunson computerand server:",
    "Netwvork error handling during data transter:"
]

for s in test_sentences:
    print(f"Original: '{s}'")
    print(f"Repaired: '{repair_sentence(s)}'\n")
