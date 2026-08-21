import os
import json
import logging
import re
from typing import Optional, List, Dict, Tuple, Any
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("scriptsense.gemini")

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

def extract_key_terms(text: str) -> List[str]:
    """Extracts informative keywords (ignoring common stopwords) to identify conceptual overlap."""
    stopwords = {
        'the', 'a', 'an', 'and', 'or', 'is', 'are', 'was', 'were', 'to', 'of', 'in',
        'for', 'on', 'with', 'at', 'by', 'from', 'that', 'this', 'it', 'as', 'be',
        'that', 'its', 'their', 'which', 'what', 'where', 'when', 'how', 'has', 'have'
    }
    words = re.findall(r'[a-zA-Z0-9_]{3,}', text.lower())
    return [w for w in words if w not in stopwords]

def generate_template_explanation(
    student_answer: str,
    model_answer: Optional[str],
    similarity: float,
    marks_obtained: float,
    max_marks: float,
    question: Optional[str] = None,
    explanation: Optional[str] = None,
    user_question: Optional[str] = None,
) -> str:
    """
    Intelligent, grounded, rule-based explanation generator used when Gemini API key is not configured.
    """
    model_text = (model_answer or "").strip()
    student_text = (student_answer or "").strip()
    pct = round((marks_obtained / max_marks) * 100) if max_marks > 0 else 0
    sim_pct = round(similarity * 100)

    student_words = set(extract_key_terms(student_text))
    model_words = set(extract_key_terms(model_text))

    matched_keywords = list(student_words.intersection(model_words))
    missing_keywords = [w for w in model_words if w not in student_words]

    uq_lower = (user_question or "").lower().strip()

    # Case A: Follow-up question specifically asking about missed points or lost marks
    if "why" in uq_lower or "lost" in uq_lower or "lose" in uq_lower or "miss" in uq_lower or "deduct" in uq_lower:
        if pct >= 90:
            return (
                f"🌟 **Outstanding Performance!** You scored **{marks_obtained}/{max_marks}** ({pct}%).\n\n"
                f"You captured virtually all core concepts from the model solution. Any minor deduction reflects subtle phrasing "
                f"or precision differences. Keep up the excellent work!"
            )
        
        reply = (
            f"📊 **Why Marks Were Allocated ({marks_obtained}/{max_marks} Marks • {pct}%):**\n\n"
            f"Your answer showed a **{sim_pct}% semantic match** with the reference solution.\n\n"
        )

        if matched_keywords:
            reply += f"✅ **Concepts you included:** {', '.join(f'`{k}`' for k in matched_keywords[:6])}\n\n"
        
        if missing_keywords:
            reply += (
                f"⚠️ **Key points/terms missing or incomplete compared to the model answer:**\n"
                + "\n".join(f"- Missing mention of **`{w}`**" for w in missing_keywords[:5])
                + "\n\n"
            )
        else:
            reply += (
                "⚠️ **Areas to improve:** The answer touched upon the topic but lacked the exact formal definitions, "
                "units, or step-by-step mathematical reasoning outlined in the teacher's model answer.\n\n"
            )

        reply += (
            f"💡 **Tip for Full Marks:** To achieve full marks next time, ensure you state all standard formulas with unit notations "
            f"and explicitly define every variable involved."
        )
        return reply

    # Case B: Follow-up asking for how to improve or get full marks
    if "full marks" in uq_lower or "improve" in uq_lower or "next time" in uq_lower or "better" in uq_lower:
        return (
            f"🚀 **How to Score Full Marks on '{question or 'this topic'}':**\n\n"
            f"1. **State the Principle Clearly**: Ensure formal definitions match standard scientific/course standards.\n"
            f"2. **Include Complete Formulas & Units**: For example, when stating formulas, define each term (e.g. $F = m \\times a$) and state SI units (e.g. Newtons).\n"
            f"3. **Structure Your Steps**: Use numbered steps or bullet points for multi-part questions to make grading easy to verify.\n\n"
            f"📖 **Teacher's Reference Solution to Review:**\n> *\"{model_text or 'Refer to model answer in portal.'}\"*"
        )

    # Case C: Default Initial / General Overview Message
    if pct >= 90:
        tone_badge = "🌟 **Outstanding Work!**"
        perf_summary = "Your answer closely aligns with the reference model answer, demonstrating deep subject comprehension."
    elif pct >= 75:
        tone_badge = "👍 **Great Effort!**"
        perf_summary = "You demonstrated solid conceptual understanding with strong keyword overlap, missing only a few specific details or formula notations."
    elif pct >= 50:
        tone_badge = "📝 **Good Attempt!**"
        perf_summary = "You showed partial conceptual understanding, but missed several key terms, units, or structural steps present in the teacher's model answer."
    else:
        tone_badge = "⚠️ **Needs Review**"
        perf_summary = "Your answer had limited semantic overlap with the model solution. Reviewing the model answer below will help clarify the required concepts."

    matched_str = f" `{', '.join(matched_keywords[:5])}`" if matched_keywords else " basic terminology"

    response = (
        f"{tone_badge}\n\n"
        f"You scored **{marks_obtained} out of {max_marks} marks** ({pct}% Score • **{sim_pct}% Semantic Similarity**).\n\n"
        f"### 📋 Breakdown of Your Score:\n"
        f"- **What you did well:** Captured{matched_str}.\n"
    )

    if explanation:
        response += f"- **AI Evaluation Note:** *{explanation}*\n"

    if missing_keywords:
        response += f"- **Concepts to clarify:** {', '.join(f'`{k}`' for k in missing_keywords[:4])}.\n\n"
    else:
        response += "\n"

    response += (
        f"Feel free to ask follow-up questions like **\"Why did I lose marks?\"**, **\"What did I miss?\"**, "
        f"or **\"How can I score full marks next time?\"**!"
    )
    return response

