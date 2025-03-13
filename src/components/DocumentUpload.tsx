import { useState, useRef, ChangeEvent } from 'react';
import { processPdfDocument, processCsvDocument } from '../services/documentService';
import './DocumentUpload.css';

interface DocumentUploadProps {
  isDbReady: boolean;
  documents: string[];
  onDocumentProcessed: (docName: string) => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ 
  isDbReady, 
  documents, 
  onDocumentProcessed 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setErrorMessage(null);
    setIsProcessing(true);
    setUploadProgress(0);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;
        const fileType = fileName.split('.').pop()?.toLowerCase();
        
        // Update progress
        setUploadProgress(Math.round((i / files.length) * 50));
        
        if (fileType === 'pdf') {
          await processPdfDocument(file, (progress: number) => {
            // Map processing progress from 0-100 to 50-100 for the total progress
            setUploadProgress(50 + Math.round(progress * 0.5));
          });
          onDocumentProcessed(fileName);
        } else if (fileType === 'csv') {
          await processCsvDocument(file, (progress: number) => {
            setUploadProgress(50 + Math.round(progress * 0.5));
          });
          onDocumentProcessed(fileName);
        } else {
          throw new Error(`Unsupported file type: ${fileType}. Please upload PDF or CSV files only.`);
        }
      }
      
      setUploadProgress(100);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error processing document:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process document');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="document-upload">
      <div className="upload-area">
        <h2>Upload Documents</h2>
        <p>Upload PDF or CSV files to chat with their contents</p>
        
        <div className="file-input-container">
          <input
            type="file"
            accept=".pdf,.csv"
            multiple
            onChange={handleFileChange}
            disabled={!isDbReady || isProcessing}
            ref={fileInputRef}
            id="file-input"
            className="file-input"
          />
          <label 
            htmlFor="file-input" 
            className={`file-input-label ${(!isDbReady || isProcessing) ? 'disabled' : ''}`}
          >
            {isProcessing ? 'Processing...' : 'Choose Files'}
          </label>
          <p className="file-format-note">Supported formats: PDF, CSV</p>
        </div>
        
        {isProcessing && (
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="progress-text">{uploadProgress}% complete</p>
          </div>
        )}
        
        {errorMessage && (
          <div className="error-message">
            {errorMessage}
          </div>
        )}
      </div>

      {documents.length > 0 && (
        <div className="documents-list">
          <h3>Uploaded Documents</h3>
          <ul>
            {documents.map((doc, index) => (
              <li key={index}>{doc}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload; 