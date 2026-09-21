import fs from 'fs';
import path from 'path';
import tesseract from 'tesseract.js';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import dotenv from 'dotenv';

dotenv.config();

// =====================================================================
// Context-Aware English & STEM Vocabulary for Safe Character Repair
// =====================================================================
export const VOCAB_LIST: string[] = [
  'are', 'answer', 'answers', 'answered', 'answering',
  'correct', 'correctly', 'correction', 'corrections',
  'protocol', 'protocols',
  'computer', 'computers', 'computing', 'computation',
  'server', 'servers',
  'network', 'networks', 'networking', 'networked',
  'error', 'errors',
  'transfer', 'transfers', 'transferred', 'transferring',
  'interconnected', 'interconnection', 'interconnections',
  'share', 'shares', 'shared', 'sharing',
  'other', 'others', 'otherwise',
  'packet', 'packets', 'layer', 'layers',
  'data', 'device', 'devices', 'communicate', 'communicates', 'communicated', 'communication',
  'connection', 'connections', 'oriented', 'reliable', 'unreliable', 'delivery', 'handshake',
  'transmission', 'transport', 'routing', 'router', 'routers',
  'hardware', 'software', 'firmware', 'driver', 'drivers',
  'memory', 'processor', 'processors', 'processing', 'process', 'processes',
  'register', 'registers', 'circuit', 'circuits', 'current', 'voltage', 'resistor', 'resistance',
  'force', 'forces', 'mass', 'acceleration', 'accelerate', 'accelerates', 'momentum',
  'gravity', 'gravitational', 'friction', 'frictionless', 'energy', 'power', 'work',
  'velocity', 'vector', 'scalar', 'newton', 'newtons', 'joule', 'joules', 'watt', 'watts',
  'proportional', 'inversely', 'directly', 'constant', 'rate', 'ratio', 'variable', 'variables',
  'structure', 'structures', 'structural', 'architecture', 'architectures',
  'operator', 'operators', 'operation', 'operations', 'operand', 'operands',
  'array', 'arrays', 'string', 'strings', 'character', 'characters', 'integer', 'integers',
  'pointer', 'pointers', 'address', 'addresses', 'reference', 'references',
  'function', 'functions', 'method', 'methods', 'parameter', 'parameters', 'argument', 'arguments',
  'return', 'returns', 'returned', 'returning', 'result', 'results', 'resulting',
  'query', 'queries', 'record', 'records', 'report', 'reports',
  'resource', 'resources', 'storage', 'thread', 'threads', 'virtual', 'barrier',
  'require', 'requires', 'required', 'requirement', 'requirements',
  'format', 'formats', 'formatted', 'formatting', 'standard', 'standards',
  'program', 'programs', 'programmed', 'programmer', 'programmers', 'programming',
  'property', 'properties', 'performance', 'perform', 'performs', 'performed',
  'reaction', 'reactions', 'cellular', 'respiration', 'chlorophyll', 'photosynthesis',
  'primary', 'secondary', 'tertiary', 'order', 'orders', 'ordered', 'ordering',
  'forward', 'reverse', 'internal', 'external', 'source', 'destination',
  'receiver', 'receivers', 'receive', 'receives', 'received', 'receiving',
  'sender', 'senders', 'send', 'sends', 'sending', 'sent',
  'client', 'clients', 'peer', 'peers', 'node', 'nodes', 'link', 'links',
  'medium', 'media', 'signal', 'signals', 'channel', 'channels',
  'bandwidth', 'frequency', 'throughput', 'latency', 'delay',
  'measure', 'measured', 'measurement', 'measurements', 'metric', 'metrics',
  'system', 'systems', 'state', 'states', 'status', 'table', 'tables',
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'done', 'will', 'would', 'shall', 'should', 'may', 'might', 'can', 'could', 'must',
  'it', 'its', 'they', 'them', 'their', 'theirs', 'this', 'that', 'these', 'those',
  'we', 'our', 'ours', 'us', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers',
  'and', 'or', 'but', 'nor', 'so', 'yet', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'what', 'which',
  'all', 'any', 'both', 'each', 'few', 'more', 'most', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'too', 'very',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'first', 'second', 'third',
  'box', 'boxes', 'fox', 'foxes', 'tax', 'taxes', 'six', 'sixes', 'mix', 'mixed', 'mixing',
  'fix', 'fixed', 'fixing', 'max', 'maximum', 'matrix', 'matrices', 'index', 'indexes', 'indices',
  'syntax', 'complex', 'complexity', 'prefix', 'suffix', 'pixel', 'pixels', 'proxy', 'proxies',
  'text', 'texts', 'next', 'context', 'convex', 'vertex', 'vertices', 'latex', 'unix', 'linux',
  'can', 'man', 'men', 'sun', 'run', 'ten', 'pen', 'son', 'pan', 'fan', 'van', 'tan', 'pin', 'bin',
  'give', 'gives', 'given', 'giving', 'have', 'live', 'save', 'wave', 'move', 'view', 'value'
];

