import re
import logging
from typing import Tuple, List, Dict, Any, Optional
import numpy as np

logger = logging.getLogger("scriptsense.eval")

_model: Optional[Any] = None

def get_sentence_model():
    """
    Lazy load SentenceTransformer model to optimize startup time.
    """
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading SentenceTransformer model 'all-MiniLM-L6-v2'...")
            _model = SentenceTransformer('all-MiniLM-L6-v2')
        except Exception as e:
            logger.warning(f"Could not load SentenceTransformer: {e}. Fallback similarity will be used.")
            _model = False
    return _model

def calculate_suggested_marks(similarity: float, max_marks: float) -> float:
    """
    Converts cosine similarity (0–1) into marks bounded by max_marks per Section 9.4.
    """
    clamped_similarity = max(0.0, min(1.0, similarity))
    return round(clamped_similarity * max_marks, 1)

def compute_similarity(student_text: str, model_text: str) -> float:
    """
    Computes cosine similarity between student text and reference text.
    """
    if not student_text.strip() or not model_text.strip():
        return 0.0

    model = get_sentence_model()

    if model and hasattr(model, "encode"):
        try:
            embeddings = model.encode([student_text, model_text])
            emb1 = embeddings[0]
            emb2 = embeddings[1]
            norm1 = np.linalg.norm(emb1)
            norm2 = np.linalg.norm(emb2)

            if norm1 > 0 and norm2 > 0:
                raw_similarity = float(np.dot(emb1, emb2) / (norm1 * norm2))
            else:
                raw_similarity = 0.0
            return round(max(0.0, min(1.0, raw_similarity)), 4)
        except Exception as e:
            logger.warning(f"Embedding computation error: {e}. Using token overlap fallback.")

    # Token overlap fallback
    student_words = set(student_text.lower().split())
    model_words = set(model_text.lower().split())
    if model_words:
        overlap = len(student_words.intersection(model_words)) / len(model_words)
        return round(max(0.1, min(0.95, overlap * 1.2 + 0.3)), 2)
    return 0.5

def detect_keywords_in_text(text: str, keywords: List[str]) -> Tuple[List[str], float]:
    """
    Finds which required keywords/concepts are present in student text.
    """
    if not keywords:
        return [], 1.0

    text_lower = text.lower()
    matched = []
    for kw in keywords:
        kw_clean = kw.strip().lower()
        if not kw_clean:
            continue
        # Support simple words or phrases
        if re.search(r'\b' + re.escape(kw_clean) + r'\b', text_lower, re.IGNORECASE) or kw_clean in text_lower:
            matched.append(kw.strip())

    ratio = len(matched) / len(keywords) if keywords else 1.0
    return matched, round(ratio, 2)

