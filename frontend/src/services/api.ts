import axios, { AxiosInstance } from 'axios';
import {
  User,
  TokenResponse,
  TeacherRegisterRequest,
  ResetPasswordResponse,
  AdminStatsResponse,
  Teacher,
  TeacherCreateRequest,
  TeacherUpdateRequest,
  AdminStudentResponse,
  AdminAnswerSheetResponse,
  AdminEvaluationResponse,
  AdminResultResponse,
  Student,
  StudentCreate,
  StudentDeleteResponse,
  StudentOverviewItem,
  StudentPortalResponse,
  ExplainMarksRequest,
  ExplainMarksResponse,
  UploadResponse,
  AnswerSheet,
  ExtractTextResponse,
  ModelAnswerCreate,
  ModelAnswerResponse,
  ModelAnswerListItem,
  EvaluateRequest,
  EvaluateResponse,
  BatchEvaluateRequest,
  BatchEvaluateResponse,
  ResultResponse,
  ResultUpdateRequest,
  ResultUpdateResponse,
  TestCreateRequest,
  TestUpdateRequest,
  TestStudentAssignRequest,
  TestResponse,
  TestOverviewResponse,
} from '../types';

const API_BASE_URL: string =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
    ? (import.meta.env.VITE_API_BASE_URL as string)
    : '';


