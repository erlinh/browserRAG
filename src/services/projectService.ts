import { v4 as uuidv4 } from 'uuid';
import { DocumentInfo } from './documentManagementService';

// Project data structure
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

// Chat message structure
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// Chat session structure
export interface ChatSession {
  id: string;
  projectId: string;
  name: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// Storage keys
const PROJECTS_STORAGE_KEY = 'browserrag_projects';
const DOCUMENTS_STORAGE_KEY = 'browserrag_documents';
const CHATS_STORAGE_KEY = 'browserrag_chats';

// In-memory cache
let projects: Project[] = [];
let documents: Record<string, DocumentInfo[]> = {}; // projectId -> documents
let chatSessions: Record<string, ChatSession[]> = {}; // projectId -> chatSessions

/**
 * Initialize data from local storage
 */
export const initializeProjectData = (): void => {
  try {
    // Load projects
    const storedProjects = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (storedProjects) {
      projects = JSON.parse(storedProjects);
      // Convert string dates back to Date objects
      projects.forEach(project => {
        project.createdAt = new Date(project.createdAt);
        project.updatedAt = new Date(project.updatedAt);
      });
    }

    // Load documents
    const storedDocuments = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    if (storedDocuments) {
      documents = JSON.parse(storedDocuments);
      // Convert string dates back to Date objects
      Object.values(documents).forEach(docList => {
        docList.forEach(doc => {
          doc.createdAt = new Date(doc.createdAt);
        });
      });
    }

    // Load chat sessions
    const storedChats = localStorage.getItem(CHATS_STORAGE_KEY);
    if (storedChats) {
      chatSessions = JSON.parse(storedChats);
      // Convert string dates back to Date objects
      Object.values(chatSessions).forEach(chatList => {
        chatList.forEach(chat => {
          chat.createdAt = new Date(chat.createdAt);
          chat.updatedAt = new Date(chat.updatedAt);
          chat.messages.forEach(msg => {
            msg.timestamp = new Date(msg.timestamp);
          });
        });
      });
    }

    console.log('Project data loaded from local storage');
  } catch (error) {
    console.error('Error loading project data from local storage:', error);
    // Initialize with empty data if there's an error
    projects = [];
    documents = {};
    chatSessions = {};
  }
};

/**
 * Save all data to local storage
 */
const saveToLocalStorage = (): void => {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(documents));
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chatSessions));
  } catch (error) {
    console.error('Error saving to local storage:', error);
  }
};

// Project Management

/**
 * Create a new project
 */
