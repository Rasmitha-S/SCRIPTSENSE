export interface User {
  id: number;
  username: string;
  email?: string | null;
  password_hash: string;
  role: 'admin' | 'teacher';
  full_name?: string | null;
  is_active: boolean | number;
  created_at: string;
}

export interface Student {
  id: number;
  teacher_id?: number | null;
  name: string;
  roll_number?: string | null;
  created_at: string;
}

export interface Test {
  id: number;
  test_name: string;
  teacher_id?: number | null;
  subject?: string | null;
  max_marks: number;
  created_at: string;
}

export interface TestStudent {
  test_id: number;
  student_id: number;
}

export interface AnswerSheet {
  id: number;
  student_id?: number | null;
  teacher_id?: number | null;
  test_id?: number | null;
  student_name?: string | null;
  file_path: string;
  uploaded_at: string;
  extracted_text?: string | null;
  uploaded_by?: string | null;
}

export interface ModelAnswer {
  id: number;
  test_id?: number | null;
  question: string;
  answer_text: string;
  max_marks: number;
  title?: string | null;
  subject?: string | null;
  questions_json?: string | null;
  rubric_json?: string | null;
}

export interface Evaluation {
  id: number;
  answer_sheet_id: number;
  model_answer_id: number;
  similarity: number;
  suggested_marks: number;
  explanation?: string | null;
  rubric_scores_json?: string | null;
  question_evaluations_json?: string | null;
}

export interface FinalResult {
  id: number;
  evaluation_id: number;
  final_marks: number;
  teacher_feedback?: string | null;
  verified_by?: string | null;
  verified_at: string;
  rubric_adjustments_json?: string | null;
  question_results_json?: string | null;
}

// Rubric & Multi-Question Interfaces
export interface RubricCriterion {
  id?: string;
  criterion: string;
  max_marks: number;
  keywords?: string[];
  description?: string;
}

export interface QuestionItem {
  q_num: number;
  question: string;
  model_answer: string;
  max_marks: number;
  rubric?: RubricCriterion[];
}

export interface RubricScore {
  criterion_id?: string;
  criterion: string;
  max_marks: number;
  suggested_marks: number;
  similarity: number;
  matched_keywords?: string[];
  notes?: string;
}

export interface QuestionEvaluation {
  q_num: number;
  question: string;
  student_answer?: string;
  model_answer?: string;
  max_marks: number;
  similarity: number;
  suggested_marks: number;
  explanation?: string;
  rubric_scores?: RubricScore[];
}

export interface RubricAdjustment {
  criterion_id?: string;
  criterion?: string;
  final_marks: number;
  teacher_note?: string;
}

export interface QuestionResult {
  q_num: number;
  final_marks: number;
  max_marks?: number;
  teacher_comment?: string;
  rubric_adjustments?: RubricAdjustment[];
}

// Request & Response Types
export interface TokenPayload {
  sub: string;
  role: string;
  user_id: number;
  exp?: number;
}

export interface UserResponse {
  id: number;
  username: string;
  email?: string | null;
  role: string;
  full_name?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  name: string;
  role: string;
  username: string;
  status: string;
  full_name?: string | null;
  email?: string | null;
}
