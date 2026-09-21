import {
  RubricCriterion,
  QuestionItem,
  RubricScore,
  QuestionEvaluation
} from '../types/index.js';

export function calculateSuggestedMarks(similarity: number, maxMarks: number): number {
  const clamped = Math.max(0.0, Math.min(1.0, similarity));
  return Math.round(clamped * maxMarks * 10) / 10;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

export function computeSimilarity(studentText: string, modelText: string): number {
  const sText = studentText.trim();
  const mText = modelText.trim();

  if (!sText || !mText) return 0.0;

  const sTokens = tokenize(sText);
  const mTokens = tokenize(mText);

  if (mTokens.length === 0 || sTokens.length === 0) return 0.0;

  const sSet = new Set(sTokens);
  const mSet = new Set(mTokens);

  // 1. Unigram Overlap (Jaccard / Overlap coefficient)
  let intersectionCount = 0;
  for (const token of mSet) {
    if (sSet.has(token)) {
      intersectionCount++;
    }
  }

  const tokenOverlap = intersectionCount / mSet.size;

  // 2. Bigram Overlap for phrase and structural similarity
  const getBigrams = (tokens: string[]) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) {
      bigrams.add(`${tokens[i]} ${tokens[i + 1]}`);
    }
    return bigrams;
  };

  const sBigrams = getBigrams(sTokens);
  const mBigrams = getBigrams(mTokens);

  let bigramOverlap = 0;
  if (mBigrams.size > 0) {
    let bCount = 0;
    for (const bg of mBigrams) {
      if (sBigrams.has(bg)) bCount++;
    }
    bigramOverlap = bCount / mBigrams.size;
  }

  // 3. Composite Similarity with length sensitivity
  const rawSimilarity = tokenOverlap * 0.7 + bigramOverlap * 0.3;
  const scaled = Math.min(0.98, rawSimilarity * 1.15 + 0.1);
  const similarity = Math.max(0.0, Math.min(1.0, scaled));

  return Math.round(similarity * 10000) / 10000;
}

