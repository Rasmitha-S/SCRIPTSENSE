import re
from typing import Set, List, Optional
import itertools

VOCAB_LIST = [
    # User target test words
    "are", "answer", "answers", "answered", "answering",
    "correct", "correctly", "correction", "corrections",
    "protocol", "protocols",
    "computer", "computers", "computing", "computation",
    "server", "servers",
    "network", "networks", "networking", "networked",
    "error", "errors",
    "transfer", "transfers", "transferred", "transferring",
    
    # Common academic & STEM vocabulary
    "interconnected", "interconnection", "interconnections",
    "share", "shares", "shared", "sharing",
    "other", "others", "otherwise",
    "packet", "packets", "layer", "layers",
    "data", "device", "devices", "communicate", "communicates", "communicated", "communication",
    "connection", "connections", "oriented", "reliable", "unreliable", "delivery", "handshake",
    "transmission", "transport", "routing", "router", "routers",
    "hardware", "software", "firmware", "driver", "drivers",
    "memory", "processor", "processors", "processing", "process", "processes",
    "register", "registers", "circuit", "circuits", "current", "voltage", "resistor", "resistance",
    "force", "forces", "mass", "acceleration", "accelerate", "accelerates", "momentum",
    "gravity", "gravitational", "friction", "frictionless", "energy", "power", "work",
    "velocity", "vector", "scalar", "newton", "newtons", "joule", "joules", "watt", "watts",
    "proportional", "inversely", "directly", "constant", "rate", "ratio", "variable", "variables",
    "structure", "structures", "structural", "architecture", "architectures",
    "operator", "operators", "operation", "operations", "operand", "operands",
    "array", "arrays", "string", "strings", "character", "characters", "integer", "integers",
    "pointer", "pointers", "address", "addresses", "reference", "references",
    "function", "functions", "method", "methods", "parameter", "parameters", "argument", "arguments",
    "return", "returns", "returned", "returning", "result", "results", "resulting",
    "query", "queries", "record", "records", "report", "reports",
    "resource", "resources", "storage", "thread", "threads", "virtual", "barrier",
    "require", "requires", "required", "requirement", "requirements",
    "format", "formats", "formatted", "formatting", "standard", "standards",
    "program", "programs", "programmed", "programmer", "programmers", "programming",
    "property", "properties", "performance", "perform", "performs", "performed",
    "reaction", "reactions", "cellular", "respiration", "chlorophyll", "photosynthesis",
    "primary", "secondary", "tertiary", "order", "orders", "ordered", "ordering",
    "forward", "reverse", "internal", "external", "source", "destination",
    "receiver", "receivers", "receive", "receives", "received", "receiving",
    "sender", "senders", "send", "sends", "sending", "sent",
    "client", "clients", "peer", "peers", "node", "nodes", "link", "links",
    "medium", "media", "signal", "signals", "channel", "channels",
    "bandwidth", "frequency", "throughput", "latency", "delay",
    "measure", "measured", "measurement", "measurements", "metric", "metrics",
    "system", "systems", "state", "states", "status", "table", "tables",
    
    # Common short words
    "a", "an", "the", "in", "on", "at", "to", "for", "of", "with", "by", "from",
    "is", "am", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "done", "will", "would", "shall", "should", "may", "might", "can", "could", "must",
    "it", "its", "they", "them", "their", "theirs", "this", "that", "these", "those",
    "we", "our", "ours", "us", "you", "your", "yours", "he", "him", "his", "she", "her", "hers",
    "and", "or", "but", "nor", "so", "yet", "if", "then", "else", "when", "where", "why", "how", "what", "which",
    "all", "any", "both", "each", "few", "more", "most", "some", "such", "no", "not", "only", "own", "same", "too", "very",
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "first", "second", "third",
    
    # Words with x, n, v that MUST NOT be replaced
    "box", "boxes", "fox", "foxes", "tax", "taxes", "six", "sixes", "mix", "mixed", "mixing",
    "fix", "fixed", "fixing", "max", "maximum", "matrix", "matrices", "index", "indexes", "indices",
    "syntax", "complex", "complexity", "prefix", "suffix", "pixel", "pixels", "proxy", "proxies",
    "text", "texts", "next", "context", "convex", "vertex", "vertices", "latex", "unix", "linux",
    "can", "man", "men", "sun", "run", "ten", "pen", "son", "pan", "fan", "van", "tan", "pin", "bin",
    "give", "gives", "given", "giving", "have", "live", "save", "wave", "move", "view", "value"
]

