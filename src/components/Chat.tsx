import { useState, useRef, useEffect } from 'react';
import { queryDocuments } from '../services/ragService';
import './Chat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isThinking?: boolean;
  thinkingFor?: string; // ID of the question this thinking relates to
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

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
    setError(null);
    
    try {
      // Show "typing" message immediately
      const tempAssistantId = `temp-${questionId}`;
      setMessages(prev => [
        ...prev,
        {
          id: tempAssistantId,
          role: 'assistant',
          content: '...',
          timestamp: new Date(),
        },
      ]);

      const response = await queryDocuments(userMessage.content);
      
      // Remove temp message and update with final response
      setMessages(prev => {
        // Filter out temporary typing indicator
        const withoutTemp = prev.filter(m => m.id !== tempAssistantId);
        
        // Convert thinking message to collapsed version if it exists
        const withCollapsedThinking = withoutTemp.map(m => 
          (m.isThinking && m.thinkingFor === questionId) 
            ? { ...m, isThinking: false } 
            : m
        );
        
        // Add the final response
        return [
          ...withCollapsedThinking,
          {
            id: `answer-${questionId}`,
            role: 'assistant',
            content: response,
            timestamp: new Date(),
          }
        ];
      });
    } catch (err) {
      console.error('Error querying documents:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while processing your request');
      
      // Remove temp message if it exists
      setMessages(prev => 
        prev.filter(m => m.id !== `temp-${questionId}`).concat({
          id: `error-${questionId}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
          timestamp: new Date(),
        })
      );
    } finally {
      setIsProcessing(false);
      currentQuestionRef.current = null;
    }
  };

  return (
    <div className="chat-container">
      <div className="messages-container">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'} ${message.isThinking ? 'thinking-message' : ''}`}
          >
            {message.isThinking && <div className="thinking-label">Thinking...</div>}
            <div className="message-content">
              {message.content === '...' ? (
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