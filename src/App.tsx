import { useState, useEffect } from 'react';
import DocumentUpload from './components/DocumentUpload';
import Chat from './components/Chat';
import { initializeVectorStore } from './services/vectorStore';
import { useModel } from './contexts/ModelContext';
import { getDocuments, DocumentInfo, deleteDocument } from './services/documentManagementService';
import './App.css';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [pageSize] = useState(5); // Number of documents per page
  const { selectedModel } = useModel();

  useEffect(() => {
    const setupDatabase = async () => {
      try {
        await initializeVectorStore();
        setIsDbReady(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    setupDatabase();
  }, []);

  // Load documents when page changes
  useEffect(() => {
    const loadDocuments = () => {
      const result = getDocuments(currentPage, pageSize);
      setDocuments(result.documents);
      setTotalDocuments(result.total);
    };

    loadDocuments();
  }, [currentPage, pageSize]);

  const handleDocumentUpload = (documentId: string, documentName: string) => {
    // Refresh document list after upload
    const result = getDocuments(currentPage, pageSize);
    setDocuments(result.documents);
    setTotalDocuments(result.total);
  };

  const handleDeleteDocument = (documentId: string) => {
    const success = deleteDocument(documentId);
    if (success) {
      // Refresh document list
      const result = getDocuments(currentPage, pageSize);
      setDocuments(result.documents);
      setTotalDocuments(result.total);
      
      // If current page is now empty (except for the last page), go to previous page
      if (result.documents.length === 0 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Convert DocumentInfo[] to string[] for Chat component
  const documentNames = documents.map(doc => doc.name);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>BrowserRAG</h1>
        <p>Chat with your documents entirely in your browser</p>
      </header>

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
          />
        ) : (
          <Chat documents={documentNames} />
        )}
      </main>

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