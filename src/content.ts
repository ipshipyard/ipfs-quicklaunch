// Content script to detect x-ipfs-path headers
// This runs in the page context and can make same-origin requests

interface IPFSPathResult {
  hasIPFSPath: boolean;
  cid?: string;
  domain: string;
}

class IPFSPathDetector {
  private static readonly IPFS_PREFIX = '/ipfs/';

  /**
   * Check for x-ipfs-path header on the current page
   */
  static async checkCurrentPage(): Promise<IPFSPathResult> {
    const domain = window.location.hostname;
    
    try {
      // Make a HEAD request to the current page to check headers
      const response = await fetch(window.location.href, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const ipfsPath = response.headers.get('x-ipfs-path');
      
      if (ipfsPath && ipfsPath.startsWith(this.IPFS_PREFIX)) {
        const cid = ipfsPath.substring(this.IPFS_PREFIX.length);
        
        // Remove any trailing path from CID
        const cidParts = cid.split('/');
        const cleanCid = cidParts[0];
        
        if (this.isValidCID(cleanCid)) {
          return {
            hasIPFSPath: true,
            cid: cleanCid,
            domain
          };
        }
      }
      
      return { hasIPFSPath: false, domain };
    } catch (error) {
      console.debug('x-ipfs-path check failed:', error);
      return { hasIPFSPath: false, domain };
    }
  }

  /**
   * Basic CID validation
   */
  private static isValidCID(cid: string): boolean {
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

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'CHECK_IPFS_PATH') {
    // Add a small delay to ensure page is fully loaded
    setTimeout(() => {
      IPFSPathDetector.checkCurrentPage()
        .then(result => {
          try {
            sendResponse({ success: true, data: result });
          } catch (error) {
            console.debug('Failed to send response:', error);
          }
        })
        .catch(error => {
          try {
            sendResponse({ success: false, error: error.message });
          } catch (responseError) {
            console.debug('Failed to send error response:', responseError);
          }
        });
    }, 100);
    
    return true; // Keep message channel open for async response
  }
  
  return false; // Don't keep channel open for other message types
});

// Also check on page load and send result to background
window.addEventListener('load', async () => {
  try {
    const result = await IPFSPathDetector.checkCurrentPage();
    if (result.hasIPFSPath) {
      chrome.runtime.sendMessage({
        type: 'IPFS_PATH_DETECTED',
        data: result
      });
    }
  } catch (error) {
    console.debug('IPFS path detection failed:', error);
  }
});