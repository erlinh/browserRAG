import * as pdfjs from 'pdfjs-dist';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { generateEmbeddings } from './embeddingService';
import { storeEmbeddings } from './vectorStore';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    documentId: string;
    documentName: string;
    chunkIndex: number;
    pageNumber?: number;
    rowIndex?: number;
  };
}

/**
 * Split text into chunks of roughly equal size
 */
const chunkText = (text: string, chunkSize: number = 1000, overlap: number = 200): string[] => {
  if (!text || text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    // Find the end of the current chunk
    let endIndex = startIndex + chunkSize;
    if (endIndex >= text.length) {
      // Last chunk
      endIndex = text.length;
    } else {
      // Try to end at a sentence or paragraph break
      const possibleBreakPoints = [
        text.lastIndexOf('. ', Math.min(endIndex, text.length)),
        text.lastIndexOf('.\n', Math.min(endIndex, text.length)),
        text.lastIndexOf('\n\n', Math.min(endIndex, text.length))
      ].filter(index => index > startIndex);

      if (possibleBreakPoints.length > 0) {
        // Use the last break point found before the endIndex
        endIndex = Math.max(...possibleBreakPoints) + 1;
      }
    }

    chunks.push(text.substring(startIndex, endIndex).trim());
    
    // Move startIndex with overlap
    startIndex = endIndex - overlap;
    
    // If we're very close to the end, just include the rest
    if (text.length - startIndex < chunkSize / 2) {
      if (startIndex < text.length) {
        chunks.push(text.substring(startIndex).trim());
      }
      break;
    }
  }

  return chunks;
};

/**
 * Process a PDF document
 */
