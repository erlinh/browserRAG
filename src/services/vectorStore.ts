/**
 * Simple in-memory vector database for storing and querying embeddings
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

/**
 * Initialize the vector store
 */
export const initializeVectorStore = async (): Promise<void> => {
  try {
    console.log('Initializing vector store...');
    // Reset the store
    documents = [];
    isInitialized = true;
    console.log('Vector store initialized');
    return Promise.resolve();
  } catch (error) {
    console.error('Failed to initialize vector store:', error);
    return Promise.reject(error);
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

  try {
    // Add each embedding as a document chunk
    for (let i = 0; i < chunkIds.length; i++) {
      documents.push({
        id: chunkIds[i],
        embedding: embeddings[i],
        text: texts[i],
        metadata: metadatas[i],
      });
    }
    
    console.log(`Stored ${chunkIds.length} chunks for document: ${documentId}`);
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
  if (!isInitialized || documents.length === 0) {
    return [];
  }

  try {
    // Filter documents by project if projectId is provided
    const docsToSearch = projectId 
      ? documents.filter(doc => doc.metadata.projectId === projectId)
      : documents;
    
    if (docsToSearch.length === 0) {
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
  
  return deletedCount;
};

/**
 * Delete all document chunks for a project
 */
export const deleteProjectChunks = (projectId: string): number => {
  const initialLength = documents.length;
  documents = documents.filter(doc => doc.metadata.projectId !== projectId);
  return initialLength - documents.length;
};

/**
 * Clear all data from the vector store
 */
export const clearVectorStore = (): void => {
  documents = [];
  console.log('Vector store cleared');
};

/**
 * Get the count of documents in the store
 */
export const getDocumentCount = (projectId?: string): number => {
  if (projectId) {
    return documents.filter(doc => doc.metadata.projectId === projectId).length;
  }
  return documents.length;
}; 