def segment_student_text_by_questions(student_text: str, questions: List[Dict[str, Any]]) -> Dict[int, str]:
    """
    Segments handwritten OCR text into individual question responses (Q1, Q2, etc.).
    Uses regex markers for question patterns (e.g., 'Q1', 'Question 1', 'Ans 1', '1.').
    Falls back to proportional paragraph splitting if explicit markers are absent.
    """
    if not questions or len(questions) <= 1:
        return {1: student_text.strip()}

    num_questions = len(questions)
    # Pattern to find question headers
    header_pattern = re.compile(
        r'(?:^|\n)\s*(?:(?:q(?:uestion)?|ans(?:wer)?|part)\s*[:.\-]?\s*(\d+|[a-zA-Z])|(\d+)\s*[\.\)\-:])\s*',
        re.IGNORECASE
    )

    matches = list(header_pattern.finditer(student_text))
    segments: Dict[int, str] = {}

    if matches and len(matches) >= 2:
        for idx, match in enumerate(matches):
            raw_q = match.group(1) or match.group(2)
            try:
                q_idx = int(raw_q)
            except ValueError:
                q_idx = idx + 1

            start_pos = match.end()
            end_pos = matches[idx + 1].start() if idx + 1 < len(matches) else len(student_text)
            segment_content = student_text[start_pos:end_pos].strip()
            segments[q_idx] = segment_content
    else:
        # Fallback: Split by double newlines / paragraphs across questions
        paragraphs = [p.strip() for p in student_text.split("\n\n") if p.strip()]
        if len(paragraphs) >= num_questions:
            chunk_size = max(1, len(paragraphs) // num_questions)
            for i in range(num_questions):
                q_num = questions[i].get("q_num", i + 1)
                start_i = i * chunk_size
                end_i = (i + 1) * chunk_size if i < num_questions - 1 else len(paragraphs)
                segments[q_num] = "\n\n".join(paragraphs[start_i:end_i])
        else:
            # If text is too short to split cleanly, assign full text to all questions
            for i, q in enumerate(questions):
                q_num = q.get("q_num", i + 1)
                segments[q_num] = student_text.strip()

    # Ensure all questions have an entry
    for i, q in enumerate(questions):
        q_num = q.get("q_num", i + 1)
        if q_num not in segments:
            segments[q_num] = student_text.strip()

    return segments

def evaluate_rubrics_for_question(
    student_text: str,
    rubrics: List[Dict[str, Any]],
    q_similarity: float
) -> List[Dict[str, Any]]:
    """
    Evaluates step-wise rubric criteria for a given question answer.
    """
    if not rubrics:
        return []

    rubric_scores = []
    for r in rubrics:
        c_id = str(r.get("id") or "")
        criterion_text = r.get("criterion", "Criteria Requirement")
        max_marks = float(r.get("max_marks", 2.0))
        keywords = r.get("keywords") or []

        matched_kws, kw_ratio = detect_keywords_in_text(student_text, keywords)

        # Composite score: 65% semantic similarity of question + 35% keyword precision if keywords present
        if keywords:
            effective_sim = round(q_similarity * 0.65 + kw_ratio * 0.35, 4)
        else:
            effective_sim = q_similarity

        effective_sim = max(0.0, min(1.0, effective_sim))
        suggested_c_marks = round(effective_sim * max_marks, 1)

        if effective_sim >= 0.85:
            notes = f"Criteria fully satisfied. ({len(matched_kws)}/{len(keywords)} concepts verified)" if keywords else "Strong semantic coverage of criteria."
        elif effective_sim >= 0.5:
            notes = f"Partially satisfied ({len(matched_kws)}/{len(keywords)} concepts found)." if keywords else "Moderate alignment with criterion."
        else:
            notes = "Criteria not adequately addressed in answer."

        rubric_scores.append({
            "criterion_id": c_id,
            "criterion": criterion_text,
            "max_marks": max_marks,
            "suggested_marks": suggested_c_marks,
            "similarity": effective_sim,
            "matched_keywords": matched_kws,
            "notes": notes
        })

    return rubric_scores

def evaluate_multi_question_exam(
    student_text: str,
    questions_list: List[Dict[str, Any]],
    total_max_marks: float
) -> Tuple[float, float, str, List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Evaluates a multi-question exam paper against segmented student answers and step-wise rubrics.
    Returns: (overall_similarity, total_suggested_marks, overall_explanation, all_rubric_scores, question_evaluations)
    """
    if not questions_list:
        return 0.0, 0.0, "No questions defined.", [], []

    segmented_answers = segment_student_text_by_questions(student_text, questions_list)
    question_evaluations = []
    all_rubric_scores = []

    total_suggested = 0.0
    weighted_sim_sum = 0.0
    total_q_weight = 0.0

    for i, q in enumerate(questions_list):
        q_num = q.get("q_num", i + 1)
        q_prompt = q.get("question", f"Question {q_num}")
        m_ans = q.get("model_answer", "")
        q_max = float(q.get("max_marks", 5.0))
        q_rubrics = q.get("rubric") or []

        s_ans = segmented_answers.get(q_num, "")

        q_sim = compute_similarity(s_ans, m_ans)
        q_rubric_scores = evaluate_rubrics_for_question(s_ans, q_rubrics, q_sim)
        all_rubric_scores.extend(q_rubric_scores)

        # If rubrics exist for this question, sum rubric suggested marks; else use q_sim * q_max
        if q_rubric_scores:
            q_suggested = round(sum(r["suggested_marks"] for r in q_rubric_scores), 1)
            q_suggested = min(q_max, q_suggested)
        else:
            q_suggested = calculate_suggested_marks(q_sim, q_max)

        if q_sim >= 0.8:
            q_expl = f"Q{q_num}: High semantic alignment ({q_sim*100:.0f}%). Solution accurately matches model answer."
        elif q_sim >= 0.5:
            q_expl = f"Q{q_num}: Moderate alignment ({q_sim*100:.0f}%). Demonstrates partial conceptual accuracy."
        else:
            q_expl = f"Q{q_num}: Low alignment ({q_sim*100:.0f}%). Critical elements appear incomplete or divergent."

        question_evaluations.append({
            "q_num": q_num,
            "question": q_prompt,
            "student_answer": s_ans,
            "model_answer": m_ans,
            "max_marks": q_max,
            "similarity": q_sim,
            "suggested_marks": q_suggested,
            "explanation": q_expl,
            "rubric_scores": q_rubric_scores
        })

        total_suggested += q_suggested
        weighted_sim_sum += (q_sim * q_max)
        total_q_weight += q_max

    overall_similarity = round(weighted_sim_sum / total_q_weight, 4) if total_q_weight > 0 else 0.0
    total_suggested = round(min(total_max_marks, total_suggested), 1)

    overall_explanation = (
        f"Multi-question exam evaluation completed across {len(questions_list)} questions. "
        f"Overall semantic alignment: {(overall_similarity*100):.1f}%. "
        f"Suggested cumulative score: {total_suggested} / {total_max_marks} marks."
    )

    return overall_similarity, total_suggested, overall_explanation, all_rubric_scores, question_evaluations

def evaluate_answers(student_text: str, model_text: str, max_marks: float, rubric: Optional[List[Dict[str, Any]]] = None) -> Tuple[float, float, str, List[Dict[str, Any]]]:
    """
    Computes semantic similarity between student OCR text and single model answer with optional rubric.
    Returns (similarity, suggested_marks, explanation, rubric_scores).
    """
    if not student_text.strip() or not model_text.strip():
        return 0.0, 0.0, "Empty answer text provided. Minimum score applied.", []

    similarity = compute_similarity(student_text, model_text)

    rubric_scores = []
    if rubric:
        rubric_scores = evaluate_rubrics_for_question(student_text, rubric, similarity)
        suggested = round(sum(r["suggested_marks"] for r in rubric_scores), 1)
        suggested = min(max_marks, suggested)
    else:
        suggested = calculate_suggested_marks(similarity, max_marks)

    # Generate analytical explanation
    if similarity >= 0.8:
        explanation = (
            f"High semantic overlap ({(similarity*100):.1f}%). Core concepts, principles, and key terminology "
            "match the teacher's model answer accurately."
        )
    elif similarity >= 0.5:
        explanation = (
            f"Moderate semantic overlap ({(similarity*100):.1f}%). The answer demonstrates partial conceptual "
            "understanding but lacks some key terminology or explanatory depth present in the model answer."
        )
    else:
        explanation = (
            f"Low semantic overlap ({(similarity*100):.1f}%). The answer diverges significantly from the "
            "model answer or is missing critical core concepts."
        )

    return similarity, suggested, explanation, rubric_scores

