import React, { useState, useEffect } from 'react';
import { useModel, MODEL_OPTIONS } from '../contexts/ModelContext';
import { useProvider } from '../contexts/ProviderContext';
import ProviderSelector from './ProviderSelector';
import './ModelSelector.css';

const ModelSelector: React.FC = () => {
  const { selectedModel, setSelectedModel, progressInfo, useWebGPU, setUseWebGPU } = useModel();
  const { provider, config, updateConfig } = useProvider();
  const [isWebGPUSupported, setIsWebGPUSupported] = useState<boolean | null>(null);
  const [showUsabilityWarning, setShowUsabilityWarning] = useState<boolean>(false);
  const [defaultSetMessage, setDefaultSetMessage] = useState<string | null>(null);
  
  // Check for WebGPU support when component mounts
  useEffect(() => {
    const checkWebGPUSupport = async () => {
      try {
        // Check if the navigator has gpu property and if it can be requested
        if ('gpu' in navigator) {
          try {
            // Try to request an adapter to confirm WebGPU is fully supported
            const adapter = await (navigator as any).gpu.requestAdapter();
            setIsWebGPUSupported(!!adapter);
            
            // If WebGPU is not supported, ensure it's disabled
            if (!adapter && useWebGPU) {
              setUseWebGPU(false);
            }
          } catch (e) {
            setIsWebGPUSupported(false);
            if (useWebGPU) setUseWebGPU(false);
          }
        } else {
          setIsWebGPUSupported(false);
          if (useWebGPU) setUseWebGPU(false);
        }
      } catch (error) {
        setIsWebGPUSupported(false);
        if (useWebGPU) setUseWebGPU(false);
      }
    };

    checkWebGPUSupport();
  }, [useWebGPU, setUseWebGPU]);
  
  // Show warning when WebGPU is toggled off
  useEffect(() => {
    // Only show warning when user explicitly disables WebGPU and it's supported
    if (isWebGPUSupported && !useWebGPU) {
      setShowUsabilityWarning(true);
    } else {
      setShowUsabilityWarning(false);
    }
  }, [useWebGPU, isWebGPUSupported]);
  
  // Disable selection during loading
  const isDisabled = progressInfo && 'status' in progressInfo && progressInfo.status === 'loading';

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value;
    const newModel = MODEL_OPTIONS.find(model => model.id === modelId);
    if (newModel) {
      setSelectedModel(newModel);
    }
  };

  const handleWebGPUToggle = () => {
    setUseWebGPU(!useWebGPU);
  };

  const handleSetBrowserAsDefault = () => {
    updateConfig({
      defaultProvider: 'browser',
      defaultBrowserModel: selectedModel.id,
    });
    setDefaultSetMessage('✓ Browser model set as default!');
    setTimeout(() => setDefaultSetMessage(null), 3000);
  };

  const isBrowserDefault = config.defaultProvider === 'browser' && config.defaultBrowserModel === selectedModel.id;

  // Get appropriate WebGPU status text
  const getWebGPUStatusLabel = () => {
    if (isWebGPUSupported === null) {
      return 'Checking...';
    } else if (isWebGPUSupported === false) {
      return 'Not Supported';
    } else if (useWebGPU) {
      return 'Enabled';
    } else {
      return 'Disabled (Available)';
    }
  };

  return (
    <div className="model-selector-container">
      <ProviderSelector />
      
      {(provider === 'lmstudio' || provider === 'ollama') && (
        <div className="provider-active-notice">
          <p>✓ Using {provider === 'lmstudio' ? 'LMStudio' : 'Ollama'} for model inference</p>
          <p className="notice-subtext">Model selection is managed in the provider settings above</p>
        </div>
      )}
      
      {provider === 'browser' && (
        <>
      <label htmlFor="model-select" className="model-label">
        LLM Model
      </label>
      <select 
        id="model-select"
        value={selectedModel.id}
        onChange={handleModelChange}
        disabled={isDisabled === true}
        className="model-select"
      >
        {MODEL_OPTIONS.map(model => (
          <option key={model.id} value={model.id}>
            {model.name} ({model.size})
          </option>
        ))}
      </select>
      <div className="model-info">
        <div className="model-info-item">
          <span className="info-label">Size:</span>
          <span className="info-value">{selectedModel.size}</span>
        </div>
        <div className="model-info-item">
          <span className="info-label">Quality:</span>
          <span className="info-value">{selectedModel.quality}</span>
        </div>
        <div className="model-info-item">
          <span className="info-label">Speed:</span>
          <span className="info-value">{selectedModel.speed}</span>
        </div>
        <div className="model-info-item webgpu-toggle">
          <span className="info-label">Use WebGPU:</span>
          <label className={`toggle-switch ${!isWebGPUSupported ? 'disabled' : ''}`}>
            <input
              type="checkbox"
              checked={useWebGPU}
              onChange={handleWebGPUToggle}
              disabled={isDisabled || isWebGPUSupported === false}
            />
            <span className="toggle-slider"></span>
          </label>
          <span className={`toggle-status ${isWebGPUSupported && !useWebGPU ? 'status-warning' : ''}`}>
            {getWebGPUStatusLabel()}
          </span>
        </div>
        {isWebGPUSupported === false && (
          <div className="webgpu-disclaimer">
            <p>WebGPU is not supported or enabled in your browser.</p>
          </div>
        )}
        {showUsabilityWarning && (
          <div className="webgpu-warning">
            <p>⚠️ Warning: Disabling WebGPU may cause errors during model execution. If you encounter errors like "An error occurred during model execution", please re-enable WebGPU.</p>
          </div>
        )}
      </div>

      <div className="default-button-container">
        <button
          onClick={handleSetBrowserAsDefault}
          className={`default-button ${isBrowserDefault ? 'is-default' : ''}`}
        >
          {isBrowserDefault ? '✓ Default Browser Model' : 'Set as Default'}
        </button>
        {defaultSetMessage && (
          <span className="default-info">{defaultSetMessage}</span>
        )}
        {isBrowserDefault && !defaultSetMessage && (
          <span className="default-info">This will be used on startup</span>
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default ModelSelector; 