export const processPdfDocument = async (
  file: File,
  progressCallback?: (progress: number) => void
): Promise<void> => {
  const documentId = uuidv4();
  const fileName = file.name;
  
  try {
    // Load the PDF file
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(new Uint8Array(arrayBuffer)).promise;
    
    // Extract text from each page and collect as chunks
    const chunks: DocumentChunk[] = [];
    const numPages = pdf.numPages;
    
    for (let i = 1; i <= numPages; i++) {
      if (progressCallback) {
        progressCallback(Math.round((i - 1) / numPages * 50));
      }
      
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Combine text items into a single string
      const pageText = textContent.items
        .map((item: any) => 'str' in item ? item.str : '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Split page text into chunks
      const pageChunks = chunkText(pageText);
      
      // Create document chunks with metadata
      pageChunks.forEach((text, index) => {
        chunks.push({
          id: `${documentId}-page-${i}-chunk-${index}`,
          text: text,
          metadata: {
            documentId,
            documentName: fileName,
            pageNumber: i,
            chunkIndex: chunks.length,
          }
        });
      });
    }
    
    if (progressCallback) {
      progressCallback(50);
    }
    
    // Generate embeddings for all chunks
    const texts = chunks.map(chunk => chunk.text);
    const embeddings = await generateEmbeddings(texts, (progress) => {
      if (progressCallback) {
        // Map progress from 0-100 to 50-90
        progressCallback(50 + Math.round(progress * 0.4));
      }
    });
    
    // Store embeddings in vector store
    await storeEmbeddings(
      documentId,
      chunks.map(chunk => chunk.id),
      embeddings,
      texts,
      chunks.map(chunk => chunk.metadata)
    );
    
    if (progressCallback) {
      progressCallback(100);
    }
    
  } catch (error) {
    console.error(`Error processing PDF document ${fileName}:`, error);
    throw error;
  }
};

/**
 * Process a CSV document
 */
export const processCsvDocument = async (
  file: File,
  progressCallback?: (progress: number, chunkInfo?: { current: number, total: number }) => void
): Promise<void> => {
  const documentId = uuidv4();
  const fileName = file.name;
  
  return new Promise<void>((resolve, reject) => {
    // Use incremental processing for large files
    const chunkSize = 100; // Process chunks of 100 rows at a time
    let currentChunk: DocumentChunk[] = [];
    let processedRows = 0;
    let totalRows = 0;
    let headers: string[] = [];
    let chunkCounter = 0;
    let estimatedTotalChunks = 0;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      // Remove the worker option as it's causing "Not implemented" error
      step: async (results, parser) => {
        try {
          if (!results.data || typeof results.data !== 'object') {
            return;
          }
          
          // Get headers if this is the first row
          if (headers.length === 0 && results.meta && results.meta.fields) {
            headers = results.meta.fields;
          }
          
          totalRows++;
          
          // Estimate total chunks based on file size and average row size
          if (totalRows === 1) {
            const avgRowSize = results.meta.cursor / totalRows;
            estimatedTotalChunks = Math.ceil(file.size / (avgRowSize * chunkSize));
          }
          
          const row = results.data as Record<string, any>;
          
          // Create a text representation of the row
          let rowText = '';
          
          // Add headers and values
          for (const header of headers) {
            if (row[header]) {
              rowText += `${header}: ${row[header]}\n`;
            }
          }
          
          if (rowText.trim()) {
            currentChunk.push({
              id: `${documentId}-row-${processedRows}`,
              text: rowText.trim(),
              metadata: {
                documentId,
                documentName: fileName,
                rowIndex: processedRows,
                chunkIndex: processedRows,
              }
            });
          }
          
          processedRows++;
          
          // If we have enough chunks, process them
          if (currentChunk.length >= chunkSize) {
            // Pause parsing while we process this chunk
            parser.pause();
            
            // Increment chunk counter
            chunkCounter++;
            
            if (progressCallback) {
              // Calculate progress based on rows processed
              const rowProgress = Math.min(30, Math.round((processedRows / (totalRows || processedRows)) * 30));
              progressCallback(
                rowProgress, 
                { current: chunkCounter, total: estimatedTotalChunks }
              );
            }
            
            // Process in the background and resume parsing after
            setTimeout(async () => {
              try {
                await processChunk(
                  currentChunk, 
                  documentId, 
                  (progress: number) => processCallback(progress, chunkCounter, estimatedTotalChunks)
                );
                currentChunk = [];
                parser.resume();
              } catch (error) {
                console.error(`Error processing CSV chunk:`, error);
                parser.abort();
                reject(error);
              }
            }, 0);
          }
        } catch (error) {
          console.error(`Error processing CSV row:`, error);
          parser.abort();
          reject(error);
        }
      },
      complete: async () => {
        try {
          // Process any remaining rows
          if (currentChunk.length > 0) {
            // Increment chunk counter for the final chunk
            chunkCounter++;
            
            if (progressCallback) {
              progressCallback(30, { current: chunkCounter, total: estimatedTotalChunks });
            }
            
            await processChunk(
              currentChunk, 
              documentId, 
              (progress: number) => processCallback(progress, chunkCounter, estimatedTotalChunks)
            );
          }
          
          if (progressCallback) {
            // Final progress update
            progressCallback(100, { current: chunkCounter, total: chunkCounter });
          }
          
          resolve();
        } catch (error) {
          console.error(`Error finalizing CSV document ${fileName}:`, error);
          reject(error);
        }
      },
      error: (error) => {
        console.error(`Error parsing CSV document ${fileName}:`, error);
        reject(error);
      }
    });
    
    // Helper function to process chunks with progress callback
    const processCallback = (
      progress: number, 
      currentChunkNum: number, 
      totalChunks: number
    ) => {
      if (progressCallback) {
        // Map progress from 0-100 to 30-95 for embedding generation
        progressCallback(
          30 + Math.round(progress * 0.65), 
          { current: currentChunkNum, total: totalChunks }
        );
      }
    };
    
    // Helper function to process a chunk of documents
    async function processChunk(
      chunk: DocumentChunk[], 
      docId: string, 
      progressCb?: (progress: number) => void
    ): Promise<void> {
      // Generate embeddings for all chunks
      const texts = chunk.map(chunk => chunk.text);
      
      // Use setTimeout to yield to the browser's event loop
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const embeddings = await generateEmbeddings(texts, progressCb);
      
      // Use setTimeout again to yield to the browser's event loop
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Store embeddings in vector store
      await storeEmbeddings(
        docId,
        chunk.map(c => c.id),
        embeddings,
        texts,
        chunk.map(c => c.metadata)
      );
    }
  });
}; 