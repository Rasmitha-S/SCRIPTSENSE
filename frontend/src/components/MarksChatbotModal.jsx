import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  HelpCircle, 
  Loader2, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle,
  Lightbulb,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { explainMarksApi } from '../services/api';

export const MarksChatbotModal = ({ isOpen, onClose, examData }) => {
  const [messages, setMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [sourceBadge, setSourceBadge] = useState('template');
  const messagesEndRef = useRef(null);

  const finalScore = examData?.final_marks !== null && examData?.final_marks !== undefined
    ? examData.final_marks 
    : examData?.suggested_marks ?? 0.0;
  const maxMarks = examData?.max_marks || 10.0;
  const pct = Math.round((finalScore / maxMarks) * 100);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load initial automated explanation on modal open
  useEffect(() => {
    if (isOpen && examData) {
      setMessages([]);
      setInputQuestion('');
      loadInitialExplanation();
    }
  }, [isOpen, examData?.evaluation_id, examData?.answer_sheet_id]);

  const loadInitialExplanation = async () => {
    setLoading(true);
    try {
      const payload = {
        evaluation_id: examData.evaluation_id || null,
        student_answer: examData.extracted_text || '',
        model_answer: examData.model_answer || '',
        question: examData.title || examData.question || '',
        similarity: examData.similarity || 0.0,
        marks_obtained: finalScore,
        max_marks: maxMarks,
        explanation: examData.explanation || '',
        user_question: null,
      };

      const res = await explainMarksApi(payload);
      setSourceBadge(res.source || 'template');
      setMessages([
        {
          id: 'initial',
          sender: 'ai',
          text: res.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } catch (err) {
      console.warn("Could not load initial AI explanation:", err);
      // Fallback message using local data
      setMessages([
        {
          id: 'initial',
          sender: 'ai',
          text: `👋 Hello! You scored **${finalScore} / ${maxMarks} marks** (${pct}%) on this submission with a **${Math.round((examData.similarity || 0) * 100)}% semantic overlap** against the teacher's model answer.\n\n` +
                (examData.teacher_feedback ? `> 💬 **Teacher Feedback:** *"${examData.teacher_feedback}"*\n\n` : '') +
                (examData.explanation ? `📝 **AI Evaluation Note:** *${examData.explanation}*\n\n` : '') +
                `How can I help you understand your score better?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (customText = null) => {
    const questionText = typeof customText === 'string' ? customText : inputQuestion;
    if (!questionText.trim() || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: questionText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputQuestion('');
    setLoading(true);

    try {
      const historyPayload = newMessages.map((m) => ({
        sender: m.sender === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      const payload = {
        evaluation_id: examData.evaluation_id || null,
        student_answer: examData.extracted_text || '',
        model_answer: examData.model_answer || '',
        question: examData.title || examData.question || '',
        similarity: examData.similarity || 0.0,
        marks_obtained: finalScore,
        max_marks: maxMarks,
        explanation: examData.explanation || '',
        user_question: questionText.trim(),
        history: historyPayload,
      };

      const res = await explainMarksApi(payload);
      setSourceBadge(res.source || 'template');

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.warn("Chat query error:", err);
      const errMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `⚠️ I encountered a temporary connection issue. Your score on this paper is **${finalScore}/${maxMarks}** (${pct}%). Please try asking again in a moment!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    { label: "Why did I lose marks?", query: "Why did I lose marks on this answer?" },
    { label: "What key points did I miss?", query: "What key points did I miss compared to the model answer?" },
    { label: "How can I get full marks?", query: "How can I get full marks next time on this question?" },
    { label: "Explain the model solution", query: "Can you explain the teacher's reference model answer in simple terms?" },
  ];

  if (!isOpen || !examData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in print:hidden">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-violet-500 p-0.5 shadow-glow flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-brand-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white leading-tight">
                  Ask AI About Your Marks
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center space-x-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>{sourceBadge.includes('gemini') ? 'Gemini 1.5 Flash' : 'ScriptSense AI Tutor'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
                {examData.title || examData.question || 'Exam Submission'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
              <span className="text-slate-400">Score:</span>
              <span className="text-brand-300 font-bold">{finalScore}/{maxMarks}</span>
              <span className="text-slate-500">({pct}%)</span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-950/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-gradient-to-tr from-brand-600 to-violet-600 text-white'
              }`}>
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-emerald-600/90 text-white rounded-tr-none'
                  : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none shadow-md'
              }`}>
                <div className="whitespace-pre-wrap space-y-2">
                  {msg.text}
                </div>
                <div className={`text-[10px] mt-2 font-mono ${msg.sender === 'user' ? 'text-emerald-200/80 text-right' : 'text-slate-500 text-left'}`}>
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start space-x-3 animate-fade-in">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-violet-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none flex items-center space-x-2 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 text-brand-400 animate-spin" />
                <span>ScriptSense AI Tutor is analyzing your answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800/80 flex items-center space-x-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0 flex items-center space-x-1">
            <Lightbulb className="w-3 h-3 text-amber-400" />
            <span>Ask:</span>
          </span>
          {quickPrompts.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => handleSendMessage(chip.query)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700 transition-colors flex-shrink-0 disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder="Ask anything about your score or model answer..."
              disabled={loading}
              className="glass-input block w-full pl-4 pr-12 py-3 text-xs sm:text-sm rounded-xl text-slate-100 bg-slate-950 border-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={loading || !inputQuestion.trim()}
              className="absolute right-2 p-2 rounded-lg text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              title="Send message"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
