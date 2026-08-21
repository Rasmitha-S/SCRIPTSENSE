import re
from typing import List, Set
from test_sentence_repair import generate_full_r_candidates, COMMON_ENGLISH_WORDS, preserve_case

def split_joined_words(word: str) -> List[str]:
    lower = word.lower()
    if lower in COMMON_ENGLISH_WORDS:
        return [word]
    for i in range(3, len(lower) - 2):
        w1 = lower[:i]
        w2 = lower[i:]
        if w1 in COMMON_ENGLISH_WORDS:
            if w2 in COMMON_ENGLISH_WORDS:
                return [word[:i], word[i:]]
            cands2 = generate_full_r_candidates(w2)
            for c2 in cands2:
                if c2 in COMMON_ENGLISH_WORDS:
                    return [word[:i], preserve_case(word[i:], c2)]
    return [word]

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

print("Testing split and repair on 'correctansiers':")
print(repair_token("correctansiers"))
