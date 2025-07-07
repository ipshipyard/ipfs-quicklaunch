export class IPFSUtils {
  private static readonly BASE32_PATTERN = /^b[a-z2-7]{50,}$/;
  private static readonly BASE58_PATTERN = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;

  static isValidCID(cid: string): boolean {
    if (!cid) return false;
    
    // Check for base32 CIDv1 (preferred format)
    // Base32 CIDs start with 'b' and can be 59+ characters long
    if (this.BASE32_PATTERN.test(cid)) {
      return true;
    }
    
    // Check for base58 CIDv0 (legacy format)
    if (this.BASE58_PATTERN.test(cid)) {
      return true;
    }
    
    // Also allow other valid CID patterns that start with common prefixes
    if (cid.startsWith('bafy') || cid.startsWith('bafk') || cid.startsWith('bafz') || cid.startsWith('bafm')) {
      return cid.length >= 50; // Most CIDs are at least 50 characters
    }
    
    return false;
  }

  static isBase32CID(cid: string): boolean {
    return this.BASE32_PATTERN.test(cid);
  }

  static formatCID(cid: string): string {
    if (!cid) return '';
    
    // If it's a valid CID, return as-is
    if (this.isValidCID(cid)) {
      return cid;
    }
    
    // If it starts with "ipfs://", extract the CID
    if (cid.startsWith('ipfs://')) {
      const extractedCID = cid.slice(7);
      return this.isValidCID(extractedCID) ? extractedCID : '';
    }
    
    return '';
  }

  static createIPFSUrl(cid: string, gateway: string = 'https://ipfs.io'): string {
    const formattedCID = this.formatCID(cid);
    if (!formattedCID) {
      throw new Error('Invalid CID provided');
    }
    
    return `${gateway}/ipfs/${formattedCID}`;
  }

  static extractCIDFromUrl(url: string): string | null {
    // Handle ipfs:// protocol
    if (url.startsWith('ipfs://')) {
      return this.formatCID(url.slice(7));
    }
    
    // Handle HTTP gateway URLs
    const patterns = [
      /\/ipfs\/([a-zA-Z0-9]+)/,  // Standard gateway pattern
      /ipfs\.io\/ipfs\/([a-zA-Z0-9]+)/,
      /gateway\.ipfs\.io\/ipfs\/([a-zA-Z0-9]+)/,
      /cloudflare-ipfs\.com\/ipfs\/([a-zA-Z0-9]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        const potentialCID = match[1];
        if (this.isValidCID(potentialCID)) {
          return potentialCID;
        }
      }
    }
    
    return null;
  }

  static getPreferredGateways(): string[] {
    return [
      'https://dweb.link',
      'https://inbrowser.link',
      'https://inbrowser.dev'
    ];
  }

  static isIPFSUrl(url: string): boolean {
    return url.startsWith('ipfs://') || this.extractCIDFromUrl(url) !== null;
  }
}