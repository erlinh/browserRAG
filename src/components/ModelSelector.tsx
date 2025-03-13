import React from 'react';
import { useModel, ModelOption, MODEL_OPTIONS } from '../contexts/ModelContext';
import './ModelSelector.css';

const ModelSelector: React.FC = () => {
  const { selectedModel, setSelectedModel, progressInfo, useWebGPU, setUseWebGPU } = useModel();
  
  // Disable selection during loading
  const isDisabled = progressInfo.status === 'loading';

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

  return (
    <div className="model-selector-container">
      <label htmlFor="model-select" className="model-label">
        LLM Model
      </label>
      <select 
        id="model-select"
        value={selectedModel.id}
        onChange={handleModelChange}
        disabled={isDisabled}
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
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={useWebGPU}
              onChange={handleWebGPUToggle}
              disabled={isDisabled}
            />
            <span className="toggle-slider"></span>
          </label>
          <span className="toggle-status">{useWebGPU ? 'Enabled' : 'Disabled'}</span>
        </div>
      </div>
    </div>
  );
};

export default ModelSelector; 