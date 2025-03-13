import { useState } from 'react';
import { ChatSession } from '../services/projectService';
import './ChatList.css';

interface ChatListProps {
  chats: ChatSession[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onCreateChat: (name: string) => void;
  onDeleteChat: (chatId: string) => void;
  onRenameChat: (chatId: string, newName: string) => void;
}

const ChatList: React.FC<ChatListProps> = ({
  chats,
  selectedChatId,
  onSelectChat,
  onCreateChat,
  onDeleteChat,
  onRenameChat
}) => {
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatName, setEditingChatName] = useState('');

  const handleCreateChat = () => {
    if (newChatName.trim()) {
      onCreateChat(newChatName.trim());
      setNewChatName('');
      setIsCreatingChat(false);
    } else {
      onCreateChat('New Chat');
      setIsCreatingChat(false);
    }
  };

  const handleDeleteChat = (chatId: string) => {
    onDeleteChat(chatId);
    setShowConfirmDelete(null);
  };

  const startEditingChat = (chat: ChatSession) => {
    setEditingChatId(chat.id);
    setEditingChatName(chat.name);
  };

  const saveEditedChatName = () => {
    if (editingChatId && editingChatName.trim()) {
      onRenameChat(editingChatId, editingChatName.trim());
      setEditingChatId(null);
      setEditingChatName('');
    }
  };

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <h3>Chat Sessions</h3>
        <button 
          className="create-chat-button"
          onClick={() => setIsCreatingChat(true)}
        >
          New Chat
        </button>
      </div>

      {isCreatingChat && (
        <div className="create-chat-form">
          <input
            type="text"
            placeholder="Chat Name (optional)"
            value={newChatName}
            onChange={(e) => setNewChatName(e.target.value)}
            className="chat-input"
          />
          <div className="chat-form-actions">
            <button 
              className="cancel-button"
              onClick={() => {
                setIsCreatingChat(false);
                setNewChatName('');
              }}
            >
              Cancel
            </button>
            <button 
              className="create-button"
              onClick={handleCreateChat}
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="chats-container">
        {chats.length === 0 ? (
          <div className="no-chats">
            <p>No chat sessions yet. Create a new chat to start a conversation.</p>
          </div>
        ) : (
          <ul>
            {chats.map((chat, index) => (
              <li 
                key={`chat-${chat.id}-${index}`} 
                className={`chat-item ${selectedChatId === chat.id ? 'selected' : ''}`}
              >
                {editingChatId === chat.id ? (
                  <div className="edit-chat-form">
                    <input
                      type="text"
                      value={editingChatName}
                      onChange={(e) => setEditingChatName(e.target.value)}
                      className="chat-input"
                      autoFocus
                    />
                    <div className="edit-chat-actions">
                      <button 
                        className="cancel-button"
                        onClick={() => {
                          setEditingChatId(null);
                          setEditingChatName('');
                        }}
                      >
                        Cancel
                      </button>
                      <button 
                        className="save-button"
                        onClick={saveEditedChatName}
                        disabled={!editingChatName.trim()}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="chat-item-content">
                    <div 
                      className="chat-info"
                      onClick={() => onSelectChat(chat.id)}
                    >
                      <h4 className="chat-name">{chat.name}</h4>
                      <p className="chat-date">
                        {new Date(chat.updatedAt).toLocaleDateString()} • 
                        {chat.messages.length} messages
                      </p>
                    </div>
                    <div className="chat-actions">
                      <button 
                        className="edit-chat-button"
                        onClick={() => startEditingChat(chat)}
                        aria-label="Rename chat"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" height="14" width="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button 
                        className="delete-chat-button"
                        onClick={() => setShowConfirmDelete(chat.id)}
                        aria-label="Delete chat"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" height="14" width="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                
                {showConfirmDelete === chat.id && (
                  <div className="delete-confirmation">
                    <p>Delete this chat session?</p>
                    <div className="delete-actions">
                      <button 
                        className="cancel-delete"
                        onClick={() => setShowConfirmDelete(null)}
                      >
                        Cancel
                      </button>
                      <button 
                        className="confirm-delete"
                        onClick={() => handleDeleteChat(chat.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ChatList; 