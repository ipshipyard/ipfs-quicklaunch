export interface DNSLinkResult {
  hasDNSLink: boolean;
  hasIPFSPath: boolean;
  cid?: string;
  domain: string;
  ipnsName?: string;
  detectionMethod?: 'dnslink' | 'x-ipfs-path';
}

export class DNSLinkProbe {
  private static readonly DNS_OVER_HTTPS_URL = 'https://cloudflare-dns.com/dns-query';
  private static readonly DNSLINK_PREFIX = 'dnslink=';
  private static readonly IPFS_PREFIX = '/ipfs/';

  /**
   * Probe a domain for DNSLink records and x-ipfs-path headers
   */
  static async probe(domain: string): Promise<DNSLinkResult> {
    try {
      const cleanDomain = this.cleanDomain(domain);
      
      // Try DNSLink first (preferred method)
      // Try _dnslink subdomain first (RFC standard)
      const dnslinkDomain = `_dnslink.${cleanDomain}`;
      let result = await this.queryTxtRecord(dnslinkDomain);
      
      // If no _dnslink record, try the domain itself
      if (!result.hasDNSLink) {
        result = await this.queryTxtRecord(cleanDomain);
      }
      
      // If DNSLink found, return it
      if (result.hasDNSLink) {
        return {
          ...result,
          hasIPFSPath: false,
          domain: cleanDomain,
          detectionMethod: 'dnslink'
        };
      }
      
      // If no DNSLink, check for x-ipfs-path header
      const ipfsPathResult = await this.checkIPFSPathHeader(cleanDomain);
      
      return {
        hasDNSLink: false,
        hasIPFSPath: ipfsPathResult.hasIPFSPath,
        cid: ipfsPathResult.cid,
        domain: cleanDomain,
        detectionMethod: ipfsPathResult.hasIPFSPath ? 'x-ipfs-path' : undefined
      };
    } catch (error) {
      console.error('IPFS probe failed:', error);
      return {
        hasDNSLink: false,
        hasIPFSPath: false,
        domain: domain
      };
    }
  }

  /**
   * Query TXT records for a domain using DNS over HTTPS
   */
  private static async queryTxtRecord(domain: string): Promise<DNSLinkResult> {
    const url = `${this.DNS_OVER_HTTPS_URL}?name=${encodeURIComponent(domain)}&type=TXT`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/dns-json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`DNS query failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check if we have answers
      if (!data.Answer || !Array.isArray(data.Answer)) {
        return { hasDNSLink: false, hasIPFSPath: false, domain };
      }
      
      // Look for DNSLink records
      for (const answer of data.Answer) {
        if (answer.type === 16 && answer.data) { // TXT record
          const txtRecord = answer.data.replace(/"/g, ''); // Remove quotes
          
          if (txtRecord.startsWith(this.DNSLINK_PREFIX)) {
            const dnslinkValue = txtRecord.substring(this.DNSLINK_PREFIX.length);
            
            // Check if it's an IPFS link
            if (dnslinkValue.startsWith(this.IPFS_PREFIX)) {
              const cid = dnslinkValue.substring(this.IPFS_PREFIX.length);
              return {
                hasDNSLink: true,
                hasIPFSPath: false,
                cid,
                domain,
                ipnsName: domain
              };
            }
          }
        }
      }
      
      return { hasDNSLink: false, hasIPFSPath: false, domain };
    } catch (error) {
      console.error('DNS TXT query failed:', error);
      return { hasDNSLink: false, hasIPFSPath: false, domain };
    }
  }

  /**
   * Check for x-ipfs-path header using content script (only on current tab)
   */
  private static async checkIPFSPathHeader(domain: string): Promise<{ hasIPFSPath: boolean; cid?: string }> {
    try {
      // Get the current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id || !tabs[0]?.url) {
        return { hasIPFSPath: false };
      }

      const tab = tabs[0];
      if (!tab.url || !tab.id) {
        return { hasIPFSPath: false };
      }
      
      const tabUrl = new URL(tab.url);
      
      // Only check if we're on the same domain
      if (tabUrl.hostname !== domain) {
        return { hasIPFSPath: false };
      }

      // Try to send message to content script to check headers
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'CHECK_IPFS_PATH'
        }) as { success: boolean; data?: { hasIPFSPath: boolean; cid?: string } };

        if (response?.success && response.data?.hasIPFSPath) {
          const { cid } = response.data;
          if (cid && this.isValidCID(cid)) {
            return {
              hasIPFSPath: true,
              cid
            };
          }
        }
      } catch (messageError) {
        console.debug('Failed to communicate with content script, trying URL-based detection:', messageError);
        
        // Fallback: Try to detect IPFS content from URL patterns
        const urlBasedDetection = this.detectIPFSFromURL(tabUrl);
        if (urlBasedDetection.hasIPFSPath) {
          return urlBasedDetection;
        }
      }
      
      return { hasIPFSPath: false };
    } catch (error) {
      // Content script might not be ready or page doesn't support it
      console.debug('x-ipfs-path header check failed:', error);
      return { hasIPFSPath: false };
    }
  }

  /**
   * Try to detect IPFS content from URL patterns (fallback when content script fails)
   */
  private static detectIPFSFromURL(url: URL): { hasIPFSPath: boolean; cid?: string } {
    try {
      // Check for subdomain format: {cid}.ipfs.{gateway}
      const hostParts = url.hostname.split('.');
      if (hostParts.length >= 3 && hostParts[1] === 'ipfs') {
        const potentialCid = hostParts[0];
        if (this.isValidCID(potentialCid)) {
          return {
            hasIPFSPath: true,
            cid: potentialCid
          };
        }
      }

      // Check for path-based format: /ipfs/{cid}
      const pathMatch = url.pathname.match(/\/ipfs\/([a-zA-Z0-9]+)/);
      if (pathMatch) {
        const potentialCid = pathMatch[1];
        if (this.isValidCID(potentialCid)) {
          return {
            hasIPFSPath: true,
            cid: potentialCid
          };
        }
      }

      // Check for known IPFS gateways
      const knownGateways = [
        'dweb.link',
        'ipfs.io',
        'gateway.ipfs.io',
        'inbrowser.link',
        'inbrowser.dev',
        'cf-ipfs.com',
        'gateway.pinata.cloud'
      ];

      if (knownGateways.some(gateway => url.hostname.includes(gateway))) {
        // If it's a known gateway, try to extract CID from various patterns
        const cidMatch = url.hostname.match(/^([a-zA-Z0-9]+)\.ipfs\./) || 
                        url.pathname.match(/\/ipfs\/([a-zA-Z0-9]+)/);
        
        if (cidMatch) {
          const potentialCid = cidMatch[1];
          if (this.isValidCID(potentialCid)) {
            return {
              hasIPFSPath: true,
              cid: potentialCid
            };
          }
        }
      }

      return { hasIPFSPath: false };
    } catch (error) {
      console.debug('URL-based IPFS detection failed:', error);
      return { hasIPFSPath: false };
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

}