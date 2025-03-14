import { useState, useEffect } from 'react';
import DocumentUpload from './components/DocumentUpload';
import Chat from './components/Chat';
import ProjectSelector from './components/ProjectSelector';
import ChatList from './components/ChatList';
import { initializeVectorStore, deleteDocumentChunks } from './services/vectorStore';
import { useModel } from './contexts/ModelContext';
import { 
  getDocuments, 
  DocumentInfo, 
  deleteDocument
} from './services/documentManagementService';
import { 
  getAllProjects as getProjects, 
  Project, 
  createProject,
  getProjectDocuments,
  getProjectChatSessions,
  createChatSession,
  deleteChatSession,
  renameChatSession,
  getChatSessionById,
  ChatSession,
  initializeProjectData,
  deleteDocumentFromProject
} from './services/projectService';
import './App.css';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [pageSize] = useState(5); // Number of documents per page
  const { selectedModel } = useModel();
  
  // Project state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Chat state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatSession, setSelectedChatSession] = useState<ChatSession | null>(null);

  // Sidebar collapse state
  const [projectSidebarCollapsed, setProjectSidebarCollapsed] = useState(false);
  const [chatSidebarCollapsed, setChatSidebarCollapsed] = useState(false);

  // Track window width for responsive design
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Effect to handle window resizing
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      
      // Auto-collapse project sidebar on mobile
      if (window.innerWidth <= 768) {
        setProjectSidebarCollapsed(true);
      }
    };

    // Set initial state based on window size
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const setupDatabase = async () => {
      try {
        // Initialize Vector Store
        await initializeVectorStore();
        
        // Initialize project data
        initializeProjectData();
        
        setIsDbReady(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    setupDatabase();
  }, []);

  // Load projects
  useEffect(() => {
    if (isDbReady) {
      const availableProjects = getProjects();
      
      // Create a default project if no projects exist
      if (availableProjects.length === 0) {
        const defaultProject = createProject('Default Project', 'Automatically created default project');
        setProjects([defaultProject]);
        setSelectedProject(defaultProject);
      } else {
        setProjects(availableProjects);
        
        // Select first project by default if available
        if (availableProjects.length > 0 && !selectedProject) {
          setSelectedProject(availableProjects[0]);
        }
      }
    }
  }, [isDbReady, selectedProject]);

  // Load documents when project or page changes
  useEffect(() => {
    if (selectedProject) {
      const loadDocuments = () => {
        const result = getProjectDocuments(selectedProject.id, currentPage, pageSize);
        setDocuments(result.documents);
        setTotalDocuments(result.total);
      };

      loadDocuments();
    } else {
      setDocuments([]);
      setTotalDocuments(0);
    }
  }, [currentPage, pageSize, selectedProject]);

  // Load chat sessions when project changes
  useEffect(() => {
    if (selectedProject) {
      const sessions = getProjectChatSessions(selectedProject.id);
      setChatSessions(sessions);
      setSelectedChatId(sessions.length > 0 ? sessions[0].id : null);
    } else {
      setChatSessions([]);
      setSelectedChatId(null);
    }
  }, [selectedProject]);

  // Create a default chat if none exists when switching to chat tab
  useEffect(() => {
    if (activeTab === 'chat' && selectedProject && chatSessions.length === 0) {
      // Create default chat
      const defaultChat = createChatSession(selectedProject.id, 'Default Chat');
      if (defaultChat) {
        setChatSessions([defaultChat]);
        setSelectedChatId(defaultChat.id);
      }
    }
  }, [activeTab, selectedProject, chatSessions.length]);

  // Update selected chat session when chat ID changes
  useEffect(() => {
    if (selectedProject && selectedChatId) {
      const chatSession = getChatSessionById(selectedProject.id, selectedChatId);
      setSelectedChatSession(chatSession);
    } else {
      setSelectedChatSession(null);
    }
  }, [selectedProject, selectedChatId]);

  const handleDocumentUpload = (documentId: string, documentName: string) => {
    // Refresh document list after upload
    if (selectedProject) {
      const result = getProjectDocuments(selectedProject.id, currentPage, pageSize);
      setDocuments(result.documents);
      setTotalDocuments(result.total);
    }
  };

  const handleDeleteDocument = (documentId: string) => {
    if (!selectedProject) return;
    
    // First, delete from project documents
    const success = deleteDocumentFromProject(selectedProject.id, documentId);
    
    if (success) {
      // Also delete document chunks from vector store
      const chunksDeleted = deleteDocumentChunks(documentId);
      console.log(`Deleted ${chunksDeleted} chunks for document ${documentId}`);
      
      // Refresh document list
      const result = getProjectDocuments(selectedProject.id, currentPage, pageSize);
      setDocuments(result.documents);
      setTotalDocuments(result.total);
      
      // If current page is now empty (except for the last page), go to previous page
      if (result.documents.length === 0 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } else {
      console.error(`Failed to delete document ${documentId} from project ${selectedProject.id}`);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleProjectChange = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setSelectedProject(project);
      setCurrentPage(1); // Reset to first page when changing projects
    }
  };

  const handleCreateProject = (projectName: string, description: string = '') => {
    const newProject = createProject(projectName, description);
    setProjects([...projects, newProject]);
    setSelectedProject(newProject);
    setCurrentPage(1);
  };

  const handleDeleteProject = (projectId: string) => {
    // TODO: Implement project deletion
    console.log('Deleting project:', projectId);
  };

  const handleCreateChat = (name: string) => {
    if (!selectedProject) {
      // Create a default project if none is selected
      const defaultProject = createProject('Default Project', 'Automatically created default project');
      setProjects([...projects, defaultProject]);
      setSelectedProject(defaultProject);
      
      // Generate a placeholder name based on date/time if not provided
      const chatName = name || `Chat ${new Date().toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`;
      
      const newChat = createChatSession(defaultProject.id, chatName);
      if (newChat) {
        // Get fresh chat sessions instead of appending to prevent duplicates
        const updatedSessions = getProjectChatSessions(defaultProject.id);
        setChatSessions(updatedSessions);
        setSelectedChatId(newChat.id);
      }
    } else {
      // Generate a placeholder name based on date/time if not provided
      const chatName = name || `Chat ${new Date().toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`;
      
      const newChat = createChatSession(selectedProject.id, chatName);
      if (newChat) {
        // Get fresh chat sessions instead of appending to prevent duplicates
        const updatedSessions = getProjectChatSessions(selectedProject.id);
        setChatSessions(updatedSessions);
        setSelectedChatId(newChat.id);
      }
    }
  };

  const handleDeleteChat = (chatId: string) => {
    if (!selectedProject) return;
    
    const success = deleteChatSession(selectedProject.id, chatId);
    if (success) {
      // Refresh chat list
      const sessions = getProjectChatSessions(selectedProject.id);
      setChatSessions(sessions);
      
      // If we deleted the selected chat, select another one
      if (selectedChatId === chatId) {
        setSelectedChatId(sessions.length > 0 ? sessions[0].id : null);
      }
    }
  };

  const handleRenameChat = (chatId: string, newName: string) => {
    if (!selectedProject) return;
    
    const success = renameChatSession(selectedProject.id, chatId, newName);
    if (success) {
      // Refresh chat list
      const sessions = getProjectChatSessions(selectedProject.id);
      setChatSessions(sessions);
    }
  };

  // Toggle project sidebar
  const toggleProjectSidebar = () => {
    setProjectSidebarCollapsed(!projectSidebarCollapsed);
  };

  // Toggle chat sidebar
  const toggleChatSidebar = () => {
    setChatSidebarCollapsed(!chatSidebarCollapsed);
  };

  // Handle overlay click (mobile)
  const handleOverlayClick = () => {
    setProjectSidebarCollapsed(true);
  };

  // Convert DocumentInfo[] to string[] for Chat component
  const documentNames = documents.map(doc => doc.name);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>BrowserRAG</h1>
        <p>Chat with your documents entirely in your browser</p>
      </header>

      {/* Mobile overlay for sidebar */}
      {!projectSidebarCollapsed && windowWidth <= 768 && (
        <div className="sidebar-overlay active" onClick={handleOverlayClick}></div>
      )}

      <div className="app-main">
        <aside className={`app-sidebar ${projectSidebarCollapsed ? 'collapsed' : ''}`}>
          <button 
            className="sidebar-toggle" 
            onClick={toggleProjectSidebar}
            aria-label={projectSidebarCollapsed ? "Show projects" : "Hide projects"}
          >
            {projectSidebarCollapsed ? "+" : "−"}
          </button>
          <ProjectSelector 
            projects={projects} 
            selectedProjectId={selectedProject?.id || ''} 
            onSelectProject={handleProjectChange}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
          />
        </aside>

        <div className="app-content-wrapper">
          <nav className="app-tabs">
            <button 
              className={activeTab === 'upload' ? 'active' : ''} 
              onClick={() => setActiveTab('upload')}
            >
              Upload Documents
            </button>
            <button 
              className={activeTab === 'chat' ? 'active' : ''} 
              onClick={() => setActiveTab('chat')}
              disabled={totalDocuments === 0}
            >
              Chat
            </button>
          </nav>

          <main className="app-content">
            {activeTab === 'upload' ? (
              <DocumentUpload 
                isDbReady={isDbReady} 
                documents={documents}
                onDocumentProcessed={handleDocumentUpload}
                onDeleteDocument={handleDeleteDocument}
                currentPage={currentPage}
                totalDocuments={totalDocuments}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                projectId={selectedProject?.id || ''}
              />
            ) : (
              <div className="chat-interface">
                <div className={`chat-sidebar ${chatSidebarCollapsed ? 'collapsed' : ''}`}>
                  <button 
                    className="chat-sidebar-toggle" 
                    onClick={toggleChatSidebar}
                    aria-label={chatSidebarCollapsed ? "Show chats" : "Hide chats"}
                  >
                    {chatSidebarCollapsed ? "+" : "−"}
                  </button>
                  <ChatList 
                    chats={chatSessions}
                    selectedChatId={selectedChatId}
                    onSelectChat={setSelectedChatId}
                    onCreateChat={handleCreateChat}
                    onDeleteChat={handleDeleteChat}
                    onRenameChat={handleRenameChat}
                  />
                </div>
                <div className="chat-main">
                  {selectedChatId && selectedProject && selectedChatSession ? (
                    <Chat 
                      documents={documentNames} 
                      chatId={selectedChatId}
                      projectId={selectedProject.id}
                      chatSession={selectedChatSession}
                    />
                  ) : (
                    <div className="no-chat-selected">
                      {totalDocuments === 0 ? 
                        "Upload documents first to start chatting" : 
                        "Select or create a chat to begin"
                      }
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <footer className="app-footer">
        <p>
          All processing happens in your browser - your data never leaves your device.
          <br />
          <small>Currently using model: {selectedModel.name}</small>
        </p>
      </footer>
    </div>
  );
}

export default App; 