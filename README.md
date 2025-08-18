# 🎤 AI Voice Agent

> **Your intelligent conversational assistant powered by cutting-edge AI technology**

A sophisticated voice agent application that enables natural conversations through speech. Built with a robust non-streaming pipeline that handles audio transcription, AI processing, and response generation with comprehensive error handling and fallback mechanisms.

![AI Voice Agent Demo](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

### 🎯 Core Capabilities
- **Real-time Voice Recording**: High-quality audio capture with WebRTC
- **Speech-to-Text**: Powered by Assembly AI for accurate transcription
- **AI Conversation**: Gemini Pro integration for intelligent responses
- **Context Awareness**: Maintains conversation history for coherent dialogues
- **Session Management**: Persistent chat sessions with unique identifiers

### 🛡️ Reliability Features
- **Comprehensive Error Handling**: Graceful degradation with fallback responses
- **API Health Monitoring**: Real-time status checking and validation
- **Rate Limiting Protection**: Built-in safeguards against API abuse
- **File Size Validation**: 10MB audio file limit with proper validation
- **Graceful Shutdown**: Clean server termination on system signals

### 🎨 User Experience
- **Modern UI**: Beautiful gradient design with responsive layout
- **Real-time Status**: Visual feedback for recording, processing, and ready states
- **Keyboard Shortcuts**: Spacebar to start/stop recording
- **Mobile Responsive**: Optimized for all device sizes
- **Conversation History**: View and manage chat sessions

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   AI Services   │
│   (HTML/JS)     │◄──►│   (Node.js)     │◄──►│   (Gemini/      │
│                 │    │                 │    │   Assembly AI)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### System Components

1. **Frontend Interface**
   - Modern web interface with WebRTC audio recording
   - Real-time status indicators and conversation display
   - Responsive design with mobile optimization

2. **Backend Server**
   - Express.js REST API with comprehensive middleware
   - Multer file upload handling with validation
   - Session-based chat history management
   - CORS and security configurations

3. **AI Processing Pipeline**
   - Audio transcription via Assembly AI
   - Natural language processing with Gemini Pro
   - Context-aware conversation management
   - Fallback response generation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager
- Microphone access (for voice recording)
- API keys for Gemini and Assembly AI

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ai-voice-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy the config template
   cp config.example.js config.js
   
   # Edit config.js with your API keys
   ```

4. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## ⚙️ Configuration

### Environment Variables

Create a `config.js` file in the root directory:

```javascript
module.exports = {
  
  GEMINI_API_KEY: 'your_gemini_api_key_here',
  ASSEMBLY_API_KEY: 'your_assembly_ai_api_key_here',
  PORT: process.env.PORT || 3000
};
```

### API Key Setup

1. **Gemini API Key**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key to `GEMINI_API_KEY`

2. **Assembly AI API Key**
   - Sign up at [Assembly AI](https://www.assemblyai.com/)
   - Navigate to your account settings
   - Copy the API key to `ASSEMBLY_API_KEY`

## 📡 API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/chat/:sessionId` | POST | Process audio and get AI response |
| `/agent/chat/:sessionId/history` | GET | Retrieve chat history |
| `/agent/chat/:sessionId/history` | DELETE | Clear chat history |
| `/health` | GET | API health status |

### Request/Response Examples

**Process Audio Chat**
```bash
POST /agent/chat/session_123
Content-Type: multipart/form-data

audio: [audio_file]
```

**Response**
```json
{
  "status": "success",
  "transcript": "Hello, how are you?",
  "response": "I'm doing great, thank you for asking! How can I help you today?"
}
```

## 🔧 Development

### Project Structure
```
ai-voice-agent/
├── server.js          # Main server file
├── config.js          # Configuration and API keys
├── package.json       # Dependencies and scripts
├── public/            # Static frontend files
│   └── index.html     # Main application interface
├── uploads/           # Temporary audio file storage
└── README.md          # This file
```

### Available Scripts

```bash

npm start

npm run dev

npm install

npm outdated
```

### Development Features

- **Hot Reload**: Automatic server restart on file changes
- **Error Logging**: Comprehensive error tracking and debugging
- **API Validation**: Real-time configuration validation
- **Health Monitoring**: Built-in health check endpoints

## 🧪 Testing

### Health Check
```bash
curl http://localhost:3000/health
```

### API Validation
The server automatically validates API configuration on startup and provides detailed error messages for missing or invalid keys.

## 🚨 Error Handling

### Fallback Mechanisms
- **API Failures**: Graceful degradation to rule-based responses
- **Transcription Errors**: Fallback text for audio processing issues
- **Network Timeouts**: Configurable timeout handling with retry logic
- **File Validation**: Comprehensive audio file type and size checking

### Error Types
- `CONFIG_ERROR`: Missing or invalid API configuration
- `VALIDATION_ERROR`: Invalid input parameters
- `API_ERROR`: External service failures
- `TIMEOUT_ERROR`: Request timeout handling
- `AUTH_ERROR`: Authentication failures
- `RATE_LIMIT_ERROR`: API rate limit exceeded

## 🔒 Security Features

- **CORS Configuration**: Controlled cross-origin access
- **File Type Validation**: Strict audio file type checking
- **Size Limits**: Configurable file size restrictions
- **Input Sanitization**: Comprehensive input validation
- **Error Message Sanitization**: Safe error responses

## 📱 Browser Compatibility

- **Chrome**: 88+ (Full support)
- **Firefox**: 85+ (Full support)
- **Safari**: 14+ (Full support)
- **Edge**: 88+ (Full support)

### Required Browser Features
- WebRTC MediaRecorder API
- Fetch API
- ES6+ JavaScript support
- Audio playback capabilities

## 🚀 Deployment

### Production Considerations

1. **Environment Variables**
   ```bash
   export GEMINI_API_KEY="your_production_key"
   export ASSEMBLY_API_KEY="your_production_key"
   export PORT=8080
   ```

2. **Process Management**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start server.js --name "ai-voice-agent"
   
   # Using Docker
   docker build -t ai-voice-agent .
   docker run -p 3000:3000 ai-voice-agent
   ```

3. **Reverse Proxy**
   ```nginx
   location / {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
   }
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Gemini**: For powerful AI conversation capabilities
- **Assembly AI**: For accurate speech-to-text transcription
- **Express.js**: For robust backend framework
- **WebRTC**: For browser-based audio recording

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/ai-voice-agent/issues)
- **Documentation**: [Project Wiki](https://github.com/yourusername/ai-voice-agent/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ai-voice-agent/discussions)

---

**Made with ❤️ for the AI Voice Agents community**

*Built as part of the "30 Days of AI Voice Agents" challenge - Day 13: Documentation*


