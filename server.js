const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// WebSocket connection management
const wsConnections = new Map();

// WebSocket audio streaming handler
wss.on('connection', (ws, req) => {
  const sessionId = `ws_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`WebSocket connection established: ${sessionId}`);
  
  // Store connection with session ID
  wsConnections.set(sessionId, ws);
  
  // Create audio file stream for this session
  const audioFilePath = path.join('uploads', `streaming_audio_${sessionId}.webm`);
  const audioWriteStream = fs.createWriteStream(audioFilePath);
  
  console.log(`Audio file created: ${audioFilePath}`);
  
  // Send session ID to client
  ws.send(JSON.stringify({
    type: 'session_established',
    sessionId: sessionId,
    message: 'WebSocket connection established for audio streaming'
  }));
  
  // Handle incoming audio data
  ws.on('message', (data) => {
    try {
      // Check if data is binary (audio chunks)
      if (data instanceof Buffer) {
        console.log(`Received audio chunk: ${data.length} bytes for session ${sessionId}`);
        
        // Write audio chunk to file
        audioWriteStream.write(data);
        
        // Send acknowledgment
        ws.send(JSON.stringify({
          type: 'audio_received',
          chunkSize: data.length,
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        }));
      } else {
        // Handle text messages (control messages)
        const message = JSON.parse(data.toString());
        console.log(`Received control message:`, message);
        
        if (message.type === 'recording_started') {
          console.log(`Recording started for session ${sessionId}`);
          ws.send(JSON.stringify({
            type: 'recording_confirmed',
            sessionId: sessionId,
            message: 'Recording confirmed, ready to receive audio'
          }));
        } else if (message.type === 'recording_stopped') {
          console.log(`Recording stopped for session ${sessionId}`);
          
          // Close the audio file stream
          audioWriteStream.end();
          
          ws.send(JSON.stringify({
            type: 'recording_saved',
            sessionId: sessionId,
            filePath: audioFilePath,
            message: 'Audio recording saved successfully'
          }));
        }
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to process audio data',
        details: error.message
      }));
    }
  });
  
  // Handle connection close
  ws.on('close', () => {
    console.log(`WebSocket connection closed: ${sessionId}`);
    
    // Clean up resources
    audioWriteStream.end();
    wsConnections.delete(sessionId);
    
    // Remove the audio file if it's empty or very small
    try {
      const stats = fs.statSync(audioFilePath);
      if (stats.size < 1024) { // Less than 1KB
        fs.unlinkSync(audioFilePath);
        console.log(`Removed empty audio file: ${audioFilePath}`);
      }
    } catch (error) {
      console.log(`Could not remove audio file: ${error.message}`);
    }
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for session ${sessionId}:`, error);
    audioWriteStream.end();
    wsConnections.delete(sessionId);
  });
});

const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory chat history storage
const chatHistory = new Map();

// Error handling utilities
class VoiceAgentError extends Error {
  constructor(message, type, statusCode = 500) {
    super(message);
    this.name = 'VoiceAgentError';
    this.type = type;
    this.statusCode = statusCode;
  }
}

// Validate API configuration
function validateAPIConfig() {
  const errors = [];
  
  if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY.trim() === '') {
    errors.push('GEMINI_API_KEY is not configured');
  }
  
  if (!config.ASSEMBLY_API_KEY || config.ASSEMBLY_API_KEY.trim() === '') {
    errors.push('ASSEMBLY_API_KEY is not configured');
  }
  
  return errors;
}

// Generate fallback audio response
function generateFallbackAudioResponse(message) {
  const fallbackText = `I'm having trouble connecting right now. ${message}`;
  return Buffer.from(fallbackText);
}

