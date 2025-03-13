import { useState, useRef, useEffect } from 'react';
import { queryDocuments, ProgressCallback } from '../services/ragService';
import { useModel, ProgressInfo } from '../contexts/ModelContext';
import ModelSelector from './ModelSelector';
import ProgressBar from './ProgressBar';
import './Chat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isThinking?: boolean;
  thinkingFor?: string; // ID of the question this thinking relates to
  isStreaming?: boolean; // For streaming partial responses
}

interface ChatProps {
  documents: string[];
}

const Chat: React.FC<ChatProps> = ({ documents }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentQuestionRef = useRef<string | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  
  // Get model context
  const { selectedModel, progressInfo, setProgressInfo } = useModel();

  // Add initial assistant message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Hello! I'm ready to answer questions about your ${documents.length} document(s). What would you like to know?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [documents, messages.length]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Setup global thinking event listener
  useEffect(() => {
    const handleThinking = (event: CustomEvent) => {
      if (event.detail && event.detail.text && currentQuestionRef.current) {
        const questionId = currentQuestionRef.current;
        const thinkingId = `thinking-${questionId}`;
        
        setMessages(prev => {
          const thinkingMessage = prev.find(m => m.id === thinkingId);
          if (thinkingMessage) {
            // Update existing thinking message
            return prev.map(m => 
              m.id === thinkingId 
                ? { ...m, content: event.detail.text } 
                : m
            );
          } else {
            // Add new thinking message
            return [
              ...prev,
              {
                id: thinkingId,
                role: 'assistant',
                content: event.detail.text,
                timestamp: new Date(),
                isThinking: true,
                thinkingFor: questionId
              }
            ];
          }
        });
      }
    };

    window.addEventListener('thinking', handleThinking as EventListener);
    
    return () => {
      window.removeEventListener('thinking', handleThinking as EventListener);
    };
  }, []);

  // Stream response token by token
  const handleStreamToken = (token: string) => {
    if (streamingIdRef.current) {
      setMessages(prev => {
        return prev.map(msg => 
          msg.id === streamingIdRef.current
            ? { ...msg, content: msg.content + token }
            : msg
        );
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    // Reset error and progress
    setError(null);
    setProgressInfo({
      status: 'idle',
      message: '',
      progress: 0
    });

    // Generate unique ID for this question
    const questionId = Date.now().toString();
    currentQuestionRef.current = questionId;

    const userMessage: Message = {
      id: questionId,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    
    try {
      // Create streaming response message
      const streamingId = `stream-${questionId}`;
      streamingIdRef.current = streamingId;
      
      setMessages(prev => [
        ...prev,
        {
          id: streamingId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isStreaming: true
        }
      ]);

      // Define a properly typed progress callback
      const progressCallback: ProgressCallback = (progress) => {
        setProgressInfo({
          status: progress.status as 'idle' | 'loading' | 'success' | 'error',
          message: progress.message,
          progress: progress.progress,
          stage: progress.stage
        });
      };

      // Query documents with the selected model and progress updates
      const response = await queryDocuments(
        userMessage.content, 
        selectedModel.id,
        progressCallback,
        handleStreamToken
      );
      
      // After the final response is complete, update the streaming status
      streamingIdRef.current = null;
      setMessages(prev => {
        return prev.map(msg => 
          msg.id === streamingId
            ? { ...msg, isStreaming: false, content: response }
            : msg
        );
      });
      
      // Convert thinking message to collapsed version if it exists
      setMessages(prev => {
        return prev.map(m => 
          (m.isThinking && m.thinkingFor === questionId) 
            ? { ...m, isThinking: false } 
            : m
        );
      });
    } catch (err) {
      console.error('Error querying documents:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while processing your request');
      
      // Remove streaming message if it exists
      if (streamingIdRef.current) {
        const streamingId = streamingIdRef.current;
        streamingIdRef.current = null;
        
        setMessages(prev => 
          prev.filter(m => m.id !== streamingId).concat({
            id: `error-${questionId}`,
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your request. Please try again.',
            timestamp: new Date(),
          })
        );
      }
    } finally {
      setIsProcessing(false);
      currentQuestionRef.current = null;
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-controls">
        <ModelSelector />
        <ProgressBar 
          progress={progressInfo.progress || 0}
          status={progressInfo.status}
          message={progressInfo.message}
          stage={progressInfo.stage}
        />
      </div>
      
      <div className="messages-container">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'} ${message.isThinking ? 'thinking-message' : ''} ${message.isStreaming ? 'streaming-message' : ''}`}
          >
            {message.isThinking && <div className="thinking-label">Thinking...</div>}
            <div className="message-content">
              {message.isStreaming && message.content === '' ? (
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              ) : message.isThinking === false ? (
                <details>
                  <summary>View thinking process</summary>
                  <div className="thinking-content">{message.content}</div>
                </details>
              ) : (
                message.content
              )}
            </div>
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        {error && <div className="error-message">{error}</div>}
        <div className="input-container">
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
            disabled={isProcessing || !input.trim()}
            className="send-button"
          >
            {isProcessing ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat; 