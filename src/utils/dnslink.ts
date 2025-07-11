export interface DNSLinkResult {
  hasDNSLink: boolean;
  cid?: string;
  domain: string;
  ipnsName?: string;
}

export class DNSLinkProbe {
  private static readonly DNS_OVER_HTTPS_URL = 'https://cloudflare-dns.com/dns-query';
  private static readonly DNSLINK_PREFIX = 'dnslink=';
  private static readonly IPFS_PREFIX = '/ipfs/';

  /**
   * Probe a domain for DNSLink records using DNS over HTTPS
   */
  static async probe(domain: string): Promise<DNSLinkResult> {
    try {
      const cleanDomain = this.cleanDomain(domain);
      
      // Try _dnslink subdomain first (RFC standard)
      const dnslinkDomain = `_dnslink.${cleanDomain}`;
      let result = await this.queryTxtRecord(dnslinkDomain);
      
      // If no _dnslink record, try the domain itself
      if (!result.hasDNSLink) {
        result = await this.queryTxtRecord(cleanDomain);
      }
      
      return {
        ...result,
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
        return { hasDNSLink: false, domain };
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
                cid,
                domain,
                ipnsName: domain
              };
            }
          }
        }
      }
      
      return { hasDNSLink: false, domain };
    } catch (error) {
      console.error('DNS TXT query failed:', error);
      return { hasDNSLink: false, domain };
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