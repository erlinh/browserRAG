/**
 * Simple vector database for storing and querying embeddings with localStorage persistence
 */

interface DocumentChunk {
  id: string;
  embedding: number[];
  text: string;
  metadata: Record<string, any>;
}

// In-memory storage
let documents: DocumentChunk[] = [];
let isInitialized = false;

// Storage key for localStorage
const VECTOR_STORE_KEY = 'browserrag_vector_store';

/**
 * Initialize the vector store
 */
export const initializeVectorStore = async (): Promise<void> => {
  try {
    console.log('Initializing vector store...');
    
    // Try to load existing data from localStorage
    const storedData = localStorage.getItem(VECTOR_STORE_KEY);
    if (storedData) {
      try {
        documents = JSON.parse(storedData);
        console.log(`Loaded ${documents.length} document chunks from localStorage`);
      } catch (parseError) {
        console.error('Failed to parse stored vector data, starting fresh:', parseError);
        documents = [];
      }
    } else {
      console.log('No stored vector data found, starting fresh');
      documents = [];
    }
    
    isInitialized = true;
    console.log('Vector store initialized');
    return Promise.resolve();
  } catch (error) {
    console.error('Failed to initialize vector store:', error);
    return Promise.reject(error);
  }
};

/**
 * Save the current vector store to localStorage
 */
const persistToStorage = (): void => {
  try {
    localStorage.setItem(VECTOR_STORE_KEY, JSON.stringify(documents));
    console.log(`Persisted ${documents.length} document chunks to localStorage`);
  } catch (error) {
    // Handle potential localStorage quota exceeded error
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded. Some document embeddings may not be saved.');
    } else {
      console.error('Failed to persist vector store:', error);
    }
  }
};

/**
 * Store document embeddings in the vector store
 */
export const storeEmbeddings = async (
  documentId: string,
  chunkIds: string[],
  embeddings: number[][],
  texts: string[],
  metadatas: Record<string, any>[]
): Promise<void> => {
  if (!isInitialized) {
    await initializeVectorStore();
  }

  if (!documentId) {
    console.error('Invalid documentId provided to storeEmbeddings');
    throw new Error('Invalid documentId');
  }

  try {
    console.log(`Storing ${chunkIds.length} embeddings for document ${documentId}`);
    
    // Validate inputs
    if (!Array.isArray(chunkIds) || !Array.isArray(embeddings) || !Array.isArray(texts) || !Array.isArray(metadatas)) {
      throw new Error('Invalid input: arrays expected for chunkIds, embeddings, texts, and metadatas');
    }
    
    if (chunkIds.length !== embeddings.length || chunkIds.length !== texts.length || chunkIds.length !== metadatas.length) {
      throw new Error('Input arrays must have the same length');
    }
    
    // Add each embedding as a document chunk
    for (let i = 0; i < chunkIds.length; i++) {
      // Ensure projectId exists in metadata
      if (!metadatas[i].projectId) {
        console.warn(`Missing projectId in metadata for chunk ${chunkIds[i]}, using "unknown"`);
        metadatas[i].projectId = "unknown";
      }
      
      documents.push({
        id: chunkIds[i],
        embedding: embeddings[i],
        text: texts[i],
        metadata: metadatas[i],
      });
    }
    
    console.log(`Stored ${chunkIds.length} chunks for document: ${documentId}`);
    console.log(`Total chunks in store: ${documents.length}`);
    
    // Persist to localStorage
    persistToStorage();
  } catch (error) {
    console.error(`Failed to store embeddings for document ${documentId}:`, error);
    throw error;
  }
};

/**
 * Compute cosine similarity between two vectors
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Query the vector store for similar documents
 */