export const createProject = (name: string, description: string = ''): Project => {
  const newProject: Project = {
    id: uuidv4(),
    name,
    description,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  projects.push(newProject);
  
  // Initialize empty document and chat arrays for this project
  documents[newProject.id] = [];
  chatSessions[newProject.id] = [];
  
  saveToLocalStorage();
  return newProject;
};

/**
 * Get all projects
 */
export const getAllProjects = (): Project[] => {
  return [...projects];
};

/**
 * Get a project by ID
 */
export const getProjectById = (projectId: string): Project | null => {
  return projects.find(p => p.id === projectId) || null;
};

/**
 * Update a project
 */
export const updateProject = (projectId: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Project | null => {
  const projectIndex = projects.findIndex(p => p.id === projectId);
  if (projectIndex === -1) return null;

  const updatedProject = {
    ...projects[projectIndex],
    ...updates,
    updatedAt: new Date()
  };

  projects[projectIndex] = updatedProject;
  saveToLocalStorage();
  return updatedProject;
};

/**
 * Delete a project and all its associated data
 */
export const deleteProject = (projectId: string): boolean => {
  const initialLength = projects.length;
  projects = projects.filter(p => p.id !== projectId);
  
  if (projects.length < initialLength) {
    // Delete associated documents and chats
    delete documents[projectId];
    delete chatSessions[projectId];
    
    saveToLocalStorage();
    return true;
  }
  
  return false;
};

// Document Management

/**
 * Add a document to a project
 */
export const addDocumentToProject = (projectId: string, document: DocumentInfo): boolean => {
  const project = getProjectById(projectId);
  if (!project) {
    console.error(`Project ${projectId} not found when adding document ${document.id}`);
    return false;
  }

  if (!documents[projectId]) {
    documents[projectId] = [];
  }

  // Check if document already exists to avoid duplicates
  const existingDocIndex = documents[projectId].findIndex(doc => doc.id === document.id);
  if (existingDocIndex >= 0) {
    console.log(`Document ${document.id} already exists in project ${projectId}, updating instead of adding`);
    documents[projectId][existingDocIndex] = document;
  } else {
    documents[projectId].push(document);
    console.log(`Added document ${document.id} to project ${projectId}`);
  }
  
  // Update project's updatedAt timestamp
  updateProject(projectId, {});
  
  saveToLocalStorage();
  return true;
};

/**
 * Get all documents for a project
 */
export const getProjectDocuments = (
  projectId: string,
  page: number = 1,
  pageSize: number = 10
): { documents: DocumentInfo[], total: number } => {
  const projectDocs = documents[projectId] || [];
  
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedDocs = projectDocs.slice(startIndex, endIndex);
  
  return {
    documents: paginatedDocs,
    total: projectDocs.length
  };
};

/**
 * Delete document from a project
 */
export const deleteDocumentFromProject = async (projectId: string, documentId: string): Promise<boolean> => {
  const project = getProjectById(projectId);
  if (!project) {
    console.error(`Project ${projectId} not found when deleting document ${documentId}`);
    return Promise.resolve(false);
  }
  
  if (!documents[projectId]) {
    console.error(`No documents found for project ${projectId}`);
    return Promise.resolve(false);
  }
  
  // Find document in project
  const documentIndex = documents[projectId].findIndex(doc => doc.id === documentId);
  if (documentIndex === -1) {
    console.error(`Document ${documentId} not found in project ${projectId}`);
    return Promise.resolve(false);
  }
  
  try {
    // First delete from vector store to ensure embeddings are removed
    const { deleteDocumentChunks } = await import('./vectorStore');
    const deletedCount = deleteDocumentChunks(documentId);
    console.log(`Deleted ${deletedCount} embeddings for document ${documentId}`);
    
    // Then remove from document management
    const documentToDelete = documents[projectId][documentIndex];
    documents[projectId].splice(documentIndex, 1);
    
    // Update project's updatedAt timestamp
    updateProject(projectId, {});
    
    saveToLocalStorage();
    
    return Promise.resolve(true);
  } catch (error) {
    console.error(`Failed to delete document ${documentId} from project ${projectId}:`, error);
    return Promise.resolve(false);
  }
};

// Chat Session Management

/**
 * Create a new chat session for a project
 */
export const createChatSession = (projectId: string, name: string = ''): ChatSession | null => {
  const project = getProjectById(projectId);
  if (!project) return null;

  if (!chatSessions[projectId]) {
    chatSessions[projectId] = [];
  }

  // Generate a default chat name if none provided
  const chatName = name || `Chat ${new Date().toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`;

  const newChat: ChatSession = {
    id: uuidv4(),
    projectId,
    name: chatName,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  chatSessions[projectId].push(newChat);
  
  // Update project's updatedAt timestamp
  updateProject(projectId, {});
  
  saveToLocalStorage();
  return newChat;
};

/**
 * Get all chat sessions for a project
 */
export const getProjectChatSessions = (projectId: string): ChatSession[] => {
  return chatSessions[projectId] || [];
};

/**
 * Get a chat session by ID
 */
export const getChatSessionById = (projectId: string, chatId: string): ChatSession | null => {
  if (!chatSessions[projectId]) return null;
  return chatSessions[projectId].find(chat => chat.id === chatId) || null;
};

/**
 * Add a message to a chat session
 */
export const addMessageToChatSession = (
  projectId: string,
  chatId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): ChatMessage | null => {
  const chat = getChatSessionById(projectId, chatId);
  if (!chat) return null;

  const newMessage: ChatMessage = {
    id: uuidv4(),
    role,
    content,
    timestamp: new Date()
  };

  chat.messages.push(newMessage);
  chat.updatedAt = new Date();
  
  // Update project's updatedAt timestamp
  updateProject(projectId, {});
  
  saveToLocalStorage();
  return newMessage;
};

/**
 * Delete a chat session
 */
export const deleteChatSession = (projectId: string, chatId: string): boolean => {
  if (!chatSessions[projectId]) return false;
  
  const initialLength = chatSessions[projectId].length;
  chatSessions[projectId] = chatSessions[projectId].filter(chat => chat.id !== chatId);
  
  if (chatSessions[projectId].length < initialLength) {
    // Update project's updatedAt timestamp
    updateProject(projectId, {});
    
    saveToLocalStorage();
    return true;
  }
  
  return false;
};

/**
 * Rename a chat session
 */
export const renameChatSession = (projectId: string, chatId: string, newName: string): boolean => {
  const chat = getChatSessionById(projectId, chatId);
  if (!chat) return false;

  chat.name = newName;
  chat.updatedAt = new Date();
  
  // Update project's updatedAt timestamp
  updateProject(projectId, {});
  
  saveToLocalStorage();
  return true;
}; 