import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { queryDocuments, ProgressCallback } from '../services/ragService';
import { useModel } from '../contexts/ModelContext';
import { ChatSession, ChatMessage as StoredChatMessage, addMessageToChatSession } from '../services/projectService';
import ModelSelector from './ModelSelector';
import ProgressBar, { ProgressInfo } from './ProgressBar';
import { ModelInfo } from '../services/modelPersistenceService';
import './Chat.css';

// Debounce utility to prevent excessive verification calls
const debounce = <T extends (...args: any[]) => any>(fn: T, ms = 300) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

// A simple cache to store the last verification result
const verificationCache: Record<string, { timestamp: number, result: any }> = {};
const VERIFICATION_CACHE_TIMEOUT = 10000; // 10 seconds

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isThinking?: boolean;
  thinkingFor?: string; // ID of the question this thinking relates to
  isStreaming?: boolean; // For streaming partial responses
  thoughtContent?: string; // Content of the model's thoughts
  areThoughtsCollapsed?: boolean; // Whether thoughts are collapsed
  associatedQuestionId?: string; // ID of the associated user question
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
  const [embeddingsVerified, setEmbeddingsVerified] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentQuestionRef = useRef<string | null>(null);
  
  // Get model context
  const { selectedModel, progressInfo, setProgressInfo } = useModel();

  // Modal state
  const [showHeaderModal, setShowHeaderModal] = useState(false);
  
  // Ref for the modal content
  const modalContentRef = useRef<HTMLDivElement>(null);
  
  // Handle modal backdrop click to close the modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
      setShowHeaderModal(false);
    }
  };

  // Verify embeddings on mount or when projectId changes
  useEffect(() => {
    const verifyEmbeddings = async () => {
      if (!projectId) {
        setEmbeddingsVerified(false);
        return;
      }
      
      try {
        // Check cache first
        const now = Date.now();
        if (verificationCache[projectId] && 
            (now - verificationCache[projectId].timestamp) < VERIFICATION_CACHE_TIMEOUT) {
          // Use cached result
          const cachedResult = verificationCache[projectId].result;
          setEmbeddingsVerified(cachedResult.exists);
          
          if (!cachedResult.exists) {
            setError('Warning: No document embeddings found. Chat may not work properly. Try refreshing the page or re-uploading the documents.');
          } else {
            setError(null);
          }
          return;
        }
        
        // If not in cache, perform verification
        const { verifyEmbeddings } = await import('../services/vectorStore');
        const verification = verifyEmbeddings(undefined, projectId);
        
        // Only log on first verification or when status changes
        if (!verificationCache[projectId] || 
            verificationCache[projectId].result.exists !== verification.exists) {
          console.log(`Chat embeddings verification for project ${projectId}:`, verification);
        }
        
        // Cache the result
        verificationCache[projectId] = {
          timestamp: now,
          result: verification
        };
        
        setEmbeddingsVerified(verification.exists);
        
        if (!verification.exists) {
          setError('Warning: No document embeddings found. Chat may not work properly. Try refreshing the page or re-uploading the documents.');
        } else {
          setError(null);
        }
      } catch (error) {
        console.error('Error verifying embeddings:', error);
        setEmbeddingsVerified(false);
        setError('Failed to verify document embeddings. Chat may not work properly.');
      }
    };

    // Create a debounced version to prevent multiple rapid calls
    const debouncedVerify = debounce(verifyEmbeddings, 500);
    debouncedVerify();
    
  }, [projectId]);

  // Function to manually reinitialize the vector store
  const handleReinitializeVectorStore = async () => {
    setError('Reinitializing vector store...');
    try {
      const { initializeVectorStore } = await import('../services/vectorStore');
      await initializeVectorStore();
      
      // Re-verify embeddings
      const { verifyEmbeddings } = await import('../services/vectorStore');
      const verification = verifyEmbeddings(undefined, projectId);
      
      console.log(`Re-verification after initialization:`, verification);
      setEmbeddingsVerified(verification.exists);
      
      if (!verification.exists) {
        setError('Still no document embeddings found. Please try re-uploading your documents.');
      } else {
        setError(null);
      }
    } catch (error) {
      console.error('Error reinitializing vector store:', error);
      setError('Failed to reinitialize the vector store. Please refresh the page.');
    }
  };

  // Add event listener for thinking events
  useEffect(() => {
    const handleThinking = (event: CustomEvent<{ text: string }>) => {
      setMessages(prev => {
        const newMessages = [...prev];
        // Find the last assistant message that is associated with the current question
        const lastAssistantIndex = newMessages.findIndex(
          m => m.role === 'assistant' && 
               !m.isThinking && 
               m.associatedQuestionId === currentQuestionRef.current
        );
        
        if (lastAssistantIndex !== -1) {
          // Update the thought content for this message
          newMessages[lastAssistantIndex] = {
            ...newMessages[lastAssistantIndex],
            thoughtContent: event.detail.text,
            areThoughtsCollapsed: false
          };
        }
        return newMessages;
      });
    };

    // Add event listeners
    window.addEventListener('thinking', handleThinking as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('thinking', handleThinking as EventListener);
    };
  }, []);

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
        let welcomeContent = '';
        
        if (documents.length > 0) {
          welcomeContent = `Hello! I'm ready to answer questions about your ${documents.length} document(s) in the "${chatSession.name}" chat. What would you like to know?`;
        } else {
          welcomeContent = `Hello! Welcome to the "${chatSession.name}" chat. No documents have been uploaded yet, but you can still chat with me as a general conversational AI. You can also upload documents at any time for more specific document-based answers. What would you like to talk about?`;
        }
        
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: welcomeContent,
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
    setError(null);

    // Collapse all thoughts when a new message is sent
    setMessages(prev => {
      return prev.map(message => {
        if (message.thoughtContent && !message.areThoughtsCollapsed) {
          return {
            ...message,
            areThoughtsCollapsed: true
          };
        }
        return message;
      });
    });

    // Add user message
    const userMessageId = Date.now().toString();
    currentQuestionRef.current = userMessageId; // Store the message ID instead of the question text
    
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

      // Remove thinking message and add initial assistant response container
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== thinkingMessageId);
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: '',  // Start with empty content that will be streamed
          timestamp: new Date(),
          areThoughtsCollapsed: false,
          isStreaming: true,
          associatedQuestionId: userMessageId  // Associate with the question
        };
        
        return [...filtered, assistantMessage];
      });
      
      // Set up a stream callback for response text
      const streamCallback = (text: string) => {
        // Directly update messages state instead of using custom events
        setMessages(prev => {
          const newMessages = [...prev];
          // Find the last assistant message that is associated with the current question
          const lastAssistantIndex = newMessages.findIndex(
            m => m.role === 'assistant' && 
                !m.isThinking && 
                m.associatedQuestionId === userMessageId
          );
          
          if (lastAssistantIndex !== -1) {
            // Update the content with the streamed text
            newMessages[lastAssistantIndex] = {
              ...newMessages[lastAssistantIndex],
              content: text,
              isStreaming: true
            };
          }
          return newMessages;
        });
      };

      // Query documents with streaming
      const response = await queryDocuments(
        question,
        documents,
        modelInfo,
        progressCallback,
        projectId,
        streamCallback  // Add streaming callback
      );

      // Update the message to indicate streaming is complete
      setMessages(prev => {
        return prev.map(message => {
          if (message.role === 'assistant' && message.associatedQuestionId === userMessageId) {
            return {
              ...message,
              content: response,  // Final full response
              isStreaming: false
            };
          }
          return message;
        });
      });

      // Save assistant message to chat session
      addMessageToChatSession(
        projectId,
        chatId,
        'assistant',
        response
      );

      // Auto-collapse thoughts after a delay
      setTimeout(() => {
        setMessages(prev => {
          return prev.map(message => {
            if (message.role === 'assistant' && 
                message.thoughtContent && 
                !message.areThoughtsCollapsed && 
                message.associatedQuestionId === userMessageId) {
              return {
                ...message,
                areThoughtsCollapsed: true
              };
            }
            return message;
          });
        });
      }, 5000); // Collapse after 5 seconds
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

  // Toggle thoughts collapse state
  const toggleThoughts = (messageId: string) => {
    setMessages(prev => {
      return prev.map(message => {
        if (message.id === messageId && message.thoughtContent) {
          return {
            ...message,
            areThoughtsCollapsed: !message.areThoughtsCollapsed
          };
        }
        return message;
      });
    });
  };

  // Add to the render method, near where you display errors
  const renderErrorWithRefreshButton = () => {
    if (!error) return null;
    
    return (
      <div className="chat-error">
        <p>{error}</p>
        {!embeddingsVerified && (
          <button 
            className="refresh-button"
            onClick={handleReinitializeVectorStore}
          >
            Reinitialize Vector Store
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="chat">
      {/* Enhanced Header with Model Info */}
      <div className="chat-header">
        <h2>{chatSession?.name || 'Chat'}</h2>
        <button 
          className="chat-header-model-button" 
          onClick={() => setShowHeaderModal(true)}
          aria-label="Model Settings"
          title="Click to change model settings"
        >
          <span className="model-name">{selectedModel.name}</span>
          <span className="model-size">{selectedModel.size}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>
      
      {/* Header Modal with updated click handler */}
      {showHeaderModal && (
        <div 
          className={`header-modal ${showHeaderModal ? 'open' : ''}`}
          onClick={handleBackdropClick}
        >
          <div 
            className="header-modal-content"
            ref={modalContentRef}
          >
            <button 
              className="header-modal-close" 
              onClick={(e) => {
                e.stopPropagation();
                setShowHeaderModal(false);
              }}
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h3 className="header-modal-title">Model Settings for {chatSession?.name || 'Chat'}</h3>
            <div className="header-modal-body">
              <div className="model-selector-container">
                <label>Model:</label>
                <ModelSelector />
              </div>
              <div className="chat-info">
                <p>Chat Session: {chatSession?.name || 'Unnamed'}</p>
                <p>Project ID: {projectId}</p>
                <p>Documents: {documents.length}</p>
                <p>Messages: {messages.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
                  <>
                    {message.content}
                    
                    {message.thoughtContent && (
                      <div className={`thoughts-container ${
                        isProcessing && 
                        !message.areThoughtsCollapsed && 
                        message.id === messages.filter(m => m.role === 'assistant' && !m.isThinking).pop()?.id 
                          ? 'thinking' 
                          : ''
                      }`}>
                        <div 
                          className="thoughts-toggle" 
                          onClick={() => toggleThoughts(message.id)}
                        >
                          {message.areThoughtsCollapsed ? 'Show thoughts' : 'Hide thoughts'}
                        </div>
                        
                        {!message.areThoughtsCollapsed && (
                          <div className="thoughts-content">
                            <pre>{message.thoughtContent}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </>
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

      {renderErrorWithRefreshButton()}
      
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