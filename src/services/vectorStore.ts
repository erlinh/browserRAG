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
const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same dimensions');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
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
  limit: number = 5
): Promise<{ id: string; text: string; score: number; metadata: Record<string, any> }[]> => {
  if (!isInitialized || documents.length === 0) {
    return [];
  }

  try {
    // Compute similarity scores for all documents
    const results = documents.map(doc => ({
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
 * Clear all data from the vector store
 */
export const clearVectorStore = (): void => {
  documents = [];
  console.log('Vector store cleared');
};

/**
 * Get the count of documents in the store
 */
export const getDocumentCount = (): number => {
  return documents.length;
}; 