export const COMMON_ENGLISH_WORDS = new Set(VOCAB_LIST.map(w => w.toLowerCase()));

function preserveCase(original: string, modified: string): string {
  if (original === original.toUpperCase()) return modified.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return modified.charAt(0).toUpperCase() + modified.slice(1);
  }
  return modified;
}

function generateRCandidates(word: string): string[] {
  const candidates: string[] = [];

  if (word.includes('iv')) {
    candidates.push(word.replace(/iv/g, 'w'));
    candidates.push(word.replace(/iv/g, 'r'));
  }
  if (word.includes('si')) {
    candidates.push(word.replace(/si/g, 'sw'));
  }
  if (word.includes('wv')) {
    candidates.push(word.replace(/wv/g, 'w'));
  }
  if (word.includes('nst')) {
    candidates.push(word.replace(/nst/g, 'nsf'));
  }

  const confusedIndices: number[] = [];
  for (let i = 0; i < word.length; i++) {
    if (['x', 'n', 'v', 'z', 'j'].includes(word[i])) {
      confusedIndices.push(i);
    }
  }

  for (const idx of confusedIndices) {
    const chars = word.split('');
    chars[idx] = 'r';
    candidates.push(chars.join(''));
  }

  if (word.length >= 3) {
    for (let i = 0; i <= word.length; i++) {
      candidates.push(word.slice(0, i) + 'r' + word.slice(i));
    }
  }

  return candidates;
}

function splitJoinedWords(word: string): string[] {
  const lower = word.toLowerCase();
  if (COMMON_ENGLISH_WORDS.has(lower)) {
    return [word];
  }
  for (let i = 3; i < lower.length - 2; i++) {
    const w1 = lower.slice(0, i);
    const w2 = lower.slice(i);
    if (COMMON_ENGLISH_WORDS.has(w1)) {
      if (COMMON_ENGLISH_WORDS.has(w2)) {
        return [word.slice(0, i), word.slice(i)];
      }
      const cands2 = generateRCandidates(w2);
      for (const c2 of cands2) {
        if (COMMON_ENGLISH_WORDS.has(c2)) {
          return [word.slice(0, i), preserveCase(word.slice(i), c2)];
        }
      }
    }
  }
  return [word];
}

export function repairRConfusionsInWord(rawWord: string): string {
  const match = rawWord.match(/^([^a-zA-Z0-9]*)([a-zA-Z0-9_-]+)([^a-zA-Z0-9]*)$/);
  if (!match) return rawWord;

  const [, prefix, core, suffix] = match;

  if (core.includes('_') && core.length > 2) {
    const parts = core.split('_');
    const repaired = parts.map(p => repairRConfusionsInWord(p));
    return prefix + repaired.join(' ') + suffix;
  }

  const lowerCore = core.toLowerCase();
  if (COMMON_ENGLISH_WORDS.has(lowerCore)) {
    return rawWord;
  }

  const candidates = generateRCandidates(lowerCore);
  for (const cand of candidates) {
    if (COMMON_ENGLISH_WORDS.has(cand) && cand !== lowerCore) {
      return prefix + preserveCase(core, cand) + suffix;
    }
  }

  const splits = splitJoinedWords(core);
  if (splits.length > 1) {
    const repairedSplits = splits.map(s => repairRConfusionsInWord(s));
    return prefix + repairedSplits.join(' ') + suffix;
  }

  return rawWord;
}

