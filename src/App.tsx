import { useState, useEffect } from 'react';
import DocumentUpload from './components/DocumentUpload';
import Chat from './components/Chat';
import { initializeVectorStore } from './services/vectorStore';
import './App.css';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [documents, setDocuments] = useState<string[]>([]);

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

  const handleDocumentUpload = (newDocName: string) => {
    setDocuments(prev => [...prev, newDocName]);
  };

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
          disabled={documents.length === 0}
        >
          Chat
        </button>
      </nav>

      <main className="app-content">
        {activeTab === 'upload' ? (
          <DocumentUpload 
            isDbReady={isDbReady} 
            onDocumentProcessed={handleDocumentUpload} 
            documents={documents}
          />
        ) : (
          <Chat documents={documents} />
        )}
      </main>

      <footer className="app-footer">
        <p>All processing happens in your browser - your data never leaves your device</p>
      </footer>
    </div>
  );
}

export default App; 