export const queryEmbeddings = async (
  queryEmbedding: number[],
  limit: number = 5,
  projectId?: string
): Promise<{ id: string; text: string; score: number; metadata: Record<string, any> }[]> => {
  if (!isInitialized) {
    try {
      await initializeVectorStore();
    } catch (error) {
      console.error('Failed to initialize vector store during query:', error);
      return [];
    }
  }

  if (documents.length === 0) {
    console.log('Vector store is empty, no documents to search');
    return [];
  }

  try {
    console.log(`Querying for similar documents with projectId: ${projectId || 'none'}`);
    console.log(`Total documents in store: ${documents.length}`);
    
    // Filter documents by project if projectId is provided
    const docsToSearch = projectId 
      ? documents.filter(doc => doc.metadata?.projectId === projectId)
      : documents;
    
    console.log(`After filtering by projectId: ${docsToSearch.length} documents to search`);
    
    if (docsToSearch.length === 0) {
      if (projectId) {
        console.log(`No documents found for projectId: ${projectId}`);
        // Log some examples of projectIds that do exist for debugging
        const existingProjectIds = [...new Set(documents.map(doc => doc.metadata?.projectId))];
        console.log(`Available projectIds: ${existingProjectIds.join(', ')}`);
      }
      return [];
    }
    
    // Compute similarity scores for all documents
    const results = docsToSearch.map(doc => ({
      id: doc.id,
      text: doc.text,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
      metadata: doc.metadata,
    }));
    
    // Sort by similarity score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    // Log top scores for debugging
    if (results.length > 0) {
      console.log(`Top similarity scores: ${results.slice(0, Math.min(3, results.length))
        .map(r => r.score.toFixed(4))
        .join(', ')}`);
    }
    
    // Return top results
    return results.slice(0, limit);
  } catch (error) {
    console.error('Failed to query embeddings:', error);
    throw error;
  }
};

/**
 * Delete document chunks by document ID
 */
export const deleteDocumentChunks = (documentId: string): number => {
  console.log(`Deleting chunks for document ${documentId} from vector store`);
  console.log(`Vector store has ${documents.length} chunks before deletion`);
  
  const initialLength = documents.length;
  documents = documents.filter(doc => doc.metadata.documentId !== documentId);
  
  const deletedCount = initialLength - documents.length;
  console.log(`Deleted ${deletedCount} chunks for document ${documentId}`);
  
  // Persist changes to localStorage
  persistToStorage();
  
  return deletedCount;
};

/**
 * Delete all document chunks for a project
 */
export const deleteProjectChunks = (projectId: string): number => {
  const initialLength = documents.length;
  documents = documents.filter(doc => doc.metadata.projectId !== projectId);
  
  const deletedCount = initialLength - documents.length;
  console.log(`Deleted ${deletedCount} chunks for project ${projectId}`);
  
  // Persist changes to localStorage
  persistToStorage();
  
  return deletedCount;
};

/**
 * Clear all data from the vector store
 */
export const clearVectorStore = (): void => {
  documents = [];
  console.log('Vector store cleared');
  
  // Clear localStorage
  localStorage.removeItem(VECTOR_STORE_KEY);
  console.log('Vector store data removed from localStorage');
};

/**
 * Get the count of documents in the store
 */
export const getDocumentCount = (projectId?: string): number => {
  if (projectId) {
    return documents.filter(doc => doc.metadata?.projectId === projectId).length;
  }
  return documents.length;
};

/**
 * Verify document embeddings exist for a specific document or project
 */
export const verifyEmbeddings = (documentId?: string, projectId?: string): {
  exists: boolean;
  count: number;
  details?: any;
} => {
  let filteredDocs = [...documents];
  
  if (documentId) {
    filteredDocs = filteredDocs.filter(doc => doc.metadata.documentId === documentId);
  }
  
  if (projectId) {
    filteredDocs = filteredDocs.filter(doc => doc.metadata.projectId === projectId);
  }
  
  const exists = filteredDocs.length > 0;
  const count = filteredDocs.length;
  
  // For debugging, include sample of document IDs
  const details = {
    sampleDocIds: filteredDocs.slice(0, 3).map(d => d.id),
    totalDocsInStore: documents.length
  };
  
  return { exists, count, details };
}; 