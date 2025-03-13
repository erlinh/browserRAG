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
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [currentChunk, setCurrentChunk] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setErrorMessage(null);
    setIsProcessing(true);
    setUploadProgress(0);
    setProcessingStatus('');
    setCurrentChunk(0);
    setTotalChunks(0);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;
        const fileType = fileName.split('.').pop()?.toLowerCase();
        
        // Update progress
        setUploadProgress(Math.round((i / files.length) * 50));
        
        if (fileType === 'pdf') {
          setProcessingStatus('Processing PDF document...');
          await processPdfDocument(file, (progress: number) => {
            // Map processing progress from 0-100 to 50-100 for the total progress
            setUploadProgress(50 + Math.round(progress * 0.5));
          });
          onDocumentProcessed(fileName);
        } else if (fileType === 'csv') {
          setProcessingStatus('Processing CSV document...');
          
          // Track processed chunks for CSV files
          let processedChunks = 0;
          const estimatedChunks = Math.ceil(file.size / 50000); // Rough estimate based on file size
          setTotalChunks(estimatedChunks > 0 ? estimatedChunks : 1);
          
          await processCsvDocument(file, (progress: number, chunkInfo?: { current: number, total: number }) => {
            // If we have chunk info, update the status message
            if (chunkInfo) {
              setCurrentChunk(chunkInfo.current);
              if (chunkInfo.total > 0) {
                setTotalChunks(chunkInfo.total);
              }
              // Only increment processed chunks when a new chunk starts processing
              if (chunkInfo.current > processedChunks) {
                processedChunks = chunkInfo.current;
              }
              setProcessingStatus(`Processing CSV (Chunk ${chunkInfo.current} of ${chunkInfo.total === 0 ? 'unknown' : chunkInfo.total})...`);
            }
            
            // Calculate overall progress, balancing between parsing (50%) and embedding (50%)
            setUploadProgress(50 + Math.round(progress * 0.5));
          });
          onDocumentProcessed(fileName);
        } else {
          throw new Error(`Unsupported file type: ${fileType}. Please upload PDF or CSV files only.`);
        }
      }
      
      setUploadProgress(100);
      setProcessingStatus('Complete!');
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Reset status message after a brief delay
      setTimeout(() => {
        if (!isProcessing) {
          setProcessingStatus('');
        }
      }, 1500);
      
    } catch (error) {
      console.error('Error processing document:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process document');
      setProcessingStatus('Error processing document');
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
            <div className="progress-details">
              <p className="progress-text">{uploadProgress}% complete</p>
              {processingStatus && (
                <p className="progress-status">{processingStatus}</p>
              )}
              {currentChunk > 0 && totalChunks > 0 && (
                <p className="progress-chunks">
                  Processing in chunks to prevent browser freezing ({currentChunk} of {totalChunks})
                </p>
              )}
            </div>
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