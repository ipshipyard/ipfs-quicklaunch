export interface LocalGatewayResult {
  isAvailable: boolean;
  gateway?: string;
  responseTime?: number;
}

export class LocalGatewayProbe {
  private static readonly DEFAULT_LOCAL_GATEWAY = 'http://localhost:8080';
  private static readonly TEST_CID = 'bafkqaaa'; // Empty file CID for testing
  private static readonly TIMEOUT_MS = 3000;

  /**
   * Probe for local IPFS gateway on port 8080
   */
  static async probe(): Promise<LocalGatewayResult> {
    try {
      const startTime = Date.now();
      const testUrl = `${this.DEFAULT_LOCAL_GATEWAY}/ipfs/${this.TEST_CID}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
      
      try {
        const response = await fetch(testUrl, {
          method: 'HEAD', // Use HEAD to avoid downloading content
          signal: controller.signal,
          cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        // Check if response is successful (200-299 range)
        if (response.ok) {
          return {
            isAvailable: true,
            gateway: this.DEFAULT_LOCAL_GATEWAY,
            responseTime
          };
        } else {
          console.debug('Local gateway responded with non-ok status:', response.status);
          return { isAvailable: false };
        }
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof Error && error.name === 'AbortError') {
          console.debug('Local gateway probe timed out');
        } else {
          console.debug('Local gateway probe failed:', error);
        }
        
        return { isAvailable: false };
      }
    } catch (error) {
      console.error('Local gateway probe error:', error);
      return { isAvailable: false };
    }
  }

  /**
   * Get the local gateway URL if available
   */
  static getLocalGatewayUrl(): string {
    return this.DEFAULT_LOCAL_GATEWAY;
  }

  /**
   * Check if a gateway URL is the local gateway
   */
  static isLocalGateway(gateway: string): boolean {
    return gateway === this.DEFAULT_LOCAL_GATEWAY || 
           gateway === 'localhost:8080' ||
           gateway === '127.0.0.1:8080';
  }

  /**
   * Build URL using local gateway
   */
  static buildLocalUrl(cid: string): string {
    return `${this.DEFAULT_LOCAL_GATEWAY}/ipfs/${cid}`;
  }
}