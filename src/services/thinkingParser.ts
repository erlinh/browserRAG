/**
 * Thinking Parser Utility
 * 
 * Handles parsing and extraction of thinking tokens from LLM responses.
 * Supports <think>...</think> tags from various models.
 */

/**
 * Parse streaming text to extract thinking content and regular content
 */
export class ThinkingParser {
  private isThinking = false;
  private thinkingBuffer = '';
  private normalBuffer = '';
  private thinkingCallback?: (thinking: string) => void;
  
  constructor(thinkingCallback?: (thinking: string) => void) {
    this.thinkingCallback = thinkingCallback;
  }
  
  /**
   * Process a new token/chunk of text
   * Returns the normal (non-thinking) content to display
   */
  processToken(token: string): string {
    let remainingToken = token;
    
    while (remainingToken.length > 0) {
      if (!this.isThinking) {
        // Check if we're entering thinking mode
        const thinkStartIndex = remainingToken.indexOf('<think>');
        
        if (thinkStartIndex !== -1) {
          // Add everything before <think> to normal buffer
          if (thinkStartIndex > 0) {
            this.normalBuffer += remainingToken.substring(0, thinkStartIndex);
          }
          
          // Switch to thinking mode
          this.isThinking = true;
          remainingToken = remainingToken.substring(thinkStartIndex + 7); // 7 = length of '<think>'
        } else {
          // No thinking tag, add all to normal buffer
          this.normalBuffer += remainingToken;
          break;
        }
      } else {
        // We're in thinking mode, look for closing tag
        const thinkEndIndex = remainingToken.indexOf('</think>');
        
        if (thinkEndIndex !== -1) {
          // Add everything before </think> to thinking buffer
          if (thinkEndIndex > 0) {
            this.thinkingBuffer += remainingToken.substring(0, thinkEndIndex);
          }
          
          // Emit the complete thinking content
          if (this.thinkingCallback && this.thinkingBuffer) {
            this.thinkingCallback(this.thinkingBuffer);
          }
          
          // Exit thinking mode and clear buffer
          this.isThinking = false;
          this.thinkingBuffer = '';
          remainingToken = remainingToken.substring(thinkEndIndex + 8); // 8 = length of '</think>'
        } else {
          // No closing tag yet, add all to thinking buffer
          this.thinkingBuffer += remainingToken;
          
          // Emit partial thinking content periodically
          if (this.thinkingCallback && (remainingToken.includes('\n') || this.thinkingBuffer.length > 100)) {
            this.thinkingCallback(this.thinkingBuffer);
          }
          
          break;
        }
      }
    }
    
    return this.normalBuffer;
  }
  
  /**
   * Get the current normal (non-thinking) buffer
   */
  getNormalBuffer(): string {
    return this.normalBuffer;
  }
  
  /**
   * Get the current thinking buffer
   */
  getThinkingBuffer(): string {
    return this.thinkingBuffer;
  }
  
  /**
   * Check if currently in thinking mode
   */
  isInThinkingMode(): boolean {
    return this.isThinking;
  }
  
  /**
   * Reset the parser state
   */
  reset(): void {
    this.isThinking = false;
    this.thinkingBuffer = '';
    this.normalBuffer = '';
  }
}

/**
 * Emit thinking event for the Chat component to listen to
 */
export const emitThinkingEvent = (thinkingContent: string): void => {
  const event = new CustomEvent('thinking', { 
    detail: { text: thinkingContent } 
  });
  window.dispatchEvent(event);
};

