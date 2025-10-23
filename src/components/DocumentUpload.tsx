import { useState, useRef, ChangeEvent } from 'react';
import { processPdfDocument, processCsvDocument } from '../services/documentService';
import { DocumentInfo } from '../services/documentManagementService';
import { useProvider } from '../contexts/ProviderContext';
import './DocumentUpload.css';

interface DocumentUploadProps {
  isDbReady: boolean;
  documents: DocumentInfo[];
  projectId: string;
  onDocumentProcessed: (documentId: string, documentName: string) => void;
  onDeleteDocument: (documentId: string) => void;
  currentPage: number;
  totalDocuments: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ 
  isDbReady, 
  documents, 
  projectId,
  onDocumentProcessed,
  onDeleteDocument,
  currentPage,
  totalDocuments,
  pageSize,
  onPageChange
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [currentChunk, setCurrentChunk] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [processingDetails, setProcessingDetails] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Get provider context
  const { provider, config } = useProvider();

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setErrorMessage(null);
    setIsProcessing(true);
    setUploadProgress(0);
    setProcessingStatus('');
    setCurrentChunk(0);
    setTotalChunks(0);
    setProcessingDetails([]);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop()?.toLowerCase();
        const fileType = fileExtension || '';
        
        console.log(`Processing file: ${fileName}, detected type: ${fileType}, MIME type: ${file.type}`);
        
        // Update progress
        setUploadProgress(Math.round((i / files.length) * 50));
        
        // Add processing detail
        setProcessingDetails(prev => [...prev, `Starting to process ${fileName} (${file.size} bytes)`]);
        
        if (fileType === 'pdf') {
          setProcessingStatus('Processing PDF document...');
          const embeddingModelId = provider === 'lmstudio' ? config.selectedLMStudioEmbeddingModel : undefined;
          const documentInfo = await processPdfDocument(
            projectId, 
            file, 
            (progress: number) => {
              // Map processing progress from 0-100 to 50-100 for the total progress
              setUploadProgress(50 + Math.round(progress * 0.5));
              
              // Add embedding details at key points
              if (progress === 25) {
                setProcessingDetails(prev => [...prev, `Extracting text from PDF pages...`]);
              } else if (progress === 50) {
                setProcessingDetails(prev => [...prev, `PDF text extracted, generating embeddings...`]);
              } else if (progress === 75) {
                setProcessingDetails(prev => [...prev, `Storing document embeddings in vector database...`]);
              }
            },
            provider,
            embeddingModelId
          );
          
          // Verify embeddings immediately after processing
          try {
            const { verifyEmbeddings } = await import('../services/vectorStore');
            const verification = verifyEmbeddings(documentInfo.id, projectId);
            if (verification.exists) {
              setProcessingDetails(prev => [...prev, 
                `✅ Document processed successfully with ${verification.count} embeddings.`
              ]);
            } else {
              setProcessingDetails(prev => [...prev, 
                `⚠️ Warning: Document processed but embeddings verification failed. Chat may not work properly.`
              ]);
            }
          } catch (error) {
            console.error('Error verifying document embeddings:', error);
          }
          
          setProcessingDetails(prev => [...prev, `Document processed and saved with ID: ${documentInfo.id}`]);
          onDocumentProcessed(documentInfo.id, documentInfo.name);
        } else if (fileType === 'csv') {
          setProcessingStatus('Processing CSV document...');
          
          // Track processed chunks for CSV files
          let processedChunks = 0;
          const estimatedChunks = Math.ceil(file.size / 50000); // Rough estimate based on file size
          setTotalChunks(estimatedChunks > 0 ? estimatedChunks : 1);
          
          const embeddingModelId = provider === 'lmstudio' ? config.selectedLMStudioEmbeddingModel : undefined;
          const documentInfo = await processCsvDocument(
            projectId, 
            file, 
            (progress: number, chunkInfo?: { current: number, total: number }) => {
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
              
              // Add details on chunk processing
              if (chunkInfo.current % 5 === 0 || chunkInfo.current === 1) {
                setProcessingDetails(prev => [...prev, `Processing CSV chunk ${chunkInfo.current} of ${chunkInfo.total || 'unknown'}`]);
              }
            }
            
            // Calculate overall progress, balancing between parsing (50%) and embedding (50%)
            setUploadProgress(50 + Math.round(progress * 0.5));
          },
          provider,
          embeddingModelId
          );
          
          // Verify embeddings immediately after processing
          try {
            const { verifyEmbeddings } = await import('../services/vectorStore');
            const verification = verifyEmbeddings(documentInfo.id, projectId);
            if (verification.exists) {
              setProcessingDetails(prev => [...prev, 
                `✅ Document processed successfully with ${verification.count} embeddings.`
              ]);
            } else {
              setProcessingDetails(prev => [...prev, 
                `⚠️ Warning: Document processed but embeddings verification failed. Chat may not work properly.`
              ]);
            }
          } catch (error) {
            console.error('Error verifying document embeddings:', error);
          }
          
          setProcessingDetails(prev => [...prev, `CSV document processed and saved with ID: ${documentInfo.id}`]);
          onDocumentProcessed(documentInfo.id, documentInfo.name);
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

  const handleDeleteClick = (documentId: string) => {
    console.log(`Attempting to delete document with ID: ${documentId}`);
    if (window.confirm('Are you sure you want to delete this document?')) {
      console.log(`Confirmed deletion of document: ${documentId}`);
      onDeleteDocument(documentId);
    }
  };

  // Calculate pagination values
  const totalPages = Math.ceil(totalDocuments / pageSize);
  
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
    return (
      <div className="pagination">
        <button 
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="pagination-button"
        >
          &laquo;
        </button>
        
        <button 
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="pagination-button"
        >
          &lsaquo;
        </button>
        
        <span className="pagination-info">
          Page {currentPage} of {totalPages}
        </span>
        
        <button 
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="pagination-button"
        >
          &rsaquo;
        </button>
        
        <button 
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="pagination-button"
        >
          &raquo;
        </button>
      </div>
    );
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
        
        {processingDetails.length > 0 && (
          <div className="processing-details">
            <h4>Processing Details</h4>
            <details>
              <summary>Show processing log ({processingDetails.length} events)</summary>
              <ul className="details-list">
                {processingDetails.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </div>

      {documents.length > 0 || totalDocuments > 0 ? (
        <div className="documents-list">
          <h3>Uploaded Documents</h3>
          {documents.length > 0 ? (
            <>
              <ul>
                {documents.map((doc) => (
                  <li key={doc.id} className="document-item">
                    <div className="document-info">
                      <span className="document-name">{doc.name}</span>
                      <span className="document-type">{doc.type.toUpperCase()}</span>
                      <span className="document-date">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <button 
                      className="delete-button"
                      onClick={() => handleDeleteClick(doc.id)}
                      aria-label="Delete document"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
              {renderPagination()}
            </>
          ) : (
            <p className="no-documents">No documents on this page</p>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default DocumentUpload; 