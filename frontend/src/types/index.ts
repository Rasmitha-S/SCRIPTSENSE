// ============================================================================
// ScriptSense Central TypeScript Type Definitions
// ============================================================================

export type UserRole = 'admin' | 'teacher' | 'student';

// --- Auth & Users ---
export interface User {
  id?: number;
  user_id?: number;
  username: string;
  email?: string;
  role: UserRole | string;
  name?: string;
  full_name?: string;
  is_active?: boolean;
  created_at?: string;
  studentId?: number;
  rollNumber?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  role?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  name: string;
  role: string;
  username: string;
  status: string;
  full_name?: string;
  email?: string;
}

export interface TeacherRegisterRequest {
  username: string;
  password: string;
  email?: string;
  full_name?: string;
  role?: string;
}

export interface ResetPasswordRequest {
  username: string;
  new_password: string;
}

export interface ResetPasswordResponse {
  message: string;
  success: boolean;
}

// --- Admin ---
export interface AdminStatsResponse {
  total_teachers: number;
  total_students: number;
  total_answer_sheets: number;
  total_evaluations: number;
  total_verified_results: number;
}

export interface Teacher {
  id: number;
  name: string;
  username: string;
  email?: string;
  role: string;
  is_active: boolean;
  created_at?: string;
  student_count: number;
  upload_count: number;
}

export interface TeacherCreateRequest {
  name: string;
  username: string;
  email: string;
  password: string;
  role?: string;
}

export interface TeacherUpdateRequest {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  is_active?: boolean;
}

export interface AdminStudentResponse {
  id: number;
  teacher_id?: number;
  teacher_name?: string;
  teacher_username?: string;
  name: string;
  roll_number?: string;
  upload_count: number;
  created_at?: string;
}

export interface AdminAnswerSheetResponse {
  id: number;
  student_id?: number;
  student_name?: string;
  roll_number?: string;
  teacher_id?: number;
  teacher_name?: string;
  file_path: string;
  filename?: string;
  extracted_text?: string;
  uploaded_at?: string;
}

export interface AdminEvaluationResponse {
  id: number;
  answer_sheet_id: number;
  student_id?: number;
  student_name?: string;
  roll_number?: string;
  teacher_id?: number;
  teacher_name?: string;
  title?: string;
  similarity: number;
  suggested_marks: number;
  max_marks: number;
  explanation?: string;
  final_marks?: number;
  status: string;
}

export interface AdminResultResponse {
  id: number;
  evaluation_id: number;
  answer_sheet_id: number;
  student_id?: number;
  student_name?: string;
  roll_number?: string;
  teacher_id?: number;
  teacher_name?: string;
  title?: string;
  max_marks: number;
  similarity: number;
  suggested_marks: number;
  final_marks?: number;
  teacher_feedback?: string;
  verified_by?: string;
  verified_at?: string;
  status: string;
}

// --- Students ---
export interface Student {
  id: number;
  teacher_id?: number;
  name: string;
  roll_number?: string;
  created_at?: string;
}

export interface StudentCreate {
  name: string;
  roll_number?: string;
}

export interface StudentDeleteResponse {
  success: boolean;
  message: string;
  student_id: number;
  student_name: string;
  deleted_sheets_count: number;
  deleted_evaluations_count: number;
}

export interface StudentOverviewItem {
  id: number;
  teacher_id?: number;
  name: string;
  roll_number?: string;
  upload_count: number;
  created_at?: string;
  latest_answer_sheet_id?: number;
  latest_evaluation_id?: number;
  status: 'Pending Upload' | 'Uploaded' | 'Evaluated' | 'Verified' | string;
  question?: string;
  similarity?: number;
  suggested_marks?: number;
  final_marks?: number;
  max_marks?: number;
  verified_by?: string;
  verified_at?: string;
}

// --- Rubrics & Multi-Question ---
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

// --- Upload & Answer Sheets ---
export interface UploadResponse {
  answer_sheet_id: number;
  student_id?: number;
  student_name?: string;
  roll_number?: string;
  test_id?: number;
  test_name?: string;
  file_path: string;
  filename?: string;
  extracted_text: string;
  uploaded_by?: string;
  status?: string;
}