export function repairOcrText(text: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .map(line => {
      const tokens = line.split(/\s+/);
      return tokens.map(t => repairRConfusionsInWord(t)).join(' ');
    })
    .join('\n');
}

export function cleanOcrText(text: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

// =====================================================================
// OCR Engines
// =====================================================================

function getGeminiApiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

export function isValidGeminiKey(): boolean {
  const key = getGeminiApiKey();
  return Boolean(key && key.length > 10 && !key.startsWith('your_') && !key.includes('...'));
}

export async function extractTextWithGeminiVision(imageBuffer: Buffer, mimeType: string = 'image/png'): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!isValidGeminiKey()) return '';

  try {
    const base64Image = imageBuffer.toString('base64');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [
        {
          parts: [
            { text: 'Extract all handwritten and printed text from this image accurately. Return only the extracted text without introductory or conversational filler.' },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim()) {
        return text.trim();
      }
    }
  } catch (err) {
    console.info('[OCR NOTICE] Gemini Vision notice:', err);
  }
  return '';
}

export async function extractTextWithTesseract(imageBuffer: Buffer): Promise<string> {
  try {
    const result = await tesseract.recognize(imageBuffer, 'eng');
    const text = result?.data?.text || '';
    const cleaned = cleanOcrText(text);
    return repairOcrText(cleaned);
  } catch (err) {
    console.warn('[OCR NOTICE] Tesseract.js error:', err);
    return '';
  }
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string = 'document'
): Promise<string> {
  const ext = path.extname(filename).toLowerCase();

  // 1. Handle DOCX / DOC
  if (ext === '.docx' || ext === '.doc') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      if (text) return text;
      return 'No text content found in the Word document.';
    } catch (err) {
      console.error('[OCR] Mammoth extraction error:', err);
      return `Failed to extract text from Word document: ${err}`;
    }
  }

  // 2. Handle PDF
  if (ext === '.pdf') {
    try {
      const data = await pdfParse(buffer);
      const text = data.text.trim();
      if (text) {
        return cleanOcrText(text);
      }
    } catch (err) {
      console.warn('[OCR] PDF text parse notice:', err);
    }
  }

  // 3. Handle Image / Scanned Content
  // Primary Engine: Gemini Vision
  if (isValidGeminiKey()) {
    try {
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      const geminiText = await extractTextWithGeminiVision(buffer, mimeType);
      if (geminiText && geminiText.trim()) {
        console.log(`[OCR SUCCESS] Engine: Gemini Vision | File: ${filename} | Characters: ${geminiText.length}`);
        return geminiText;
      }
    } catch (err) {
      console.info('[OCR NOTICE] Gemini Vision skipped, falling back to local OCR.');
    }
  }

  // Fallback Engine: Tesseract.js
  try {
    const tessText = await extractTextWithTesseract(buffer);
    if (tessText && tessText.trim()) {
      console.log(`[OCR SUCCESS] Engine: Tesseract.js | File: ${filename} | Characters: ${tessText.length}`);
      return tessText;
    }
  } catch (err) {
    console.warn('[OCR] Local Tesseract fallback error:', err);
  }

  return 'Text extraction failed. Please try a clearer image or enter the answer manually.';
}

export async function extractTextFromFile(absoluteFilePath: string): Promise<string> {
  if (!fs.existsSync(absoluteFilePath)) {
    return 'Text extraction failed. Please try a clearer image or enter the answer manually.';
  }
  const buffer = fs.readFileSync(absoluteFilePath);
  const filename = path.basename(absoluteFilePath);
  return extractTextFromBuffer(buffer, filename);
}
