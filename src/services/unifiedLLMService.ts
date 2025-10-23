/**
 * Unified LLM Service
 * 
 * This service provides a unified interface for LLM operations,
 * routing to the appropriate provider (browser, LMStudio, Ollama)
 */

import { generateResponse as generateBrowserResponse } from './llmService';
import { generateLMStudioCompletion, generateLMStudioEmbedding, generateLMStudioEmbeddings } from './lmstudioService';
import { generateOllamaCompletion, generateOllamaEmbedding, generateOllamaEmbeddings } from './ollamaService';
import { generateEmbedding as generateBrowserEmbedding, generateEmbeddings as generateBrowserEmbeddings } from './embeddingService';
import { ProviderType } from '../contexts/ProviderContext';

export interface UnifiedGenerateOptions {
  provider: ProviderType;
  modelId?: string;
  embeddingModelId?: string;
  progressCallback?: (progress: { status: string; message: string; progress?: number; stage?: string }) => void;
  streamCallback?: (token: string) => void;
}

/**
 * Generate a text response using the selected provider
 */
export const generateUnifiedResponse = async (
  prompt: string,
  options: UnifiedGenerateOptions
): Promise<string> => {
  const { provider, modelId, progressCallback, streamCallback } = options;

  switch (provider) {
    case 'browser':
      if (!modelId) {
        throw new Error('Browser provider requires a model ID');
      }
      return generateBrowserResponse(prompt, modelId, progressCallback, streamCallback);

    case 'lmstudio':
      if (progressCallback) {
        progressCallback({
          status: 'loading',
          message: 'Connecting to LMStudio...',
          progress: 0,
          stage: 'connection',
        });
      }

      try {
        const response = await generateLMStudioCompletion(
          prompt,
          modelId,
          streamCallback
        );

        if (progressCallback) {
          progressCallback({
            status: 'success',
            message: 'Response generated successfully',
            progress: 100,
            stage: 'complete',
          });
        }

        return response;
      } catch (error) {
        if (progressCallback) {
          progressCallback({
            status: 'error',
            message: `LMStudio error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            stage: 'error',
          });
        }
        throw error;
      }

    case 'ollama':
      if (progressCallback) {
        progressCallback({
          status: 'loading',
          message: 'Connecting to Ollama...',
          progress: 0,
          stage: 'connection',
        });
      }

      try {
        const response = await generateOllamaCompletion(
          prompt,
          modelId,
          streamCallback
        );

        if (progressCallback) {
          progressCallback({
            status: 'success',
            message: 'Response generated successfully',
            progress: 100,
            stage: 'complete',
          });
        }

        return response;
      } catch (error) {
        if (progressCallback) {
          progressCallback({
            status: 'error',
            message: `Ollama error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            stage: 'error',
          });
        }
        throw error;
      }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
};

/**
 * Generate an embedding using the selected provider
 */
export const generateUnifiedEmbedding = async (
  text: string,
  options: UnifiedGenerateOptions
): Promise<number[]> => {
  const { provider, embeddingModelId } = options;

  switch (provider) {
    case 'browser':
      return generateBrowserEmbedding(text);

    case 'lmstudio':
      return generateLMStudioEmbedding(text, embeddingModelId);

    case 'ollama':
      return generateOllamaEmbedding(text, embeddingModelId);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
};

/**
 * Generate multiple embeddings using the selected provider
 */
export const generateUnifiedEmbeddings = async (
  texts: string[],
  options: UnifiedGenerateOptions,
  progressCallback?: (progress: number) => void
): Promise<number[][]> => {
  const { provider, embeddingModelId } = options;

  switch (provider) {
    case 'browser':
      return generateBrowserEmbeddings(texts, progressCallback);

    case 'lmstudio':
      return generateLMStudioEmbeddings(texts, embeddingModelId, progressCallback);

    case 'ollama':
      return generateOllamaEmbeddings(texts, embeddingModelId, progressCallback);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
};