COMMON_ENGLISH_WORDS: Set[str] = set(w.lower() for w in VOCAB_LIST)

def preserve_case(original: str, modified: str) -> str:
    """Preserves casing of original word."""
    if original.isupper():
        return modified.upper()
    if original.istitle():
        return modified.capitalize()
    return modified

def generate_r_candidates(word: str) -> List[str]:
    """
    Generates candidate word variations by substituting typical OCR handwriting confusions with 'r' or 'w'.
    """
    candidates = []
    
    # Handle 'iv' -> 'w' / 'r'
    if 'iv' in word:
        candidates.append(word.replace('iv', 'w'))
        candidates.append(word.replace('iv', 'r'))

    # Collect indices of confused characters ('x', 'n', 'v')
    confused_indices = [i for i, ch in enumerate(word) if ch in ('x', 'n', 'v')]
    
    # Check all subsets of size 1 to min(3, len) to replace with 'r'
    for r_count in range(1, min(len(confused_indices) + 1, 4)):
        for combo in itertools.combinations(confused_indices, r_count):
            cand_chars = list(word)
            for idx in combo:
                cand_chars[idx] = 'r'
            candidates.append("".join(cand_chars))

    return candidates

def repair_r_confusions_in_word(raw_word: str) -> str:
    m = re.match(r'^([^a-zA-Z0-9]*)([a-zA-Z0-9_-]+)([^a-zA-Z0-9]*)$', raw_word)
    if not m:
        return raw_word

    prefix, core, suffix = m.groups()
    
    # Handle internal OCR underscores (e.g. "collection_of" -> "collection of")
    if '_' in core and len(core) > 2:
        parts = core.split('_')
        repaired_parts = [repair_r_confusions_in_word(p) for p in parts if p]
        return prefix + " ".join(repaired_parts) + suffix

    lower_core = core.lower()

    # If already a valid English word (like 'box', 'can', 'six', 'matrix', 'tax', 'are'), keep as-is!
    if lower_core in COMMON_ENGLISH_WORDS:
        return raw_word

    # Generate r-repaired candidates
    candidates = generate_r_candidates(lower_core)
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

test_cases = [
    # User required words and misrecognized variations
    ("axe", "are"),
    ("ane", "are"),
    ("ansiver", "answer"),
    ("answen", "answer"),
    ("answex", "answer"),
    ("coxxect", "correct"),
    ("conrect", "correct"),
    ("coxrect", "correct"),
    ("pxotocol", "protocol"),
    ("pnotocol", "protocol"),
    ("computex", "computer"),
    ("computen", "computer"),
    ("computens", "computers"),
    ("sexvex", "server"),
    ("senven", "server"),
    ("netwoxk", "network"),
    ("netwonk", "network"),
    ("exxox", "error"),
    ("ennon", "error"),
    ("txansfen", "transfer"),
    ("tnansfen", "transfer"),
    ("intexconnected", "interconnected"),
    ("intenconnected", "interconnected"),
    ("othen", "other"),
    ("shane", "share"),
    ("shaxe", "share"),
    
    # Valid words with 'x', 'n', 'v' that MUST NOT be modified
    ("box", "box"),
    ("fox", "fox"),
    ("six", "six"),
    ("tax", "tax"),
    ("matrix", "matrix"),
    ("syntax", "syntax"),
    ("can", "can"),
    ("sun", "sun"),
    ("men", "men"),
    ("run", "run"),
    ("live", "live"),
    ("view", "view")
]

print("Running Unit Tests on 'r' Confusion Repair Algorithm:")
passed = 0
for raw, expected in test_cases:
    result = repair_ocr_text(raw)
    ok = (result == expected)
    if ok:
        passed += 1
        print(f"  [PASS] '{raw}' -> '{result}'")
    else:
        print(f"  [FAIL] '{raw}' -> got '{result}', expected '{expected}'")

print(f"\nResult: {passed}/{len(test_cases)} Passed.")
