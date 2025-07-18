# IPFS QuickLaunch Browser Extension

IPFS launcher is an experimental browser extension with local pet names, version management, smart CID discovery, and gateway management.

**Built by [Shipyard](https://ipshipyard.com/) with ❤️ for the IPFS ecosystem**

![Shipyard](https://github.com/user-attachments/assets/39ed3504-bb71-47f6-9bf8-cb9a1698f272)


## ✨ Key Features

- **🏷️ Pet-name System**: Save IPFS apps with memorable, user-chosen names
- **📦 Version Management**: Track multiple versions per app with automatic updates
- **🔍 Smart Discovery**: Automatic DNSLink and `x-ipfs-path` header detection
- **🎨 Visual Feedback**: Extension badge notifications and app highlighting
- **🌐 Gateway Flexibility**: Configurable IPFS gateways with local gateway support
- **🌙 Theme System**: Light/Dark/Auto modes with system preference detection
- **💾 Data Management**: Export/import with full backup/restore capabilities
- **⌨️ Keyboard Shortcuts**: Power user navigation (Ctrl+N, Ctrl+F, etc.)

## Disclaimer

This extension is an experimental proof of concept. It's intended to demonstrate UX patterns around local CID management, versioning, and gateway flexibility in the IPFS ecosystem.


## 🚀 Quick Start

To get started with the IPFS QuickLaunch browser extension, you need to build it from source. Follow these steps

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Watch for changes during development
npm run watch
```

### Installation in Chrome

1. Make sure to build the extension first using `npm run build`.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable Developer Mode by clicking the toggle switch next to Developer mode.
4. Click the Load unpacked button and select the `dist` in the extension directory.



## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Extension                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Popup UI      │  │  Background     │  │ Content Script  │ │
│  │                 │  │ Service Worker  │  │                 │ │
│  │ • App Management│  │                 │  │ • Header Check  │ │
│  │ • User Interface│  │ • DNSLink Probe │  │ • Page Context  │ │
│  │ • Theme System  │  │ • Tab Monitoring│  │ • Same-Origin   │ │
│  │ • Form State    │  │ • Icon Updates  │  │   Requests      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                     │                     │         │
│           └─────────────────────┼─────────────────────┘         │
│                                 │                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                Chrome Storage API                           │ │
│  │ • Apps & Versions    • Settings & Themes                   │ │
│  │ • Gateway Config     • DNSLink Cache                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   DNS-over-     │  │  IPFS Gateways  │  │  Local IPFS     │ │
│  │    HTTPS        │  │                 │  │    Gateway      │ │
│  │                 │  │ • dweb.link     │  │                 │ │
│  │ • DNSLink TXT   │  │ • inbrowser.*   │  │ • localhost:8080│ │
│  │   Records       │  │ • Custom Gates  │  │ • Auto-detect   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
src/
├── manifest.json              # Extension manifest (v3)
├── popup.html                 # Main UI (400px width, responsive)
├── popup.ts                   # Popup controller & state management
├── background.ts              # Service worker & tab monitoring
├── content.ts                 # Content script for header detection
├── components/
│   ├── AppFlag.ts            # Individual app card component
│   └── VersionManager.ts     # Version management modal
├── storage/
│   └── index.ts              # Storage management & caching
├── types/
│   └── index.ts              # TypeScript interfaces
├── utils/
│   ├── theme.ts              # Theme system & preferences
│   ├── export.ts             # Data backup/restore
│   ├── formState.ts          # Form auto-save & persistence
│   ├── dnslink.ts            # DNSLink & x-ipfs-path detection
│   ├── localGateway.ts       # Local IPFS gateway probing
│   └── ipfs.ts               # IPFS utilities & CID validation
└── icons/                    # Extension icons (16/48/128px)
```

## 🧠 Core Data Model

```typescript
interface App {
  id: string                    // Unique identifier
  petname: string              // User-chosen friendly name
  description?: string         // Optional description
  icon?: string               // Optional icon URL
  versions: AppVersion[]      // Multiple versions per app
  tags: string[]             // Categorization tags
  createdAt: number         // Unix timestamp
  lastUsed: number          // Unix timestamp
}

interface AppVersion {
  id: string                // Version identifier
  name: string             // Version name (e.g., "v1.2.0")
  cid: string             // IPFS CID (primary identifier)
  hash?: string          // Legacy hash field
  isDefault: boolean     // Default version flag
  createdAt: number     // Unix timestamp
}

interface GatewayConfig {
  defaultGateway: string      // Domain for subdomain resolution
  customGateways: string[]    // User-defined gateways
  preferLocalGateway: boolean // Prefer localhost:8080
  localGatewayUrl: string    // Local gateway URL
}

interface DNSLinkCacheEntry {
  domain: string              // Domain name
  lastCID: string            // Last detected CID
  lastChecked: number        // Cache timestamp
  associatedAppId?: string   // Linked app ID
}
```

## 🎯 Key Design Decisions

### 1. **CID-Based Architecture**
- **Decision**: Store IPFS CIDs instead of full URLs
- **Rationale**: 
  - Gateway-agnostic: Users can switch gateways without losing data
  - Future-proof: Works with any IPFS gateway or resolution method
  - Efficient: Single CID maps to multiple possible URLs
- **Implementation**: Dynamic URL construction at launch time

### 2. **Dual Detection System**
- **Decision**: Support both DNSLink TXT records and x-ipfs-path headers
- **Rationale**:
  - **DNSLink**: Standard IPFS name resolution via DNS
  - **x-ipfs-path**: Gateway-served content detection
  - **Coverage**: Captures more IPFS content types
- **Implementation**: DNS-over-HTTPS + content script messaging

### 3. **Store-Friendly Permissions**
- **Decision**: Minimal permission set (storage, tabs, activeTab)
- **Rationale**:
  - **Fast approval**: Reduced review time for web stores
  - **User trust**: Lower permission requests increase adoption
  - **Security**: Principle of least privilege
- **Trade-offs**: Limited to DNS-over-HTTPS vs. direct DNS access

### 4. **Local-First Data Management**
- **Decision**: Chrome Storage API with local caching
- **Rationale**:
  - **Privacy**: No external servers or analytics
  - **Performance**: Local cache for instant access
  - **Reliability**: Works offline
- **Backup**: Export/import for data portability

### 5. **Component-Based Architecture**
- **Decision**: Modular TypeScript components
- **Rationale**:
  - **Maintainability**: Clear separation of concerns
  - **Testability**: Isolated component logic
  - **Reusability**: Components used across different contexts
- **Structure**: AppFlag, VersionManager, Storage, Utils

### 6. **Progressive Enhancement**
- **Decision**: Graceful degradation for failed features
- **Rationale**:
  - **Reliability**: Core functionality works even if advanced features fail
  - **Browser compatibility**: Different environments have different capabilities
  - **User experience**: Never block the user due to edge cases
- **Examples**: Content script fallbacks, local gateway detection

### 7. **Modern Subdomain Gateway Support**
- **Decision**: Prefer `https://{cid}.ipfs.{gateway}` over path-based URLs
- **Rationale**:
  - **Security**: Proper origin isolation for web apps
  - **Performance**: Better caching and CDN support
  - **Standards**: Aligns with modern IPFS gateway specifications
- **Fallback**: Support for legacy path-based gateways

### 8. **Real-Time State Management**
- **Decision**: Live tab monitoring and app highlighting
- **Rationale**:
  - **Context awareness**: Show which app corresponds to current tab
  - **User feedback**: Visual confirmation of saved apps
  - **Discovery**: Help users connect URLs to saved apps
- **Implementation**: Background tab monitoring + popup state sync

## 🔧 Development Details

### Build System
- **TypeScript Compilation**: `tsc` with strict type checking
- **Asset Pipeline**: Copy HTML, manifest, and icons to `dist/`
- **Watch Mode**: Automatic rebuilds during development
- **Zero Bundling**: Pure browser APIs, no webpack/rollup complexity

### Performance Optimizations
- **Local Caching**: Storage manager with in-memory cache
- **Debounced Operations**: Form auto-save and search filtering
- **Lazy Loading**: Components instantiated on demand
- **Efficient Queries**: Indexed storage lookups by ID and CID

### Browser Compatibility
- **Manifest V3**: Modern Chrome extension standards
- **ES2020+ Features**: Native modules, async/await, optional chaining
- **Progressive Enhancement**: Core features work across different environments
- **CORS Handling**: DNS-over-HTTPS and content script messaging

### Security Considerations
- **Content Security Policy**: Strict CSP for popup HTML
- **Input Validation**: CID format validation and sanitization
- **Origin Isolation**: Subdomain gateway URLs for proper app separation
- **No External Dependencies**: Self-contained for supply chain security

## 🧪 Testing & Quality

### Type Safety
- **Full TypeScript Coverage**: All source files typed
- **Interface Definitions**: Comprehensive type definitions
- **Strict Compilation**: `noImplicitAny`, `strictNullChecks` enabled

### Error Handling
- **Graceful Degradation**: Fallbacks for all external dependencies
- **User Feedback**: Clear error messages and loading states
- **Debug Logging**: Console logging for development and debugging
- **Exception Safety**: Try-catch blocks around critical operations

## 📦 Distribution

### Chrome Web Store Ready
- **Minimal Permissions**: Only `storage`, `tabs`, `activeTab`
- **Privacy Compliant**: No external analytics or tracking
- **Content Security Policy**: Strict CSP without `unsafe-eval`
- **Manifest V3**: Future-proof extension format

### Development Workflow
```bash
# Install dependencies
npm install

# Development with auto-rebuild
npm run watch

# Production build
npm run build

# Load dist/ folder in Chrome Developer Mode
chrome://extensions/ -> "Load unpacked"
```

## 🤝 Contributing

### Code Style
- **TypeScript**: Strict typing with interfaces
- **Modern ES6+**: Arrow functions, destructuring, async/await
- **Component Pattern**: Self-contained, reusable components
- **Error-First**: Explicit error handling and user feedback

### Architecture Principles
1. **Separation of Concerns**: Clear boundaries between UI, storage, and utilities
2. **Progressive Enhancement**: Core functionality always available
3. **User Privacy**: Local-first data management
4. **Performance**: Efficient caching and minimal network requests
5. **Accessibility**: Keyboard navigation and screen reader support

---

**Built by [Shipyard](https://ipshipyard.com/) with ❤️ for the IPFS ecosystem**