export interface AnswerSheet {
  id: number;
  student_id?: number;
  student_name?: string;
  roll_number?: string;
  teacher_id?: number;
  test_id?: number;
  file_path: string;
  filename?: string;
  extracted_text?: string;
  uploaded_at?: string;
}

export interface TranscriptUpdateRequest {
  extracted_text: string;
}

export interface ExtractTextResponse {
  filename: string;
  extracted_text: string;
  file_type: string;
  status: string;
}

// --- Model Answer ---
export interface ModelAnswerCreate {
  test_id?: number;
  question?: string;
  answer_text?: string;
  max_marks?: number;
  title?: string;
  subject?: string;
  questions?: QuestionItem[];
  rubric?: RubricCriterion[];
}

export interface ModelAnswerResponse {
  model_answer_id: number;
  test_id?: number;
  title?: string;
  subject?: string;
  max_marks?: number;
  questions_count?: number;
  extracted_text?: string;
}

export interface ModelAnswerListItem {
  id: number;
  test_id?: number;
  title?: string;
  subject?: string;
  question?: string;
  answer_text?: string;
  max_marks: number;
  created_at?: string;
  questions_count?: number;
}

// --- Evaluation ---
export interface EvaluateRequest {
  answer_sheet_id: number;
  model_answer_id?: number;
  test_id?: number;
}

export interface EvaluateResponse {
  evaluation_id: number;
  answer_sheet_id?: number;
  model_answer_id?: number;
  test_id?: number;
  test_name?: string;
  student_id?: number;
  student_name?: string;
  roll_number?: string;
  title?: string;
  similarity: number;
  suggested_marks: number;
  max_marks?: number;
  explanation: string;
  rubric_scores?: RubricScore[];
  question_evaluations?: QuestionEvaluation[];
}

export interface BatchEvaluateRequest {
  answer_sheet_ids?: number[];
  model_answer_id?: number;
  test_id?: number;
}

export interface BatchEvaluateResponse {
  processed_count: number;
  successful_evaluations: EvaluateResponse[];
  failed_ids: number[];
}

// --- Results & Verification ---
export interface ResultResponse {
  id?: number;
  evaluation_id: number;
  answer_sheet_id: number;
  test_id?: number;
  test_name?: string;
  student_id?: number;
  student_name?: string;
  roll_number?: string;
  extracted_text?: string;
  title?: string;
  subject?: string;
  question?: string;
  model_answer?: string;
  max_marks: number;
  similarity: number;
  suggested_marks: number;
  explanation?: string;
  final_marks?: number;
  teacher_feedback?: string;
  verified_by?: string;
  verified_at?: string;
  status?: string;
  rubric_scores?: RubricScore[];
  question_evaluations?: QuestionEvaluation[];
  rubric_adjustments?: RubricAdjustment[];
  question_results?: QuestionResult[];
}

export interface ResultUpdateRequest {
  final_marks: number;
  teacher_feedback?: string;
  rubric_adjustments?: RubricAdjustment[];
  question_results?: QuestionResult[];
}

export interface ResultUpdateResponse {
  evaluation_id: number;
  student_id?: number;
  student_name?: string;
  roll_number?: string;
  final_marks: number;
  verified_by?: string;
  verified_at: string;
  rubric_adjustments?: RubricAdjustment[];
  question_results?: QuestionResult[];
}

// --- Tests ---
export interface TestCreateRequest {
  test_name: string;
  subject?: string;
  max_marks?: number;
  question?: string;
  answer_text?: string;
  questions?: QuestionItem[];
  rubric?: RubricCriterion[];
  student_ids?: number[];
  new_students?: StudentCreate[];
}

export interface TestUpdateRequest {
  test_name?: string;
  subject?: string;
  max_marks?: number;
  questions?: QuestionItem[];
  student_ids?: number[];
}

export interface TestStudentAssignRequest {
  student_ids?: number[];
  new_students?: StudentCreate[];
}

export interface TestStudentStatus {
  student_id: number;
  student_name: string;
  roll_number?: string;
  answer_sheet_id?: number;
  evaluation_id?: number;
  status: 'Pending Upload' | 'Uploaded' | 'Evaluated' | 'Verified' | string;
  similarity?: number;
  suggested_marks?: number;
  final_marks?: number;
  max_marks: number;
  verified_by?: string;
  verified_at?: string;
  uploaded_at?: string;
}