export function detectKeywordsInText(text: string, keywords?: string[]): { matched: string[]; ratio: number } {
  if (!keywords || keywords.length === 0) {
    return { matched: [], ratio: 1.0 };
  }

  const textLower = text.toLowerCase();
  const matched: string[] = [];

  for (const kw of keywords) {
    const cleanKw = kw.trim().toLowerCase();
    if (!cleanKw) continue;

    const regex = new RegExp(`\\b${cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(textLower) || textLower.includes(cleanKw)) {
      matched.push(kw.trim());
    }
  }

  const ratio = Math.round((matched.length / keywords.length) * 100) / 100;
  return { matched, ratio };
}

export function segmentStudentTextByQuestions(
  studentText: string,
  questions: QuestionItem[]
): Record<number, string> {
  if (!questions || questions.length <= 1) {
    return { 1: studentText.trim() };
  }

  const numQuestions = questions.length;
  const headerPattern = /(?:^|\n)\s*(?:(?:q(?:uestion)?|ans(?:wer)?|part)\s*[:.\-]?\s*(\d+|[a-zA-Z])|(\d+)\s*[\.\)\-:])\s*/gi;

  const matches: { index: number; qNum: number; startPos: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = headerPattern.exec(studentText)) !== null) {
    const rawQ = match[1] || match[2];
    const parsed = parseInt(rawQ, 10);
    const qNum = isNaN(parsed) ? matches.length + 1 : parsed;
    matches.push({
      index: match.index,
      qNum,
      startPos: match.index + match[0].length
    });
  }

  const segments: Record<number, string> = {};

  if (matches.length >= 2) {
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const endPos = i + 1 < matches.length ? matches[i + 1].index : studentText.length;
      const content = studentText.substring(current.startPos, endPos).trim();
      segments[current.qNum] = content;
    }
  } else {
    // Fallback: Split by double newlines across questions
    const paragraphs = studentText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length >= numQuestions) {
      const chunkSize = Math.max(1, Math.floor(paragraphs.length / numQuestions));
      for (let i = 0; i < numQuestions; i++) {
        const qNum = questions[i].q_num || (i + 1);
        const start = i * chunkSize;
        const end = i < numQuestions - 1 ? (i + 1) * chunkSize : paragraphs.length;
        segments[qNum] = paragraphs.slice(start, end).join('\n\n');
      }
    } else {
      for (let i = 0; i < numQuestions; i++) {
        const qNum = questions[i].q_num || (i + 1);
        segments[qNum] = studentText.trim();
      }
    }
  }

  // Ensure all questions have an entry
  for (let i = 0; i < numQuestions; i++) {
    const qNum = questions[i].q_num || (i + 1);
    if (!segments[qNum]) {
      segments[qNum] = studentText.trim();
    }
  }

  return segments;
}

export function evaluateRubricsForQuestion(
  studentText: string,
  rubrics?: RubricCriterion[],
  qSimilarity: number = 0.0
): RubricScore[] {
  if (!rubrics || rubrics.length === 0) {
    return [];
  }

  const scores: RubricScore[] = [];

  for (const r of rubrics) {
    const cId = r.id || '';
    const criterionText = r.criterion || 'Criteria Requirement';
    const maxMarks = Number(r.max_marks) || 2.0;
    const keywords = r.keywords || [];

    const { matched, ratio: kwRatio } = detectKeywordsInText(studentText, keywords);

    let effectiveSim = keywords.length > 0
      ? Math.round((qSimilarity * 0.65 + kwRatio * 0.35) * 10000) / 10000
      : qSimilarity;

    effectiveSim = Math.max(0.0, Math.min(1.0, effectiveSim));
    const suggestedMarks = Math.round(effectiveSim * maxMarks * 10) / 10;

    let notes = '';
    if (effectiveSim >= 0.85) {
      notes = keywords.length > 0
        ? `Criteria fully satisfied. (${matched.length}/${keywords.length} concepts verified)`
        : 'Strong semantic coverage of criteria.';
    } else if (effectiveSim >= 0.5) {
      notes = keywords.length > 0
        ? `Partially satisfied (${matched.length}/${keywords.length} concepts found).`
        : 'Moderate alignment with criterion.';
    } else {
      notes = 'Criteria not adequately addressed in answer.';
    }

    scores.push({
      criterion_id: cId,
      criterion: criterionText,
      max_marks: maxMarks,
      suggested_marks: suggestedMarks,
      similarity: effectiveSim,
      matched_keywords: matched,
      notes
    });
  }

  return scores;
}

export function evaluateMultiQuestionExam(
  studentText: string,
  questionsList: QuestionItem[],
  totalMaxMarks: number
): {
  overallSimilarity: number;
  totalSuggested: number;
  overallExplanation: string;
  allRubricScores: RubricScore[];
  questionEvaluations: QuestionEvaluation[];
} {
  if (!questionsList || questionsList.length === 0) {
    return {
      overallSimilarity: 0.0,
      totalSuggested: 0.0,
      overallExplanation: 'No questions defined.',
      allRubricScores: [],
      questionEvaluations: []
    };
  }

  const segmentedAnswers = segmentStudentTextByQuestions(studentText, questionsList);
  const questionEvaluations: QuestionEvaluation[] = [];
  const allRubricScores: RubricScore[] = [];

  let totalSuggested = 0.0;
  let weightedSimSum = 0.0;
  let totalQWeight = 0.0;

  for (let i = 0; i < questionsList.length; i++) {
    const q = questionsList[i];
    const qNum = q.q_num || (i + 1);
    const qPrompt = q.question || `Question ${qNum}`;
    const mAns = q.model_answer || '';
    const qMax = Number(q.max_marks) || 5.0;
    const qRubrics = q.rubric || [];

    const sAns = segmentedAnswers[qNum] || '';

    const qSim = computeSimilarity(sAns, mAns);
    const qRubricScores = evaluateRubricsForQuestion(sAns, qRubrics, qSim);
    allRubricScores.push(...qRubricScores);

    let qSuggested = 0.0;
    if (qRubricScores.length > 0) {
      const sumRubric = qRubricScores.reduce((acc, r) => acc + r.suggested_marks, 0);
      qSuggested = Math.min(qMax, Math.round(sumRubric * 10) / 10);
    } else {
      qSuggested = calculateSuggestedMarks(qSim, qMax);
    }

    let qExpl = '';
    if (qSim >= 0.8) {
      qExpl = `Q${qNum}: High semantic alignment (${Math.round(qSim * 100)}%). Solution accurately matches model answer.`;
    } else if (qSim >= 0.5) {
      qExpl = `Q${qNum}: Moderate alignment (${Math.round(qSim * 100)}%). Demonstrates partial conceptual accuracy.`;
    } else {
      qExpl = `Q${qNum}: Low alignment (${Math.round(qSim * 100)}%). Critical elements appear incomplete or divergent.`;
    }

    questionEvaluations.push({
      q_num: qNum,
      question: qPrompt,
      student_answer: sAns,
      model_answer: mAns,
      max_marks: qMax,
      similarity: qSim,
      suggested_marks: qSuggested,
      explanation: qExpl,
      rubric_scores: qRubricScores
    });

    totalSuggested += qSuggested;
    weightedSimSum += (qSim * qMax);
    totalQWeight += qMax;
  }

  const overallSimilarity = totalQWeight > 0 ? Math.round((weightedSimSum / totalQWeight) * 10000) / 10000 : 0.0;
  totalSuggested = Math.round(Math.min(totalMaxMarks, totalSuggested) * 10) / 10;

  const overallExplanation = (
    `Multi-question exam evaluation completed across ${questionsList.length} questions. ` +
    `Overall semantic alignment: ${(overallSimilarity * 100).toFixed(1)}%. ` +
    `Suggested cumulative score: ${totalSuggested} / ${totalMaxMarks} marks.`
  );

  return {
    overallSimilarity,
    totalSuggested,
    overallExplanation,
    allRubricScores,
    questionEvaluations
  };
}

export function evaluateAnswers(
  studentText: string,
  modelText: string,
  maxMarks: number,
  rubric?: RubricCriterion[]
): {
  similarity: number;
  suggestedMarks: number;
  explanation: string;
  rubricScores: RubricScore[];
} {
  if (!studentText.trim() || !modelText.trim()) {
    return {
      similarity: 0.0,
      suggestedMarks: 0.0,
      explanation: 'Empty answer text provided. Minimum score applied.',
      rubricScores: []
    };
  }

  const similarity = computeSimilarity(studentText, modelText);
  let rubricScores: RubricScore[] = [];
  let suggested = 0.0;

  if (rubric && rubric.length > 0) {
    rubricScores = evaluateRubricsForQuestion(studentText, rubric, similarity);
    const sumRubric = rubricScores.reduce((acc, r) => acc + r.suggested_marks, 0);
    suggested = Math.min(maxMarks, Math.round(sumRubric * 10) / 10);
  } else {
    suggested = calculateSuggestedMarks(similarity, maxMarks);
  }

  let explanation = '';
  if (similarity >= 0.8) {
    explanation = (
      `High semantic overlap (${(similarity * 100).toFixed(1)}%). Core concepts, principles, and key terminology ` +
      `match the teacher's model answer accurately.`
    );
  } else if (similarity >= 0.5) {
    explanation = (
      `Moderate semantic overlap (${(similarity * 100).toFixed(1)}%). The answer demonstrates partial conceptual ` +
      `understanding but lacks some key terminology or explanatory depth present in the model answer.`
    );
  } else {
    explanation = (
      `Low semantic overlap (${(similarity * 100).toFixed(1)}%). The answer diverges significantly from the ` +
      `model answer or is missing critical core concepts.`
    );
  }

  return {
    similarity,
    suggestedMarks: suggested,
    explanation,
    rubricScores
  };
}
