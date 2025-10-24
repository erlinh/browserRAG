import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { getUseWebGPU, setUseWebGPU } from '../services/llmService';
import { ProgressInfo } from '../components/ProgressBar';
import { getSelectedModel, setSelectedModel as persistSelectedModel, ModelInfo } from '../services/modelPersistenceService';

// Define the available models
export interface ModelOption {
  id: string;
  name: string;
  size: string;
  quality: string;
  speed: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX',
    name: 'DeepSeek R1 Distill - WebGPU (Default)',
    size: '1.5B',
    quality: 'Good',
    speed: 'Medium',
  },
  {
    id: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    name: 'SmolLM2 135M Instruct',
    size: '135M',
    quality: 'Fair',
    speed: 'Very Fast',
  },
  {
    id: 'HuggingFaceTB/SmolLM2-1.7B-Instruct',
    name: 'SmolLM2 1.7B Instruct',
    size: '1.7B',
    quality: 'Good',
    speed: 'Medium',
  },
  {
    id: 'onnx-community/Pleias-Pico',
    name: 'Pleias-Pico (CPU)',
    size: '350M',
    quality: 'Good',
    speed: 'Fast',
  },
  {
    id: 'onnx-community/Pleias-Nano',
    name: 'Pleias-Nano (CPU)',
    size: '1.2B',
    quality: 'Great',
    speed: 'Very Slow',
  }
];

// Define context interface
interface ModelContextType {
  selectedModel: ModelOption;
  setSelectedModel: (model: ModelOption) => void;
  progressInfo: ProgressInfo | null;
  setProgressInfo: (info: ProgressInfo | null) => void;
  useWebGPU: boolean;
  setUseWebGPU: (enabled: boolean) => void;
}

// Create context with default values
const ModelContext = createContext<ModelContextType>({
  selectedModel: MODEL_OPTIONS[0], // Default model
  setSelectedModel: () => {},
  progressInfo: null,
  setProgressInfo: () => {},
  useWebGPU: true, // Default to true (using WebGPU)
  setUseWebGPU: () => {},
});

// Create provider component
export const ModelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedModel, setSelectedModelState] = useState<ModelOption>(MODEL_OPTIONS[0]);
  const [progressInfo, setProgressInfo] = useState<ProgressInfo | null>(null);
  const [useWebGPUState, setUseWebGPUState] = useState<boolean>(true);

  // Initialize the WebGPU state from the service
  useEffect(() => {
    // Get the initial value from service
    setUseWebGPUState(getUseWebGPU());
    
    // Load default browser model from provider config if available
    const providerConfig = localStorage.getItem('provider_config');
    let defaultModelId: string | null = null;
    
    if (providerConfig) {
      try {
        const parsed = JSON.parse(providerConfig);
        if (parsed.defaultProvider === 'browser' && parsed.defaultBrowserModel) {
          defaultModelId = parsed.defaultBrowserModel;
          console.log('[ModelContext] Loading default browser model:', defaultModelId);
        }
      } catch (error) {
        console.error('Failed to parse provider config in ModelContext:', error);
      }
    }
    
    // If we have a default model, use it; otherwise check persistence
    if (defaultModelId) {
      const matchingModel = MODEL_OPTIONS.find(m => m.id === defaultModelId);
      if (matchingModel) {
        setSelectedModelState(matchingModel);
        console.log('[ModelContext] Set model to default:', matchingModel.name);
        return;
      }
    }
    
    // Fall back to persisted model
    const persistedModel = getSelectedModel();
    if (persistedModel) {
      // Find matching model in options
      const matchingModel = MODEL_OPTIONS.find(m => m.id === persistedModel.id);
      if (matchingModel) {
        setSelectedModelState(matchingModel);
      }
    }
  }, []);
  
  // Update the service when state changes
  const handleWebGPUChange = (enabled: boolean) => {
    setUseWebGPUState(enabled);
    setUseWebGPU(enabled);
  };
  
  // Handle model selection with persistence
  const handleModelSelection = (model: ModelOption) => {
    setSelectedModelState(model);
    
    // Persist the selection
    const modelInfo: ModelInfo = {
      id: model.id,
      name: model.name,
      type: 'onnx',
      isDownloaded: true,
      lastUsed: new Date()
    };
    
    persistSelectedModel(model.id);
  };

  return (
    <ModelContext.Provider
      value={{
        selectedModel,
        setSelectedModel: handleModelSelection,
        progressInfo,
        setProgressInfo,
        useWebGPU: useWebGPUState,
        setUseWebGPU: handleWebGPUChange,
      }}
    >
      {children}
    </ModelContext.Provider>
  );
};

// Create custom hook for using this context
export const useModel = () => useContext(ModelContext); 