export interface TestResponse {
  id: number;
  test_name: string;
  teacher_id?: number;
  subject?: string;
  max_marks: number;
  created_at?: string;
  questions_count: number;
  students_count: number;
  model_answer_id?: number;
  students?: Student[];
  questions?: QuestionItem[];
}

export interface TestOverviewResponse {
  id: number;
  test_name: string;
  teacher_id?: number;
  subject?: string;
  max_marks: number;
  created_at?: string;
  model_answer_id?: number;
  questions_count: number;
  students_count: number;
  uploaded_count: number;
  evaluated_count: number;
  verified_count: number;
  students: TestStudentStatus[];
}

// --- Student Portal ---
export interface StudentResultCard {
  evaluation_id: number;
  answer_sheet_id: number;
  student_id: number;
  student_name: string;
  roll_number?: string;
  title?: string;
  subject?: string;
  question?: string;
  model_answer?: string;
  extracted_text?: string;
  file_path?: string;
  max_marks: number;
  similarity: number;
  suggested_marks: number;
  explanation?: string;
  final_marks?: number;
  teacher_feedback?: string;
  verified_by?: string;
  verified_at?: string;
  status: 'Verified' | 'Evaluated' | 'Uploaded' | string;
  uploaded_at?: string;
  rubric_scores?: RubricScore[];
  question_evaluations?: QuestionEvaluation[];
  question_results?: QuestionResult[];
}

export interface StudentPortalResponse {
  student_id: number;
  student_name: string;
  roll_number?: string;
  total_exams: number;
  verified_exams: number;
  average_score?: number;
  average_percentage?: number;
  results: StudentResultCard[];
}

// --- AI Explanation Chatbot ---
export interface ExplainMarksRequest {
  evaluation_id?: number | null;
  student_answer: string;
  model_answer?: string | null;
  question?: string | null;
  similarity: number;
  marks_obtained: number;
  max_marks: number;
  explanation?: string | null;
  user_question?: string | null;
  history?: Array<{ sender: string; text: string }>;
}

export interface ExplainMarksResponse {
  reply: string;
  is_ai_generated: boolean;
  source: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

// --- Workflow & Auth Context ---
export interface WorkflowData {
  answerSheetId: number | null;
  studentId: number | null;
  studentName: string;
  rollNumber: string;
  testId?: number | null;
  testName?: string;
  fileName: string;
  extractedText: string;
  modelAnswerId: number | null;
  question: string;
  modelAnswerText: string;
  maxMarks: number;
  examTitle?: string;
  examSubject?: string;
  questions?: QuestionItem[];
  rubric?: RubricCriterion[];
  evaluationId: number | null;
  similarity: number | null;
  suggestedMarks: number | null;
  explanation: string;
  finalMarks: number | null;
  teacherFeedback: string;
}

export interface AuthContextType {
  token: string | null;
  user: User | null;
  studentSession: StudentPortalResponse | null;
  setStudentSession: React.Dispatch<React.SetStateAction<StudentPortalResponse | null>>;
  isAuthenticated: boolean;
  isAdminAuthenticated: boolean;
  isTeacherAuthenticated: boolean;
  isStudentAuthenticated: boolean;
  login: (authToken: string, userData?: Partial<User>) => void;
  loginAsStudent: (portalData: StudentPortalResponse) => void;
  logout: () => void;
  workflowData: WorkflowData;
  updateWorkflow: (fields: Partial<WorkflowData>) => void;
}

// Convenience Type Aliases
export type StudentResponse = Student;
export type TestCreatePayload = TestCreateRequest;
export type RubricItem = RubricCriterion;
export type InlineStudentCreate = StudentCreate;
export type StudentPortalLookupResponse = StudentPortalResponse;
export type AdminEvaluationItem = AdminEvaluationResponse;
export type TeacherResponse = Teacher;
export type AdminResultItem = AdminResultResponse;
export type AdminStudentItem = AdminStudentResponse;
export type AdminTeacherCreatePayload = TeacherCreateRequest;
export type AdminTeacherUpdatePayload = TeacherUpdateRequest;