def generate_marks_explanation(
    student_answer: str,
    model_answer: Optional[str] = None,
    similarity: float = 0.0,
    marks_obtained: float = 0.0,
    max_marks: float = 10.0,
    question: Optional[str] = None,
    explanation: Optional[str] = None,
    user_question: Optional[str] = None,
    history: Optional[List[Dict[str, str]]] = None,
) -> Tuple[str, bool, str]:
    """
    Generates a grounded explanation for student marks using Gemini 1.5 Flash (via REST)
    or falls back to intelligent rule-based templates if the API key is not configured.
    
    Returns: (explanation_text, is_ai_generated, source)
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    # If no API key provided, use template fallback immediately
    if not api_key:
        logger.info("GEMINI_API_KEY not set. Using intelligent template fallback for marks explanation.")
        fallback_text = generate_template_explanation(
            student_answer=student_answer,
            model_answer=model_answer,
            similarity=similarity,
            marks_obtained=marks_obtained,
            max_marks=max_marks,
            question=question,
            explanation=explanation,
            user_question=user_question,
        )
        return fallback_text, False, "template"

    # Construct Grounded Prompt for Gemini 1.5 Flash
    system_instruction = (
        "You are ScriptSense AI Tutor, an academic assistant explaining exam marks to a student in an encouraging, "
        "constructive, and strictly grounded manner.\n"
        "STRICT GUIDELINES:\n"
        "1. Ground all explanations STRICTLY in the provided Student Answer, Reference Model Answer, and Marks Scored. "
        "Do NOT invent facts, outside details, or claim the student wrote something they did not.\n"
        "2. If the student asks why they lost marks or what they missed, contrast their exact answer against the model answer "
        "to pinpoint missing keywords, omitted steps, incorrect units, or incomplete definitions.\n"
        "3. Maintain a supportive, polite, and encouraging tone.\n"
        "4. Format responses cleanly with Markdown (bullet points, bold highlights, concise paragraphs).\n"
        "5. Keep replies focused, helpful, and concise (under 250 words)."
    )

    context_prompt = (
        f"EXAM CONTEXT:\n"
        f"- Question: {question or 'Subject Exam Question'}\n"
        f"- Teacher Reference Model Answer: \"{model_answer or 'Standard Reference Solution'}\"\n"
        f"- Student's Answer (OCR Extracted): \"{student_answer or 'No answer provided'}\"\n"
        f"- Marks Awarded: {marks_obtained} / {max_marks} ({round((marks_obtained/max_marks)*100 if max_marks > 0 else 0)}%)\n"
        f"- Semantic Similarity: {round(similarity * 100, 1)}%\n"
        f"- Automated Evaluation Note: \"{explanation or 'Semantic evaluation complete.'}\"\n\n"
    )

    if user_question and user_question.strip():
        user_prompt = f"{context_prompt}STUDENT QUESTION: {user_question.strip()}\n\nPlease provide a clear, grounded explanation answering the student's question."
    else:
        user_prompt = f"{context_prompt}Please provide an initial welcoming overview explaining how the student's marks were allocated, what they did well, and what could be improved."

    # Build contents payload
    payload: Dict[str, Any] = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": f"{system_instruction}\n\n{user_prompt}"}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 800
        }
    }

    # Inject conversation history if provided
    if history and isinstance(history, list) and len(history) > 0:
        history_contents = []
        for msg in history[-6:]: # last 6 messages
            role = "user" if msg.get("sender") == "user" or msg.get("role") == "user" else "model"
            text_content = msg.get("text") or msg.get("content") or ""
            if text_content:
                history_contents.append({
                    "role": role,
                    "parts": [{"text": text_content}]
                })
        if history_contents:
            history_contents.append({
                "role": "user",
                "parts": [{"text": user_prompt}]
            })
            payload["contents"] = history_contents

    try:
        url = f"{GEMINI_API_URL}?key={api_key}"
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=12)

        if response.status_code == 200:
            res_json = response.json()
            candidates = res_json.get("candidates", [])
            if candidates and "content" in candidates[0] and "parts" in candidates[0]["content"]:
                gemini_reply = candidates[0]["content"]["parts"][0].get("text", "").strip()
                if gemini_reply:
                    return gemini_reply, True, "gemini-1.5-flash"
        
        logger.warning(f"Gemini API returned status {response.status_code}: {response.text}. Using fallback template.")
    except Exception as e:
        logger.warning(f"Error connecting to Gemini API: {e}. Falling back to template generator.")

    # Fallback if Gemini call failed
    fallback_text = generate_template_explanation(
        student_answer=student_answer,
        model_answer=model_answer,
        similarity=similarity,
        marks_obtained=marks_obtained,
        max_marks=max_marks,
        question=question,
        explanation=explanation,
        user_question=user_question,
    )
    return fallback_text, False, "template"
