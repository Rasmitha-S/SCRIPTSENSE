import { app } from '../src/app.js';
import { db } from '../src/database/index.js';
import http from 'http';

let server: http.Server;
const PORT = 8001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function request(path: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
  const method = options.method || 'GET';
  const headers: Record<string, string> = { ...options.headers };
  let body: any = undefined;

  if (options.body) {
    if (typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    } else {
      body = options.body;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    data
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('  Running ScriptSense TypeScript Backend Test Suite');
  console.log('======================================================\n');

  // Start in-memory test server
  await new Promise<void>((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });

  try {
    // 1. Health check
    console.log('[TEST 1] Root health check');
    const rootRes = await request('/');
    assert(rootRes.status === 200, 'Root endpoint returns 200');
    assert(rootRes.data.app === 'ScriptSense Backend', 'App name matches');
    assert(rootRes.data.status === 'online', 'Status is online');

    // 2. Admin login
    console.log('\n[TEST 2] Admin authentication');
    const adminLogin = await request('/api/login', {
      method: 'POST',
      body: { username: 'admin', password: 'admin123', role: 'admin' }
    });
    assert(adminLogin.status === 200, 'Admin login succeeded with 200');
    assert(adminLogin.data.role === 'admin', 'Admin role returned');
    assert(Boolean(adminLogin.data.access_token), 'Access token present');
    const adminToken = adminLogin.data.access_token;

    // 3. Teacher1 login
    console.log('\n[TEST 3] Teacher authentication');
    const teacherLogin = await request('/api/login', {
      method: 'POST',
      body: { username: 'teacher1', password: 'secret123', role: 'teacher' }
    });
    assert(teacherLogin.status === 200, 'Teacher1 login succeeded with 200');
    assert(teacherLogin.data.role === 'teacher', 'Teacher role returned');
    const teacherToken = teacherLogin.data.access_token;

    // 4. Teacher registration
    console.log('\n[TEST 4] New Teacher registration');
    const testTeacherUser = `test_teacher_${Date.now()}`;
    const registerRes = await request('/api/register', {
      method: 'POST',
      body: {
        username: testTeacherUser,
        email: `${testTeacherUser}@test.com`,
        password: 'password123',
        full_name: 'Test Instructor'
      }
    });
    assert(registerRes.status === 201, 'Registration returns 201 Created');
    assert(registerRes.data.username === testTeacherUser, 'New teacher username verified');
    const newTeacherToken = registerRes.data.access_token;

    // 5. Password reset
    console.log('\n[TEST 5] Teacher password reset');
    const resetRes = await request('/api/reset-password', {
      method: 'POST',
      body: {
        username: testTeacherUser,
        new_password: 'new_secret_password'
      }
    });
    assert(resetRes.status === 200, 'Password reset succeeded');
    // Verify login with new password
    const newLogin = await request('/api/login', {
      method: 'POST',
      body: { username: testTeacherUser, password: 'new_secret_password' }
    });
    assert(newLogin.status === 200, 'Login with new password succeeded');

    // 6. Teacher student isolation test
    console.log('\n[TEST 6] Teacher-student data isolation');
    const s1Res = await request('/api/students', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: { name: 'Alice Walker', roll_number: `R_ALICE_${Date.now()}` }
    });
    assert(s1Res.status === 201, "Teacher1 created student Alice");
    const aliceId = s1Res.data.id;

    const s2Res = await request('/api/students', {
      method: 'POST',
      headers: { Authorization: `Bearer ${newTeacherToken}` },
      body: { name: 'Bob Smith', roll_number: `R_BOB_${Date.now()}` }
    });
    assert(s2Res.status === 201, "New Teacher created student Bob");
    const bobId = s2Res.data.id;

    // Teacher1 listing should only see Teacher1's students
    const t1Students = await request('/api/students', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    assert(t1Students.data.some((s: any) => s.id === aliceId), "Teacher1 sees Alice");
    assert(!t1Students.data.some((s: any) => s.id === bobId), "Teacher1 DOES NOT see Bob (Isolation verified)");

    // Teacher1 cannot delete or edit Bob
    const forbiddenEdit = await request(`/api/students/${bobId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: { name: 'Hacked Bob' }
    });
    assert(forbiddenEdit.status === 403, "Cross-teacher edit blocked with 403");

    // 7. Student Management CRUD
    console.log('\n[TEST 7] Student Management CRUD');
    const studentOverview = await request('/api/students/overview', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    assert(studentOverview.status === 200, 'Students overview retrieved');
    assert(Array.isArray(studentOverview.data), 'Overview is an array');

    const updateAlice = await request(`/api/students/${aliceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: { name: 'Alice Walker (Honor Student)', roll_number: s1Res.data.roll_number }
    });
    assert(updateAlice.status === 200, 'Student updated successfully');
    assert(updateAlice.data.name === 'Alice Walker (Honor Student)', 'Updated name matches');

    // 8. Test Creation with Multi-Question Model Answers and Rubrics
    console.log('\n[TEST 8] Test creation with multi-question model answers & rubrics');
    const createTestRes = await request('/api/tests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: {
        test_name: 'Computer Networks Midterm',
        subject: 'Computer Science',
        max_marks: 10.0,
        student_ids: [aliceId],
        questions: [
          {
            q_num: 1,
            question: 'Explain the function of a router in a computer network.',
            model_answer: 'A router is a network device that forwards data packets between computer networks. It analyzes destination IP addresses and routes traffic along optimal network paths.',
            max_marks: 5.0,
            rubric: [
              { criterion: 'Definition and function of forwarding packets', max_marks: 3.0, keywords: ['router', 'forwards', 'packets', 'networks'] },
              { criterion: 'IP routing and path determination', max_marks: 2.0, keywords: ['ip', 'addresses', 'destination', 'paths'] }
            ]
          },
          {
            q_num: 2,
            question: 'What is the purpose of the TCP three-way handshake?',
            model_answer: 'The TCP three-way handshake establishes a reliable, connection-oriented session between client and server using SYN, SYN-ACK, and ACK packets before data transmission.',
            max_marks: 5.0,
            rubric: [
              { criterion: 'Reliable connection establishment', max_marks: 2.5, keywords: ['tcp', 'connection', 'reliable', 'session'] },
              { criterion: 'Handshake steps (SYN, SYN-ACK, ACK)', max_marks: 2.5, keywords: ['syn', 'ack', 'client', 'server'] }
            ]
          }
        ]
      }
    });
    assert(createTestRes.status === 201, 'Test created with 201');
    assert(createTestRes.data.test_name === 'Computer Networks Midterm', 'Test name matches');
    assert(createTestRes.data.questions_count === 2, 'Two questions recorded');
    assert(createTestRes.data.students_count === 1, 'Alice enrolled in test');
    const testId = createTestRes.data.id;
    const modelAnswerId = createTestRes.data.model_answer_id;

    // 9. Tests Overview
    console.log('\n[TEST 9] Tests Overview endpoint');
    const testsOverview = await request('/api/tests/overview', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    assert(testsOverview.status === 200, 'Tests overview returns 200');
    const currentTestOverview = testsOverview.data.find((t: any) => t.id === testId);
    assert(Boolean(currentTestOverview), 'Created test exists in overview');
    assert(currentTestOverview.students.length === 1, 'Student status present in test overview');
    assert(currentTestOverview.students[0].status === 'Pending Upload', 'Status is Pending Upload');

    // 10. Direct Answer Sheet & OCR Transcript Test
    console.log('\n[TEST 10] Upload answer sheet & OCR transcript editing');
    // Directly insert an answer sheet record to test evaluation pipeline
    const studentAnswerText = `
Q1: A router is a network device that forwards data packets between computer networks. It checks destination IP addresses to route traffic along the best path.

Q2: The TCP three-way handshake establishes a reliable connection-oriented session between client and server using SYN, SYN-ACK, and ACK flags before transmitting data.
    `.trim();

    const insertSheet = db.prepare(`
      INSERT INTO answer_sheets (student_id, teacher_id, test_id, student_name, file_path, extracted_text, uploaded_by, uploaded_at)
      VALUES (?, ?, ?, 'Alice Walker', 'uploads/test_alice_sheet.png', ?, 'Dr. Sarah Smith', datetime('now'))
    `).run(aliceId, teacherLogin.data.user_id, testId, studentAnswerText);

    const sheetId = Number(insertSheet.lastInsertRowid);
    assert(sheetId > 0, 'Answer sheet created successfully');

    // Test transcript update
    const transcriptUpdate = await request(`/api/uploads/${sheetId}/transcript`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: { extracted_text: studentAnswerText + '\n[Teacher reviewed OCR note]' }
    });
    assert(transcriptUpdate.status === 200, 'Transcript edit saved');
    assert(transcriptUpdate.data.extracted_text.includes('[Teacher reviewed OCR note]'), 'Updated transcript verified');

    // 11. AI Semantic Evaluation
    console.log('\n[TEST 11] AI Semantic Evaluation');
    const evalRes = await request('/api/evaluate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: {
        answer_sheet_id: sheetId,
        test_id: testId
      }
    });
    assert(evalRes.status === 200, 'Evaluation returns 200');
    assert(evalRes.data.similarity > 0.7, `High similarity scored (${evalRes.data.similarity})`);
    assert(evalRes.data.suggested_marks >= 7.0, `Suggested marks allocated (${evalRes.data.suggested_marks}/10)`);
    assert(evalRes.data.question_evaluations?.length === 2, 'Evaluations returned for both questions');
    const evalId = evalRes.data.evaluation_id;

    // 12. Batch Evaluation
    console.log('\n[TEST 12] Batch Evaluation for Test');
    const batchEvalRes = await request(`/api/tests/${testId}/evaluate-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    assert(batchEvalRes.status === 200, 'Batch evaluation succeeded');
    assert(batchEvalRes.data.processed_count >= 1, 'Evaluated all test sheets in one click');

    // 13. Teacher Results Verification & Feedback
    console.log('\n[TEST 13] Teacher Final Result Verification');
    const verifyRes = await request(`/api/results/${evalId}/verify`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: {
        final_marks: 9.5,
        teacher_feedback: 'Excellent technical answers and accurate protocol terminology!',
        question_results: [
          { q_num: 1, final_marks: 5.0, teacher_comment: 'Perfect definition and routing explanation.' },
          { q_num: 2, final_marks: 4.5, teacher_comment: 'Clear 3-way handshake description.' }
        ]
      }
    });
    assert(verifyRes.status === 200, 'Verification saved with 200');
    assert(verifyRes.data.final_marks === 9.5, 'Final marks 9.5 saved');
    assert(Boolean(verifyRes.data.verified_by), 'Verified by recorded');

    // 14. Results CSV Export
    console.log('\n[TEST 14] Results CSV Export');
    const csvRes = await request('/api/results/export/csv', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    assert(csvRes.status === 200, 'CSV export returned 200');
    assert(csvRes.data.includes('Evaluation ID') && csvRes.data.includes('Alice Walker'), 'CSV contains correct header and student record');

    // 15. Student Portal Access
    console.log('\n[TEST 15] Student Portal Access');
    const portalRes = await request('/api/student/portal-access', {
      method: 'POST',
      body: { roll_number_or_id: s1Res.data.roll_number }
    });
    assert(portalRes.status === 200, 'Student portal lookup succeeded with 200');
    assert(portalRes.data.student_name.includes('Alice Walker'), 'Student name verified in portal');
    assert(portalRes.data.results.length >= 1, 'Student result cards returned');
    assert(portalRes.data.results[0].status === 'Verified', 'Result status is Verified');
    assert(portalRes.data.results[0].final_marks === 9.5, 'Student sees verified 9.5 marks');

    // 16. Marks Explainer Chatbot
    console.log('\n[TEST 16] Marks Explainer Chatbot endpoint');
    const chatRes = await request('/api/explain-marks', {
      method: 'POST',
      body: {
        evaluation_id: evalId,
        user_question: 'How can I score full marks next time?'
      }
    });
    assert(chatRes.status === 200, 'Chatbot explanation returned 200');
    assert(Boolean(chatRes.data.reply && chatRes.data.reply.length > 20), 'Grounded explanation reply generated');

    // 17. Admin Overview & Stats
    console.log('\n[TEST 17] Admin Dashboard & Platform Controls');
    const adminStats = await request('/api/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminStats.status === 200, 'Admin stats returned 200');
    assert(adminStats.data.total_teachers >= 2, 'Admin stats shows teachers');
    assert(adminStats.data.total_students >= 2, 'Admin stats shows students');

    const adminTeachers = await request('/api/admin/teachers', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminTeachers.status === 200, 'Admin teachers list retrieved');
    assert(adminTeachers.data.length >= 2, 'All teachers listed');

    const adminResults = await request('/api/admin/results', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminResults.status === 200, 'Admin global results retrieved');
    assert(adminResults.data.length >= 1, 'Global results list contains verified records');

    // 18. System Storage Status
    console.log('\n[TEST 18] System & Storage Status');
    const storageRes = await request('/api/system/storage-status', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    assert(storageRes.status === 200, 'Storage status returns 200');
    assert(storageRes.data.status === 'Online & Healthy', 'System status is healthy');
    assert(storageRes.data.database.engine === 'SQLite Relational Storage', 'Database engine confirmed');

    console.log('\n======================================================');
    console.log('  🎉 ALL 18 INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

runAllTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  if (server) server.close();
  process.exit(1);
});
