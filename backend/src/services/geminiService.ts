import dotenv from 'dotenv';
import { isValidGeminiKey } from './ocrService.js';

dotenv.config();

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export function extractKeyTerms(text: string): string[] {
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'is', 'are', 'was', 'were', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'that', 'this', 'it', 'as', 'be',
    'that', 'its', 'their', 'which', 'what', 'where', 'when', 'how', 'has', 'have'
  ]);
  const words = text.toLowerCase().match(/[a-zA-Z0-9_]{3,}/g) || [];
  return words.filter(w => !stopwords.has(w));
}

export function generateTemplateExplanation(params: {
  studentAnswer: string;
  modelAnswer?: string | null;
  similarity: number;
  marksObtained: number;
  maxMarks: number;
  question?: string | null;
  explanation?: string | null;
  userQuestion?: string | null;
}): string {
  const { studentAnswer, modelAnswer, similarity, marksObtained, maxMarks, question, explanation, userQuestion } = params;
  const modelText = (modelAnswer || '').trim();
  const studentText = (studentAnswer || '').trim();
  const pct = maxMarks > 0 ? Math.round((marksObtained / maxMarks) * 100) : 0;
  const simPct = Math.round(similarity * 100);

  const studentWords = new Set(extractKeyTerms(studentText));
  const modelWords = new Set(extractKeyTerms(modelText));

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const w of modelWords) {
    if (studentWords.has(w)) {
      matchedKeywords.push(w);
    } else {
      missingKeywords.push(w);
    }
  }

  const uqLower = (userQuestion || '').toLowerCase().trim();

  // Case A: Follow-up question asking why marks were lost / missed points
  if (uqLower.includes('why') || uqLower.includes('lost') || uqLower.includes('lose') || uqLower.includes('miss') || uqLower.includes('deduct')) {
    if (pct >= 90) {
      return (
        `🌟 **Outstanding Performance!** You scored **${marksObtained}/${maxMarks}** (${pct}%).\n\n` +
        `You captured virtually all core concepts from the model solution. Any minor deduction reflects subtle phrasing ` +
        `or precision differences. Keep up the excellent work!`
      );
    }

    let reply = (
      `📊 **Why Marks Were Allocated (${marksObtained}/${maxMarks} Marks • ${pct}%):**\n\n` +
      `Your answer showed a **${simPct}% semantic match** with the reference solution.\n\n`
    );

    if (matchedKeywords.length > 0) {
      reply += `✅ **Concepts you included:** ${matchedKeywords.slice(0, 6).map(k => `\`${k}\``).join(', ')}\n\n`;
    }

    if (missingKeywords.length > 0) {
      reply += (
        `⚠️ **Key points/terms missing or incomplete compared to the model answer:**\n` +
        missingKeywords.slice(0, 5).map(w => `- Missing mention of **\`${w}\`**`).join('\n') +
        `\n\n`
      );
    } else {
      reply += (
        `⚠️ **Areas to improve:** The answer touched upon the topic but lacked the exact formal definitions, ` +
        `units, or step-by-step mathematical reasoning outlined in the teacher's model answer.\n\n`
      );
    }

    reply += (
      `💡 **Tip for Full Marks:** To achieve full marks next time, ensure you state all standard formulas with unit notations ` +
      `and explicitly define every variable involved.`
    );
    return reply;
  }

  // Case B: Follow-up asking for how to improve or get full marks
  if (uqLower.includes('full marks') || uqLower.includes('improve') || uqLower.includes('next time') || uqLower.includes('better')) {
    return (
      `🚀 **How to Score Full Marks on '${question || 'this topic'}':**\n\n` +
      `1. **State the Principle Clearly**: Ensure formal definitions match standard scientific/course standards.\n` +
      `2. **Include Complete Formulas & Units**: For example, when stating formulas, define each term (e.g. $F = m \\times a$) and state SI units (e.g. Newtons).\n` +
      `3. **Structure Your Steps**: Use numbered steps or bullet points for multi-part questions to make grading easy to verify.\n\n` +
      `📖 **Teacher's Reference Solution to Review:**\n> *"${modelText || 'Refer to model answer in portal.'}"*`
    );
  }

  // Case C: Default Initial Overview
  let toneBadge = '';
  if (pct >= 90) toneBadge = '🌟 **Outstanding Work!**';
  else if (pct >= 75) toneBadge = '👍 **Great Effort!**';
  else if (pct >= 50) toneBadge = '📝 **Good Attempt!**';
  else toneBadge = '⚠️ **Needs Review**';

  const matchedStr = matchedKeywords.length > 0 ? ` \`${matchedKeywords.slice(0, 5).join(', ')}\`` : ' basic terminology';

  let response = (
    `${toneBadge}\n\n` +
    `You scored **${marksObtained} out of ${maxMarks} marks** (${pct}% Score • **${simPct}% Semantic Similarity**).\n\n` +
    `### 📋 Breakdown of Your Score:\n` +
    `- **What you did well:** Captured${matchedStr}.\n`
  );

  if (explanation) {
    response += `- **AI Evaluation Note:** *${explanation}*\n`;
  }

  if (missingKeywords.length > 0) {
    response += `- **Concepts to clarify:** ${missingKeywords.slice(0, 4).map(k => `\`${k}\``).join(', ')}.\n\n`;
  } else {
    response += '\n';
  }

  response += (
    `Feel free to ask follow-up questions like **"Why did I lose marks?"**, **"What did I miss?"**, ` +
    `or **"How can I score full marks next time?"**!`
  );

  return response;
}

export async function generateMarksExplanation(params: {
  studentAnswer: string;
  modelAnswer?: string | null;
  similarity?: number;
  marksObtained?: number;
  maxMarks?: number;
  question?: string | null;
  explanation?: string | null;
  userQuestion?: string | null;
  history?: Array<{ sender?: string; role?: string; text?: string; content?: string }> | null;
}): Promise<{ reply: string; isAiGenerated: boolean; source: string }> {
  const {
    studentAnswer,
    modelAnswer,
    similarity = 0.0,
    marksObtained = 0.0,
    maxMarks = 10.0,
    question,
    explanation,
    userQuestion,
    history
  } = params;

  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

  if (!isValidGeminiKey()) {
    const fallbackText = generateTemplateExplanation({
      studentAnswer,
      modelAnswer,
      similarity,
      marksObtained,
      maxMarks,
      question,
      explanation,
      userQuestion
    });
    return { reply: fallbackText, isAiGenerated: false, source: 'template' };
  }

  const systemInstruction = (
    'You are ScriptSense AI Tutor, an academic assistant explaining exam marks to a student in an encouraging, ' +
    'constructive, and strictly grounded manner.\n' +
    'STRICT GUIDELINES:\n' +
    '1. Ground all explanations STRICTLY in the provided Student Answer, Reference Model Answer, and Marks Scored. ' +
    'Do NOT invent facts, outside details, or claim the student wrote something they did not.\n' +
    '2. If the student asks why they lost marks or what they missed, contrast their exact answer against the model answer ' +
    'to pinpoint missing keywords, omitted steps, incorrect units, or incomplete definitions.\n' +
    '3. Maintain a supportive, polite, and encouraging tone.\n' +
    '4. Format responses cleanly with Markdown (bullet points, bold highlights, concise paragraphs).\n' +
    '5. Keep replies focused, helpful, and concise (under 250 words).'
  );

  const contextPrompt = (
    `EXAM CONTEXT:\n` +
    `- Question: ${question || 'Subject Exam Question'}\n` +
    `- Teacher Reference Model Answer: "${modelAnswer || 'Standard Reference Solution'}"\n` +
    `- Student's Answer (OCR Extracted): "${studentAnswer || 'No answer provided'}"\n` +
    `- Marks Awarded: ${marksObtained} / ${maxMarks} (${Math.round((marksObtained / (maxMarks || 1)) * 100)}%)\n` +
    `- Semantic Similarity: ${Math.round(similarity * 100)}%\n` +
    `- Automated Evaluation Note: "${explanation || 'Semantic evaluation complete.'}"\n\n`
  );

  const userPromptText = userQuestion && userQuestion.trim()
    ? `${contextPrompt}STUDENT QUESTION: ${userQuestion.trim()}\n\nPlease provide a clear, grounded explanation answering the student's question.`
    : `${contextPrompt}Please provide an initial welcoming overview explaining how the student's marks were allocated, what they did well, and what could be improved.`;

  const contentsPayload: any[] = [];

  if (history && Array.isArray(history) && history.length > 0) {
    for (const msg of history.slice(-6)) {
      const role = msg.sender === 'user' || msg.role === 'user' ? 'user' : 'model';
      const text = msg.text || msg.content || '';
      if (text) {
        contentsPayload.push({
          role,
          parts: [{ text }]
        });
      }
    }
  }

  contentsPayload.push({
    role: 'user',
    parts: [{ text: `${systemInstruction}\n\n${userPromptText}` }]
  });

  try {
    const url = `${GEMINI_API_URL}?key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: contentsPayload,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      const geminiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (geminiReply && geminiReply.trim()) {
        return { reply: geminiReply.trim(), isAiGenerated: true, source: 'gemini-1.5-flash' };
      }
    }
  } catch (err) {
    console.warn('[GEMINI CHAT NOTICE] API request error, falling back to template:', err);
  }

  const fallbackText = generateTemplateExplanation({
    studentAnswer,
    modelAnswer,
    similarity,
    marksObtained,
    maxMarks,
    question,
    explanation,
    userQuestion
  });

  return { reply: fallbackText, isAiGenerated: false, source: 'template' };
}
