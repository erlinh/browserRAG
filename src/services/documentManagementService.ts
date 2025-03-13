import { clearVectorStore } from './vectorStore';

// Interface for document metadata
export interface DocumentInfo {
  id: string;
  name: string;
  createdAt: Date;
  type: string;
}

// Mock document storage (in a real app, this would be persistent)
let documents: DocumentInfo[] = [];

/**
 * Add a document to the store
 */
export const addDocument = (documentId: string, documentName: string): void => {
  const fileType = documentName.split('.').pop()?.toLowerCase() || 'unknown';
  
  documents.push({
    id: documentId,
    name: documentName,
    createdAt: new Date(),
    type: fileType
  });
};

/**
 * Get all documents with pagination
 */
export const getDocuments = (
  page: number = 1, 
  pageSize: number = 10
): { documents: DocumentInfo[], total: number } => {
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedDocs = documents.slice(startIndex, endIndex);
  
  return {
    documents: paginatedDocs,
    total: documents.length
  };
};

/**
 * Get document ID by name
 */
export const getDocumentIdByName = (documentName: string): string | null => {
  const document = documents.find(doc => doc.name === documentName);
  return document ? document.id : null;
};

/**
 * Delete a document by ID
 */
export const deleteDocument = (documentId: string): boolean => {
  const initialLength = documents.length;
  documents = documents.filter(doc => doc.id !== documentId);
  
  // If document was found and removed
  if (documents.length < initialLength) {
    // In a real implementation, we would also remove the document chunks
    // from the vector store based on documentId, but for simplicity
    // we're just logging this action here.
    console.log(`Deleted document with ID: ${documentId}`);
    return true;
  }
  
  return false;
};

/**
 * Get total document count
 */
export const getDocumentCount = (): number => {
  return documents.length;
};

/**
 * Clear all documents
 */
export const clearAllDocuments = (): void => {
  documents = [];
  clearVectorStore();
}; 