// Gemini AI response generation function with enhanced error handling
async function generateGeminiResponse(transcript, conversationHistory = []) {
  try {
    // Validate API key
    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY.trim() === '') {
      throw new VoiceAgentError('Gemini API key not configured', 'CONFIG_ERROR', 500);
    }

    console.log('Generating Gemini response for transcript:', transcript);
    console.log('Conversation history length:', conversationHistory.length);
    
    // Validate input
    if (!transcript || typeof transcript !== 'string' || transcript.trim() === '') {
      throw new VoiceAgentError('Invalid transcript provided', 'VALIDATION_ERROR', 400);
    }
    
    // Build the conversation context
    let conversationContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = 'Previous conversation:\n';
      conversationHistory.forEach((msg, index) => {
        if (msg && msg.role && msg.content) {
          conversationContext += `${msg.role}: ${msg.content}\n`;
        }
      });
      conversationContext += '\n';
    }
    
    const prompt = `You are a helpful AI voice assistant. ${conversationContext}The user said: "${transcript}". Please provide a natural, conversational response. Keep it concise (1-2 sentences) and friendly.`;
    
    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${config.GEMINI_API_KEY}`, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      throw new VoiceAgentError('Invalid response from Gemini API', 'API_ERROR', 500);
    }

    const geminiResponse = response.data.candidates[0].content.parts[0].text;
    console.log('Gemini Response:', geminiResponse);
    return geminiResponse;
  } catch (error) {
    console.error('Gemini API error:', error.response?.status, error.response?.data);
    
    // Handle specific error types
    if (error instanceof VoiceAgentError) {
      throw error;
    }
    
    if (error.code === 'ECONNABORTED') {
      throw new VoiceAgentError('Gemini API request timed out', 'TIMEOUT_ERROR', 408);
    }
    
    if (error.response?.status === 401) {
      throw new VoiceAgentError('Invalid Gemini API key', 'AUTH_ERROR', 401);
    }
    
    if (error.response?.status === 429) {
      throw new VoiceAgentError('Gemini API rate limit exceeded', 'RATE_LIMIT_ERROR', 429);
    }
    
    if (error.response?.status >= 500) {
      throw new VoiceAgentError('Gemini API server error', 'API_ERROR', 502);
    }
    
    // Fallback to rule-based responses
    console.log('Using fallback responses due to Gemini API error');
    const responses = {
      'hello': 'Hello! How can I help you today?',
      'how are you': 'I\'m doing well, thank you for asking! How can I assist you?',
      'what is your name': 'I\'m your AI voice assistant. Nice to meet you!',
      'thank you': 'You\'re welcome! Is there anything else I can help you with?',
      'goodbye': 'Goodbye! Have a great day!',
      'help': 'I can help you with various tasks. Just ask me anything!',
      'time': `The current time is ${new Date().toLocaleTimeString()}.`,
      'date': `Today is ${new Date().toLocaleDateString()}.`,
      'weather': 'I\'m sorry, I don\'t have access to weather information right now.',
      'joke': 'Why don\'t scientists trust atoms? Because they make up everything! 😄',
      'error': 'I\'m having trouble connecting right now. Please try again later.',
      'connection': 'I\'m experiencing connection issues. Let me try to help you with a basic response.'
    };

    const lowerTranscript = transcript.toLowerCase();
    
    // Check for matching keywords
    for (const [keyword, response] of Object.entries(responses)) {
      if (lowerTranscript.includes(keyword)) {
        return response;
      }
    }

    // Default fallback response
    return `I heard you say: "${transcript}". I'm currently experiencing some technical difficulties, but I'm here to help!`;
  }
}

// Assembly AI transcription function with enhanced error handling
async function transcribeAudio(audioBuffer) {
  try {
    // Validate API key
    if (!config.ASSEMBLY_API_KEY || config.ASSEMBLY_API_KEY.trim() === '') {
      throw new VoiceAgentError('Assembly AI API key not configured', 'CONFIG_ERROR', 500);
    }

    // Validate audio buffer
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      throw new VoiceAgentError('Invalid audio buffer provided', 'VALIDATION_ERROR', 400);
    }

    console.log('Starting transcription with Assembly AI...');
    console.log('Audio buffer size:', audioBuffer.length, 'bytes');
    
    // First, upload the audio to Assembly AI
    const uploadResponse = await axios.post('https://api.assemblyai.com/v2/upload', audioBuffer, {
      headers: {
        'Authorization': config.ASSEMBLY_API_KEY,
        'Content-Type': 'application/octet-stream'
      },
      timeout: 15000 // 15 second timeout
    });

    if (!uploadResponse.data || !uploadResponse.data.upload_url) {
      throw new VoiceAgentError('Failed to upload audio to Assembly AI', 'API_ERROR', 500);
    }

    console.log('Audio uploaded successfully');
    const uploadUrl = uploadResponse.data.upload_url;

    // Start transcription
    const transcriptResponse = await axios.post('https://api.assemblyai.com/v2/transcript', {
      audio_url: uploadUrl,
      language_code: 'en'
    }, {
      headers: {
        'Authorization': config.ASSEMBLY_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (!transcriptResponse.data || !transcriptResponse.data.id) {
      throw new VoiceAgentError('Failed to start transcription', 'API_ERROR', 500);
    }

    const transcriptId = transcriptResponse.data.id;
    console.log('Transcription started, ID:', transcriptId);

    // Poll for completion
    let transcript = null;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    
    while (!transcript && attempts < maxAttempts) {
      const pollResponse = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': config.ASSEMBLY_API_KEY
        },
        timeout: 5000
      });

      console.log('Transcription status:', pollResponse.data.status);

      if (pollResponse.data.status === 'completed') {
        transcript = pollResponse.data.text;
        console.log('Transcription completed:', transcript);
      } else if (pollResponse.data.status === 'error') {
        throw new VoiceAgentError('Transcription failed: ' + (pollResponse.data.error || 'Unknown error'), 'API_ERROR', 500);
      } else {
        // Wait 1 second before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }

    if (!transcript) {
      throw new VoiceAgentError('Transcription timeout', 'TIMEOUT_ERROR', 408);
    }

    return transcript;
  } catch (error) {
    console.error('Transcription error:', error.response?.status, error.response?.data);
    
    // Handle specific error types
    if (error instanceof VoiceAgentError) {
      throw error;
    }
    
    if (error.code === 'ECONNABORTED') {
      throw new VoiceAgentError('Transcription request timed out', 'TIMEOUT_ERROR', 408);
    }
    
    if (error.response?.status === 401) {
      throw new VoiceAgentError('Invalid Assembly AI API key', 'AUTH_ERROR', 401);
    }
    
    if (error.response?.status === 429) {
      throw new VoiceAgentError('Assembly AI rate limit exceeded', 'RATE_LIMIT_ERROR', 429);
    }
    
    if (error.response?.status >= 500) {
      throw new VoiceAgentError('Assembly AI server error', 'API_ERROR', 502);
    }
    
    // Fallback: return a simple transcript for testing
    console.log('Using fallback transcript due to Assembly AI error');
    return 'Hello, this is a test message from fallback transcription';
  }
}

// LLM response generation function (now using Gemini)
async function generateLLMResponse(transcript, conversationHistory = []) {
  return await generateGeminiResponse(transcript, conversationHistory);
}

// Text-to-speech function using browser's built-in speech synthesis
async function generateSpeech(text) {
  try {
    // Validate input
    if (!text || typeof text !== 'string' || text.trim() === '') {
      throw new VoiceAgentError('Invalid text provided for speech generation', 'VALIDATION_ERROR', 400);
    }

    console.log('Generating speech for text:', text);
    
    // For now, we'll return the text response since we don't have a TTS service
    // In a real implementation, you could use:
    // - Web Speech API (client-side)
    // - Google Cloud Text-to-Speech
    // - Amazon Polly
    // - Azure Speech Services
    
    console.log('Using text response (no TTS service configured)');
    return Buffer.from('AI Response: ' + text);
  } catch (error) {
    console.error('Speech generation error:', error);
    
    if (error instanceof VoiceAgentError) {
      throw error;
    }
    
    // Fallback response
    return Buffer.from('Error generating speech. Here is the text response: ' + text);
  }
}

// Get or create chat history for a session
function getChatHistory(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new VoiceAgentError('Invalid session ID', 'VALIDATION_ERROR', 400);
  }
  
  if (!chatHistory.has(sessionId)) {
    chatHistory.set(sessionId, []);
  }
  return chatHistory.get(sessionId);
}

// Add message to chat history
function addToChatHistory(sessionId, role, content) {
  try {
    if (!sessionId || !role || !content) {
      throw new VoiceAgentError('Invalid parameters for chat history', 'VALIDATION_ERROR', 400);
    }
    
    const history = getChatHistory(sessionId);
    history.push({
      role: role,
      content: content,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 20 messages to prevent memory issues
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
    
    console.log(`Added ${role} message to session ${sessionId}. History length: ${history.length}`);
  } catch (error) {
    console.error('Error adding to chat history:', error);
    // Don't throw here as this shouldn't break the main flow
  }
}

// Chat endpoint with session management and comprehensive error handling
app.post('/agent/chat/:sessionId', upload.single('audio'), async (req, res) => {
  let uploadedFile = null;
  
  try {
    const sessionId = req.params.sessionId;
    
    // Validate session ID
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid session ID',
        type: 'VALIDATION_ERROR'
      });
    }
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No audio file provided',
        type: 'VALIDATION_ERROR'
      });
    }

    uploadedFile = req.file;
    console.log(`Processing audio for session: ${sessionId}`);
    console.log('File size:', uploadedFile.size, 'bytes');

    // Validate file size (max 10MB)
    if (uploadedFile.size > 10 * 1024 * 1024) {
      throw new VoiceAgentError('Audio file too large (max 10MB)', 'VALIDATION_ERROR', 400);
    }

    // Read the uploaded audio file
    const audioBuffer = fs.readFileSync(uploadedFile.path);

    // Step 1: Transcribe audio using Assembly AI
    console.log('Transcribing audio...');
    let transcript;
    try {
      transcript = await transcribeAudio(audioBuffer);
    } catch (error) {
      console.error('Transcription failed:', error);
      // Use fallback transcript
      transcript = 'Hello, I am having trouble understanding your audio. Could you please try again?';
    }
    
    console.log('Transcription:', transcript);

    // Step 2: Add user message to chat history
    addToChatHistory(sessionId, 'user', transcript);

    // Step 3: Get conversation history for context
    const conversationHistory = getChatHistory(sessionId);
    console.log('Conversation history:', conversationHistory);

    // Step 4: Generate LLM response with context
    console.log('Generating LLM response...');
    let llmResponse;
    try {
      llmResponse = await generateLLMResponse(transcript, conversationHistory);
    } catch (error) {
      console.error('LLM response generation failed:', error);
      // Use fallback response
      llmResponse = "I'm having trouble connecting to my AI services right now. Please try again in a moment.";
    }
    
    console.log('LLM Response:', llmResponse);

    // Step 5: Add AI response to chat history
    addToChatHistory(sessionId, 'assistant', llmResponse);

    // Step 6: Generate speech
    console.log('Generating speech...');
    let audioData;
    try {
      audioData = await generateSpeech(llmResponse);
    } catch (error) {
      console.error('Speech generation failed:', error);
      // Use fallback audio response
      audioData = generateFallbackAudioResponse(llmResponse);
    }

    // Clean up uploaded file
    if (uploadedFile && fs.existsSync(uploadedFile.path)) {
      fs.unlinkSync(uploadedFile.path);
      uploadedFile = null;
    }

    // Check if we got audio data or fallback text
    if (audioData.length > 100) {
      // Audio data
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioData.length
      });
      res.send(audioData);
    } else {
      // Text fallback
      res.set({
        'Content-Type': 'text/plain',
        'Content-Length': audioData.length
      });
      res.send(audioData);
    }

  } catch (error) {
    console.error('Error in /agent/chat:', error);
    
    // Clean up uploaded file if it exists
    if (uploadedFile && fs.existsSync(uploadedFile.path)) {
      try {
        fs.unlinkSync(uploadedFile.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }

    // Handle specific error types
    if (error instanceof VoiceAgentError) {
      return res.status(error.statusCode).json({ 
        error: error.message,
        type: error.type
      });
    }

    // Generic error response
    res.status(500).json({ 
      error: 'Failed to process audio',
      type: 'INTERNAL_ERROR',
      details: error.message 
    });
  }
});

// Get chat history endpoint with error handling
app.get('/agent/chat/:sessionId/history', (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid session ID',
        type: 'VALIDATION_ERROR'
      });
    }
    
    const history = getChatHistory(sessionId);
    
    res.json({
      sessionId: sessionId,
      messages: history,
      messageCount: history.length
    });
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve chat history',
      type: 'INTERNAL_ERROR',
      details: error.message 
    });
  }
});

// Clear chat history endpoint with error handling
app.delete('/agent/chat/:sessionId/history', (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid session ID',
        type: 'VALIDATION_ERROR'
      });
    }
    
    chatHistory.delete(sessionId);
    
    res.json({
      message: 'Chat history cleared',
      sessionId: sessionId
    });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ 
      error: 'Failed to clear chat history',
      type: 'INTERNAL_ERROR',
      details: error.message 
    });
  }
});

// Health check endpoint with API validation
app.get('/health', (req, res) => {
  try {
    const apiErrors = validateAPIConfig();
    
    if (apiErrors.length > 0) {
      return res.status(503).json({ 
        status: 'DEGRADED',
        message: 'AI Voice Agent is running but some APIs are not configured',
        errors: apiErrors
      });
    }
    
    res.json({ 
      status: 'OK', 
      message: 'AI Voice Agent is running with all APIs configured' 
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'ERROR',
      message: 'Health check failed',
      error: error.message 
    });
  }
});

// Global error handler middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error instanceof VoiceAgentError) {
    return res.status(error.statusCode).json({ 
      error: error.message,
      type: error.type
    });
  }
  
  // Handle multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large (max 10MB)',
      type: 'VALIDATION_ERROR'
    });
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      error: 'Too many files (max 1)',
      type: 'VALIDATION_ERROR'
    });
  }
  
  if (error.message === 'Only audio files are allowed') {
    return res.status(400).json({
      error: 'Only audio files are allowed',
      type: 'VALIDATION_ERROR'
    });
  }
  
  if (error.message === 'Unexpected end of form') {
    return res.status(400).json({
      error: 'Invalid form data or missing audio file',
      type: 'VALIDATION_ERROR'
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    type: 'INTERNAL_ERROR'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    type: 'NOT_FOUND'
  });
});

// Start server with error handling
const port = config.PORT || 3000; // Use config.PORT if available, otherwise default to 3000
server.listen(port, () => {
  console.log(`AI Voice Agent server running on port ${port}`);
  console.log(`Open http://localhost:${port} to use the application`);
  
  // Check API configuration on startup
  const apiErrors = validateAPIConfig();
  if (apiErrors.length > 0) {
    console.warn('⚠️  API Configuration Warnings:');
    apiErrors.forEach(error => console.warn(`  - ${error}`));
    console.warn('The application will use fallback responses for failed APIs.');
  } else {
    console.log('✅ All APIs are properly configured');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
