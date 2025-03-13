import { useState, useRef, useEffect } from 'react';
import { queryDocuments, ProgressCallback } from '../services/ragService';
import { useModel } from '../contexts/ModelContext';
import { ChatSession, ChatMessage as StoredChatMessage, addMessageToChatSession } from '../services/projectService';
import ModelSelector from './ModelSelector';
import ProgressBar, { ProgressInfo } from './ProgressBar';
import { ModelInfo } from '../services/modelPersistenceService';
import './Chat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isThinking?: boolean;
  thinkingFor?: string; // ID of the question this thinking relates to
  isStreaming?: boolean; // For streaming partial responses
}

interface ChatProps {
  documents: string[];
  projectId: string;
  chatId: string;
  chatSession: ChatSession | null;
}

const Chat: React.FC<ChatProps> = ({ documents, projectId, chatId, chatSession }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentQuestionRef = useRef<string | null>(null);
  
  // Get model context
  const { selectedModel, progressInfo, setProgressInfo } = useModel();

  // Load messages from chat session
  useEffect(() => {
    if (chatSession) {
      // Convert stored messages to UI messages
      const uiMessages: Message[] = chatSession.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      }));
      
      // If there are no messages, add a welcome message
      if (uiMessages.length === 0) {
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Hello! I'm ready to answer questions about your ${documents.length} document(s) in the "${chatSession.name}" chat. What would you like to know?`,
          timestamp: new Date(),
        };
        
        setMessages([welcomeMessage]);
        
        // Save welcome message to chat session
        addMessageToChatSession(
          projectId,
          chatId,
          'assistant',
          welcomeMessage.content
        );
      } else {
        setMessages(uiMessages);
      }
    }
  }, [chatSession, documents.length, projectId, chatId]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset progress info when component unmounts
  useEffect(() => {
    return () => {
      if (setProgressInfo) {
        setProgressInfo(null);
      }
    };
  }, [setProgressInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const question = input.trim();
    setInput('');
    currentQuestionRef.current = question;
    setError(null);

    // Add user message
    const userMessageId = Date.now().toString();
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Save user message to chat session
    addMessageToChatSession(
      projectId,
      chatId,
      'user',
      question
    );

    // Add thinking message
    const thinkingMessageId = (Date.now() + 1).toString();
    const thinkingMessage: Message = {
      id: thinkingMessageId,
      role: 'assistant',
      content: 'Thinking...',
      timestamp: new Date(),
      isThinking: true,
      thinkingFor: userMessageId,
    };
    
    setMessages(prev => [...prev, thinkingMessage]);
    setIsProcessing(true);

    try {
      // Create a progress callback
      const progressCallback: ProgressCallback = (stage: string, progress: number) => {
        if (setProgressInfo) {
          setProgressInfo({
            stage,
            progress,
          });
        }
      };

      // Convert ModelOption to ModelInfo
      const modelInfo: ModelInfo = {
        id: selectedModel.id,
        name: selectedModel.name,
        type: 'onnx',
        isDownloaded: true
      };

      // Query documents
      const response = await queryDocuments(
        question,
        documents,
        modelInfo,
        progressCallback,
        projectId
      );

      // Remove thinking message and add assistant response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== thinkingMessageId);
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };
        
        // Save assistant message to chat session
        addMessageToChatSession(
          projectId,
          chatId,
          'assistant',
          response
        );
        
        return [...filtered, assistantMessage];
      });
    } catch (err) {
      console.error('Error querying documents:', err);
      
      // Remove thinking message and add error message
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== thinkingMessageId);
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while processing your question';
        setError(errorMessage);
        
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `I'm sorry, I encountered an error: ${errorMessage}`,
          timestamp: new Date(),
        };
        
        // Save error message to chat session
        addMessageToChatSession(
          projectId,
          chatId,
          'assistant',
          assistantMessage.content
        );
        
        return [...filtered, assistantMessage];
      });
    } finally {
      setIsProcessing(false);
      if (setProgressInfo) {
        setProgressInfo(null);
      }
      currentQuestionRef.current = null;
    }
  };

  return (
    <div className="chat">
      <div className="chat-header">
        <h2>{chatSession?.name || 'Chat'}</h2>
        <ModelSelector />
      </div>
      
      <div className="messages-container">
        <div className="messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.role} ${
                message.isThinking ? 'thinking' : ''
              } ${message.isStreaming ? 'streaming' : ''}`}
            >
              <div className="message-content">
                {message.isThinking ? (
                  <div className="thinking-indicator">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                ) : (
                  message.content
                )}
              </div>
              <div className="message-timestamp">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {progressInfo && <ProgressBar info={progressInfo} />}

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your documents..."
          disabled={isProcessing}
          className="chat-input"
        />
        <button
          type="submit"
          disabled={!input.trim() || isProcessing}
          className="send-button"
        >
          {isProcessing ? (
            <span className="spinner"></span>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          )}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}
      
      {messages.some(m => m.content.includes("I couldn't find any relevant information")) && (
        <div className="no-results-help">
          <details>
            <summary>Document Query Troubleshooting</summary>
            <div className="troubleshooting-content">
              <h4>Tips for Better Results:</h4>
              <ul>
                <li>Check if your document contains the information you're looking for</li>
                <li>Try rephrasing your question using terms that appear in your document</li>
                <li>Check the document upload logs for any issues during processing</li>
                <li>Try uploading the document again to ensure it was properly indexed</li>
                <li>For PDFs, ensure they contain searchable text (not just scanned images)</li>
                <li>For CSVs, ensure they're properly formatted with headers</li>
              </ul>
              <p><strong>Document Names:</strong> {documents.join(', ')}</p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default Chat; 