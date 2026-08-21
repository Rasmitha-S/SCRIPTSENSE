import axios from 'axios';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) 
  ? import.meta.env.VITE_API_BASE_URL 
  : 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Automatic token attachment interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('scriptsense_token');
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

export const setAuthHeader = (token) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// 0. System & Health Check Endpoints
export const pingBackendApi = async () => {
  const response = await apiClient.get('/');
  return response.data;
};

export const getSystemStorageStatusApi = async (token) => {
  const response = await apiClient.get('/api/system/storage-status', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};
export const loginApi = async (username, password, role) => {
  const payload = {
    username,
    password,
  };
  if (role) {
    payload.role = role;
  }
  const response = await apiClient.post('/api/login', payload);
  return response.data;
};

export const registerTeacherApi = async (teacherData) => {
  const response = await apiClient.post('/api/register', teacherData);
  return response.data;
};

export const resetPasswordApi = async (username, newPassword) => {
  const response = await apiClient.post('/api/reset-password', {
    username,
    new_password: newPassword,
  });
  return response.data;
};

export const getCurrentUserApi = async (token) => {
  const response = await apiClient.get('/api/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// ==========================================
// Admin APIs (Section 3 & 9)
// ==========================================
export const getAdminStatsApi = async (token) => {
  const response = await apiClient.get('/api/admin/stats', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getAdminTeachersApi = async (token) => {
  const response = await apiClient.get('/api/admin/teachers', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const createAdminTeacherApi = async (teacherData, token) => {
  const response = await apiClient.post('/api/admin/teachers', teacherData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const updateAdminTeacherApi = async (teacherId, teacherData, token) => {
  const response = await apiClient.put(`/api/admin/teachers/${teacherId}`, teacherData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const deleteAdminTeacherApi = async (teacherId, token) => {
  const response = await apiClient.delete(`/api/admin/teachers/${teacherId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getAdminStudentsApi = async (teacherId, token) => {
  const params = teacherId ? { teacher_id: teacherId } : {};
  const response = await apiClient.get('/api/admin/students', {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getAdminAnswerSheetsApi = async (teacherId, token) => {
  const params = teacherId ? { teacher_id: teacherId } : {};
  const response = await apiClient.get('/api/admin/answer-sheets', {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getAdminEvaluationsApi = async (teacherId, token) => {
  const params = teacherId ? { teacher_id: teacherId } : {};
  const response = await apiClient.get('/api/admin/evaluations', {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getAdminResultsApi = async (teacherId, token) => {
  const params = teacherId ? { teacher_id: teacherId } : {};
  const response = await apiClient.get('/api/admin/results', {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// 1.1 Student Portal Endpoint (POST /api/student/portal-access)
export const studentPortalLookupApi = async (rollNumberOrId) => {
  const response = await apiClient.post('/api/student/portal-access', {
    roll_number_or_id: rollNumberOrId,
  });
  return response.data;
};

// 1.2 Student Portal Marks Explainer AI Endpoint (POST /api/explain-marks)
export const explainMarksApi = async (explainData) => {
  const response = await apiClient.post('/api/explain-marks', explainData);
  return response.data;
};

// 2. Upload Answer Sheet Endpoint (POST /api/upload)
export const uploadAnswerSheetApi = async (file, studentName, rollNumber, studentId, token) => {
  const formData = new FormData();
  formData.append('file', file);
  if (studentName) {
    formData.append('student_name', studentName);
  }
  if (rollNumber) {
    formData.append('roll_number', rollNumber);
  }
  if (studentId) {
    formData.append('student_id', studentId);
  }

  const response = await apiClient.post('/api/upload', formData, {
    timeout: 60000,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return response.data;
};

// 2.1 Update OCR Transcript (PUT /api/uploads/{id}/transcript)
export const updateTranscriptApi = async (sheetId, extractedText, token) => {
  const response = await apiClient.put(
    `/api/uploads/${sheetId}/transcript`,
    { extracted_text: extractedText },
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return response.data;
};

// 2.2 Students Endpoints (GET & POST /api/students)
export const getStudentsApi = async (token) => {
  const response = await apiClient.get('/api/students', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const createStudentApi = async (studentData, token) => {
  const response = await apiClient.post('/api/students', studentData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getStudentsOverviewApi = async (token) => {
  const response = await apiClient.get('/api/students/overview', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const getStudentResultsHistoryApi = async (studentId, token) => {
  const response = await apiClient.get(`/api/students/${studentId}/results`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export const deleteStudentApi = async (studentId, token) => {
  const response = await apiClient.delete(`/api/students/${studentId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// 3. Model Answer Endpoint (POST /api/model-answer)
export const createModelAnswerApi = async (modelData, token) => {
  const isFormData = typeof FormData !== 'undefined' && modelData instanceof FormData;
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isFormData ? { 'Content-Type': 'multipart/form-data' } : {}),
  };
  const response = await apiClient.post('/api/model-answer', modelData, { headers });
  return response.data;
};

// 4. List Model Answers (GET /api/model-answers)
export const getModelAnswersApi = async (token) => {
  const response = await apiClient.get('/api/model-answers', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// 5. List Answer Sheets (GET /api/answer-sheets)
export const getAnswerSheetsApi = async (token) => {
  const response = await apiClient.get('/api/answer-sheets', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// 6. AI Evaluation Endpoint (POST /api/evaluate)
export const evaluateAnswerApi = async (evaluationData, token) => {
  const response = await apiClient.post('/api/evaluate', evaluationData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// 6.1 Batch Evaluation Endpoint (POST /api/evaluate/batch)
export const batchEvaluateApi = async (batchData, token) => {
  const response = await apiClient.post('/api/evaluate/batch', batchData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// 7. Get Result Endpoint (GET /api/results/{id})
export const getResultApi = async (evaluationId, token) => {
  const response = await apiClient.get(`/api/results/${evaluationId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// 8. List All Results (GET /api/results)
export const listAllResultsApi = async (token) => {
  const response = await apiClient.get('/api/results', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// 8.1 Export Class Results CSV (GET /api/results/export/csv)
export const exportResultsCsvApi = async (token) => {
  const response = await apiClient.get('/api/results/export/csv', {
    responseType: 'blob',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

// 9. Save Final Teacher Verified Result Endpoint (PUT /api/results/{id})
export const saveFinalResultApi = async (evaluationId, payload, token) => {
  const response = await apiClient.put(`/api/results/${evaluationId}`, payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

export default apiClient;