const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Automatic token attachment interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('scriptsense_token');
    if (token && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const setAuthHeader = (token: string | null): void => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// 0. System & Health Check Endpoints
export const pingBackendApi = async (): Promise<{ app: string; status: string; docs: string }> => {
  const response = await apiClient.get('/');
  return response.data;
};

export const getSystemStorageStatusApi = async (token?: string | null): Promise<any> => {
  const response = await apiClient.get('/api/system/storage-status', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// 1. Auth Endpoints
export const loginApi = async (
  username: string,
  password: string,
  role?: string
): Promise<TokenResponse> => {
  const payload: { username: string; password: string; role?: string } = {
    username,
    password,
  };
  if (role) {
    payload.role = role;
  }
  const response = await apiClient.post<TokenResponse>('/api/login', payload);
  return response.data;
};

export const registerTeacherApi = async (
  teacherData: TeacherRegisterRequest
): Promise<TokenResponse> => {
  const response = await apiClient.post<TokenResponse>('/api/register', teacherData);
  return response.data;
};

export const resetPasswordApi = async (
  username: string,
  newPassword: string
): Promise<ResetPasswordResponse> => {
  const response = await apiClient.post<ResetPasswordResponse>('/api/reset-password', {
    username,
    new_password: newPassword,
  });
  return response.data;
};

export const getCurrentUserApi = async (token?: string | null): Promise<User> => {
  const response = await apiClient.get<User>('/api/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// ==========================================
// Admin APIs
// ==========================================
export const getAdminStatsApi = async (token?: string | null): Promise<AdminStatsResponse> => {
  const response = await apiClient.get<AdminStatsResponse>('/api/admin/stats', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getAdminTeachersApi = async (token?: string | null): Promise<Teacher[]> => {
  const response = await apiClient.get<Teacher[]>('/api/admin/teachers', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const createAdminTeacherApi = async (
  teacherData: TeacherCreateRequest,
  token?: string | null
): Promise<Teacher> => {
  const response = await apiClient.post<Teacher>('/api/admin/teachers', teacherData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const updateAdminTeacherApi = async (
  teacherId: number,
  teacherData: TeacherUpdateRequest,
  token?: string | null
): Promise<Teacher> => {
  const response = await apiClient.put<Teacher>(`/api/admin/teachers/${teacherId}`, teacherData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const deleteAdminTeacherApi = async (
  teacherId: number,
  token?: string | null
): Promise<{ message: string; success: boolean }> => {
  const response = await apiClient.delete<{ message: string; success: boolean }>(
    `/api/admin/teachers/${teacherId}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return response.data;
};

export const getAdminStudentsApi = async (
  teacherId?: number | null,
  token?: string | null
): Promise<AdminStudentResponse[]> => {
  const params = teacherId ? { teacher_id: teacherId } : {};
  const response = await apiClient.get<AdminStudentResponse[]>('/api/admin/students', {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getAdminAnswerSheetsApi = async (
  teacherId?: number | null,
  token?: string | null
): Promise<AdminAnswerSheetResponse[]> => {
  const params = teacherId ? { teacher_id: teacherId } : {};
  const response = await apiClient.get<AdminAnswerSheetResponse[]>('/api/admin/answer-sheets', {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getAdminEvaluationsApi = async (
  teacherId?: number | null,
  token?: string | null
): Promise<AdminEvaluationResponse[]> => {
  const params = teacherId ? { teacher_id: teacherId } : {};
  const response = await apiClient.get<AdminEvaluationResponse[]>('/api/admin/evaluations', {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getAdminResultsApi = async (
  teacherId?: number | null,
  token?: string | null
): Promise<AdminResultResponse[]> => {
  const params = teacherId ? { teacher_id: teacherId } : {};
  const response = await apiClient.get<AdminResultResponse[]>('/api/admin/results', {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// Student Portal Endpoints
export const studentPortalLookupApi = async (
  rollNumberOrId: string
): Promise<StudentPortalResponse> => {
  const response = await apiClient.post<StudentPortalResponse>('/api/student/portal-access', {
    roll_number_or_id: rollNumberOrId,
  });
  return response.data;
};

export const explainMarksApi = async (
  explainData: ExplainMarksRequest
): Promise<ExplainMarksResponse> => {
  const response = await apiClient.post<ExplainMarksResponse>('/api/explain-marks', explainData);
  return response.data;
};

// Answer Sheet Upload & OCR Transcript
export const uploadAnswerSheetApi = async (
  file: File,
  studentName?: string,
  rollNumber?: string,
  studentId?: number | null,
  token?: string | null,
  testId?: number | null
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  if (studentName) {
    formData.append('student_name', studentName);
  }
  if (rollNumber) {
    formData.append('roll_number', rollNumber);
  }
  if (studentId) {
    formData.append('student_id', studentId.toString());
  }
  if (testId) {
    formData.append('test_id', testId.toString());
  }

  const response = await apiClient.post<UploadResponse>('/api/upload', formData, {
    timeout: 60000,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return response.data;
};

export const updateTranscriptApi = async (
  sheetId: number,
  extractedText: string,
  token?: string | null
): Promise<UploadResponse> => {
  const response = await apiClient.put<UploadResponse>(
    `/api/uploads/${sheetId}/transcript`,
    { extracted_text: extractedText },
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return response.data;
};

// Students Management
export const getStudentsApi = async (token?: string | null): Promise<Student[]> => {
  const response = await apiClient.get<Student[]>('/api/students', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const createStudentApi = async (
  studentData: StudentCreate,
  token?: string | null
): Promise<Student> => {
  const response = await apiClient.post<Student>('/api/students', studentData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getStudentsOverviewApi = async (
  token?: string | null
): Promise<StudentOverviewItem[]> => {
  const response = await apiClient.get<StudentOverviewItem[]>('/api/students/overview', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getStudentResultsHistoryApi = async (
  studentId: number,
  token?: string | null
): Promise<ResultResponse[]> => {
  const response = await apiClient.get<ResultResponse[]>(`/api/students/${studentId}/results`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const deleteStudentApi = async (
  studentId: number,
  token?: string | null
): Promise<StudentDeleteResponse> => {
  const response = await apiClient.delete<StudentDeleteResponse>(`/api/students/${studentId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// Model Answer
export const createModelAnswerApi = async (
  modelData: ModelAnswerCreate | FormData,
  token?: string | null
): Promise<ModelAnswerResponse> => {
  const isFormData = typeof FormData !== 'undefined' && modelData instanceof FormData;
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isFormData ? { 'Content-Type': 'multipart/form-data' } : {}),
  };
  const response = await apiClient.post<ModelAnswerResponse>('/api/model-answer', modelData, {
    headers,
  });
  return response.data;
};

export const extractTextApi = async (
  file: File,
  token?: string | null
): Promise<ExtractTextResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<ExtractTextResponse>('/api/extract-text', formData, {
    timeout: 60000,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return response.data;
};

export const extractModelAnswerApi = extractTextApi;

export const getModelAnswersApi = async (
  token?: string | null
): Promise<ModelAnswerListItem[]> => {
  const response = await apiClient.get<ModelAnswerListItem[]>('/api/model-answers', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// Answer Sheets
export const getAnswerSheetsApi = async (token?: string | null): Promise<AnswerSheet[]> => {
  const response = await apiClient.get<AnswerSheet[]>('/api/answer-sheets', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// Evaluation
export const evaluateAnswerApi = async (
  evaluationData: EvaluateRequest,
  token?: string | null
): Promise<EvaluateResponse> => {
  const response = await apiClient.post<EvaluateResponse>('/api/evaluate', evaluationData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const batchEvaluateApi = async (
  batchData: BatchEvaluateRequest,
  token?: string | null
): Promise<BatchEvaluateResponse> => {
  const response = await apiClient.post<BatchEvaluateResponse>('/api/evaluate/batch', batchData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// Results
export const getResultApi = async (
  evaluationId: number,
  token?: string | null
): Promise<ResultResponse> => {
  const response = await apiClient.get<ResultResponse>(`/api/results/${evaluationId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const listAllResultsApi = async (token?: string | null): Promise<ResultResponse[]> => {
  const response = await apiClient.get<ResultResponse[]>('/api/results', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const exportResultsCsvApi = async (token?: string | null): Promise<Blob> => {
  const response = await apiClient.get('/api/results/export/csv', {
    responseType: 'blob',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const saveFinalResultApi = async (
  evaluationId: number,
  payload: ResultUpdateRequest,
  token?: string | null
): Promise<ResultUpdateResponse> => {
  const response = await apiClient.put<ResultUpdateResponse>(
    `/api/results/${evaluationId}`,
    payload,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return response.data;
};

// Test Management
export const createTestApi = async (
  testData: TestCreateRequest,
  token?: string | null
): Promise<TestResponse> => {
  const response = await apiClient.post<TestResponse>('/api/tests', testData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getTestsApi = async (token?: string | null): Promise<TestResponse[]> => {
  const response = await apiClient.get<TestResponse[]>('/api/tests', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getTestDetailsApi = async (
  testId: number,
  token?: string | null
): Promise<TestResponse> => {
  const response = await apiClient.get<TestResponse>(`/api/tests/${testId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getTestsOverviewApi = async (
  token?: string | null
): Promise<TestOverviewResponse[]> => {
  const response = await apiClient.get<TestOverviewResponse[]>('/api/tests/overview', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const assignStudentsToTestApi = async (
  testId: number,
  payload: TestStudentAssignRequest,
  token?: string | null
): Promise<TestResponse> => {
  const response = await apiClient.post<TestResponse>(`/api/tests/${testId}/students`, payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const evaluateAllTestSheetsApi = async (
  testId: number,
  token?: string | null
): Promise<BatchEvaluateResponse> => {
  const response = await apiClient.post<BatchEvaluateResponse>(
    `/api/tests/${testId}/evaluate-all`,
    {},
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return response.data;
};

export const deleteTestApi = async (
  testId: number,
  token?: string | null
): Promise<{ message: string; success: boolean }> => {
  const response = await apiClient.delete<{ message: string; success: boolean }>(
    `/api/tests/${testId}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return response.data;
};

export default apiClient;
