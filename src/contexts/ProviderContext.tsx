import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

/**
 * Provider Context
 * 
 * Manages the selection between different AI model providers:
 * - browser: Uses transformers.js for in-browser inference
 * - lmstudio: Uses local LMStudio server
 * - ollama: (Future) Uses local Ollama server
 */

export type ProviderType = 'browser' | 'lmstudio' | 'ollama';

export interface ProviderConfig {
  type: ProviderType;
  lmstudioUrl?: string;
  ollamaUrl?: string;
  selectedLMStudioModel?: string;
  selectedOllamaModel?: string;
  selectedLMStudioEmbeddingModel?: string;
  selectedOllamaEmbeddingModel?: string;
  defaultProvider?: ProviderType;
  defaultLMStudioModel?: string;
  defaultOllamaModel?: string;
  defaultLMStudioEmbeddingModel?: string;
  defaultOllamaEmbeddingModel?: string;
  defaultBrowserModel?: string;
}

interface ProviderContextType {
  provider: ProviderType;
  setProvider: (provider: ProviderType) => void;
  config: ProviderConfig;
  updateConfig: (updates: Partial<ProviderConfig>) => void;
}

const DEFAULT_CONFIG: ProviderConfig = {
  type: 'browser',
  lmstudioUrl: 'http://localhost:1234/v1',
  ollamaUrl: 'http://localhost:11434',
  selectedLMStudioModel: undefined,
  selectedOllamaModel: undefined,
  selectedLMStudioEmbeddingModel: undefined,
  selectedOllamaEmbeddingModel: undefined,
  defaultProvider: 'browser',
  defaultLMStudioModel: undefined,
  defaultOllamaModel: undefined,
  defaultLMStudioEmbeddingModel: undefined,
  defaultOllamaEmbeddingModel: undefined,
  defaultBrowserModel: undefined,
};

const ProviderContext = createContext<ProviderContextType>({
  provider: 'browser',
  setProvider: () => {},
  config: DEFAULT_CONFIG,
  updateConfig: () => {},
});

export const ProviderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [provider, setProviderState] = useState<ProviderType>('browser');
  const [config, setConfig] = useState<ProviderConfig>(DEFAULT_CONFIG);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('provider_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        console.log('[ProviderContext] Loading saved config:', parsed);
        
        // If we have default models set, use them
        const loadedConfig = { ...parsed };
        if (parsed.defaultProvider) {
          console.log('[ProviderContext] Using default provider:', parsed.defaultProvider);
          // Use default provider
          setProviderState(parsed.defaultProvider);
          
          // Ensure the type is also set to the default provider
          loadedConfig.type = parsed.defaultProvider;
          
          // Load default models for the provider
          if (parsed.defaultProvider === 'lmstudio') {
            if (parsed.defaultLMStudioModel) {
              loadedConfig.selectedLMStudioModel = parsed.defaultLMStudioModel;
              console.log('[ProviderContext] Set default LMStudio model:', parsed.defaultLMStudioModel);
            }
            if (parsed.defaultLMStudioEmbeddingModel) {
              loadedConfig.selectedLMStudioEmbeddingModel = parsed.defaultLMStudioEmbeddingModel;
            }
          } else if (parsed.defaultProvider === 'ollama') {
            if (parsed.defaultOllamaModel) {
              loadedConfig.selectedOllamaModel = parsed.defaultOllamaModel;
              console.log('[ProviderContext] Set default Ollama model:', parsed.defaultOllamaModel);
            }
            if (parsed.defaultOllamaEmbeddingModel) {
              loadedConfig.selectedOllamaEmbeddingModel = parsed.defaultOllamaEmbeddingModel;
            }
          } else if (parsed.defaultProvider === 'browser') {
            if (parsed.defaultBrowserModel) {
              loadedConfig.defaultBrowserModel = parsed.defaultBrowserModel;
              console.log('[ProviderContext] Set default browser model:', parsed.defaultBrowserModel);
            }
          }
        } else {
          // No default set, use saved provider
          console.log('[ProviderContext] No default provider set, using saved type');
          setProviderState(parsed.type || 'browser');
        }
        
        setConfig(loadedConfig);
        console.log('[ProviderContext] Final loaded config:', loadedConfig);
      } catch (error) {
        console.error('Failed to parse saved provider config:', error);
      }
    }
    setIsInitialized(true);
  }, []);

  // Save config to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) {
      console.log('[ProviderContext] Saving config to localStorage:', config);
      localStorage.setItem('provider_config', JSON.stringify(config));
    }
  }, [config, isInitialized]);

  const setProvider = (newProvider: ProviderType) => {
    setProviderState(newProvider);
    setConfig(prev => ({
      ...prev,
      type: newProvider,
    }));
  };

  const updateConfig = (updates: Partial<ProviderConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...updates,
    }));
  };

  return (
    <ProviderContext.Provider
      value={{
        provider,
        setProvider,
        config,
        updateConfig,
      }}
    >
      {children}
    </ProviderContext.Provider>
  );
};

export const useProvider = () => useContext(ProviderContext);

