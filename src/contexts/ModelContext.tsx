import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { getUseWebGPU, setUseWebGPU } from '../services/llmService';

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
    name: 'DeepSeek R1 Distill (Default)',
    size: '1.5B',
    quality: 'Good',
    speed: 'Medium',
  },
  {
    id: 'onnx-community/Pleias-Nano',
    name: 'Pleias-Nano',
    size: '0.5B',
    quality: 'Okay',
    speed: 'Fast',
  },
  {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    name: 'Qwen2.5-0.5B',
    size: '0.5B',
    quality: 'Bad',
    speed: 'Fastest',
  }
];

// Define progress information interface
export interface ProgressInfo {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  progress?: number;
  stage?: string;
}

// Define context interface
interface ModelContextType {
  selectedModel: ModelOption;
  setSelectedModel: (model: ModelOption) => void;
  progressInfo: ProgressInfo;
  setProgressInfo: (info: ProgressInfo) => void;
  useWebGPU: boolean;
  setUseWebGPU: (enabled: boolean) => void;
}

// Create context with default values
const ModelContext = createContext<ModelContextType>({
  selectedModel: MODEL_OPTIONS[0], // Default model
  setSelectedModel: () => {},
  progressInfo: { status: 'idle', message: '', progress: 0 },
  setProgressInfo: () => {},
  useWebGPU: true, // Default to true (using WebGPU)
  setUseWebGPU: () => {},
});

// Create provider component
export const ModelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODEL_OPTIONS[0]);
  const [progressInfo, setProgressInfo] = useState<ProgressInfo>({
    status: 'idle',
    message: '',
    progress: 0,
  });
  const [useWebGPUState, setUseWebGPUState] = useState<boolean>(true);

  // Initialize the WebGPU state from the service
  useEffect(() => {
    // Get the initial value from service
    setUseWebGPUState(getUseWebGPU());
  }, []);
  
  // Update the service when state changes
  const handleWebGPUChange = (enabled: boolean) => {
    setUseWebGPUState(enabled);
    setUseWebGPU(enabled);
  };

  return (
    <ModelContext.Provider
      value={{
        selectedModel,
        setSelectedModel,
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