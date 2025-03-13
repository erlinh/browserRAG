import React from 'react';
import './ProgressBar.css';

export interface ProgressInfo {
  stage: string;
  progress: number;
}

interface ProgressBarProps {
  info: ProgressInfo;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ info }) => {
  // Don't show if no progress info
  if (!info || info.progress === 0) {
    return null;
  }

  // Get stage display name
  const getStageName = () => {
    if (!info.stage) return '';
    
    switch (info.stage) {
      case 'tokenizer':
        return 'Loading Tokenizer';
      case 'model':
        return 'Loading Model';
      case 'model-load':
        return 'Loading Model';
      case 'warmup':
        return 'Warming Up Model';
      case 'embedding':
        return 'Generating Embeddings';
      case 'retrieval':
        return 'Retrieving Context';
      case 'prompt':
        return 'Building Prompt';
      case 'generation':
        return 'Generating Response';
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Error';
      case 'initialization':
        return 'Initializing';
      default:
        return info.stage.charAt(0).toUpperCase() + info.stage.slice(1);
    }
  };

  // Get message based on stage
  const getMessage = () => {
    switch (info.stage) {
      case 'embedding':
        return 'Generating embeddings for your question...';
      case 'retrieval':
        return 'Retrieving relevant context from documents...';
      case 'generation':
        return 'Generating response...';
      case 'complete':
        return 'Complete!';
      case 'error':
        return 'An error occurred';
      case 'initialization':
        return 'Initializing...';
      default:
        return 'Processing...';
    }
  };

  // Calculate progress percentage with bounds checking
  const clampedProgress = Math.max(0, Math.min(100, info.progress));
  const progressPercent = `${Math.round(clampedProgress)}%`;

  return (
    <div className={`progress-container ${info.stage === 'error' ? 'error' : 'loading'}`}>
      <div className="progress-info">
        <div className="progress-message">{getMessage()}</div>
        <div className="progress-percentage">{progressPercent}</div>
      </div>
      <div className="progress-stage">{getStageName()}</div>
      <div className="progress-bar-outer">
        <div 
          className="progress-bar-inner" 
          style={{ 
            width: progressPercent,
            backgroundColor: info.stage === 'error' ? 'var(--progress-error-color)' : 'var(--progress-loading-color)'
          }}
        />
      </div>
    </div>
  );
};

export default ProgressBar; 