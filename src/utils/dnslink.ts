import { createHeliaHTTP } from '@helia/http';
import { ipns, type IPNS } from '@helia/ipns';
import type { Helia } from '@helia/interface';

export interface DNSLinkResult {
  hasDNSLink: boolean;
  cid?: string;
  domain: string;
  ipnsName?: string;
}

export class DNSLinkProbe {
  private static heliaInstance: Helia | null = null;
  private static ipnsInstance: IPNS | null = null;

  /**
   * Initialize Helia instance
   */
  private static async getHelia(): Promise<{ helia: Helia; ipns: IPNS }> {
    if (!this.heliaInstance || !this.ipnsInstance) {
      this.heliaInstance = await createHeliaHTTP();
      this.ipnsInstance = ipns(this.heliaInstance);
    }
    return { helia: this.heliaInstance, ipns: this.ipnsInstance };
  }

  /**
   * Probe a domain for DNSLink records
   */
  static async probe(domain: string): Promise<DNSLinkResult> {
    try {
      const cleanDomain = this.cleanDomain(domain);
      const { ipns: ipnsInstance } = await this.getHelia();
      
      // Use resolveDNSLink to check for DNSLink records
      try {
        const result = await ipnsInstance.resolveDNSLink(cleanDomain);
        
        return {
          hasDNSLink: true,
          cid: result.cid.toString(),
          domain: cleanDomain,
          ipnsName: cleanDomain
        };
      } catch (error) {
        console.debug('DNSLink resolution failed for domain:', cleanDomain, error);
      }
      
      return {
        hasDNSLink: false,
        domain: cleanDomain
      };
    } catch (error) {
      console.error('DNSLink probe failed:', error);
      return {
        hasDNSLink: false,
        domain: domain
      };
    }
  }

  /**
   * Clean a domain by removing protocol and path
   */
  private static cleanDomain(input: string): string {
    try {
      // If it looks like a URL, parse it
      if (input.includes('://')) {
        const url = new URL(input);
        return url.hostname;
      }
      
      // If it has a path, remove it
      const pathIndex = input.indexOf('/');
      if (pathIndex !== -1) {
        input = input.substring(0, pathIndex);
      }
      
      // Remove www prefix if present
      if (input.startsWith('www.')) {
        input = input.substring(4);
      }
      
      return input.toLowerCase();
    } catch (error) {
      // If URL parsing fails, return as-is (cleaned)
      return input.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    }
  }

  /**
   * Check if a CID is valid
   */
  static isValidCID(cid: string): boolean {
    // Basic CID validation - should start with b or Q and have appropriate length
    if (!cid || typeof cid !== 'string') return false;
    
    // CIDv0 (base58, starts with Qm)
    if (cid.startsWith('Qm') && cid.length === 46) {
      return /^[A-Za-z0-9]+$/.test(cid);
    }
    
    // CIDv1 (base32, starts with b)
    if (cid.startsWith('b') && cid.length >= 59) {
      return /^[a-z0-9]+$/.test(cid);
    }
    
    // CIDv1 (base36, starts with k)
    if (cid.startsWith('k') && cid.length >= 50) {
      return /^[a-z0-9]+$/.test(cid);
    }
    
    return false;
  }

  /**
   * Cleanup Helia instance
   */
  static async cleanup(): Promise<void> {
    if (this.heliaInstance) {
      try {
        await this.heliaInstance.stop();
      } catch (error) {
        console.error('Error stopping Helia:', error);
      }
      this.heliaInstance = null;
      this.ipnsInstance = null;
    }
  }
}