  ### Component Structure

- `AppGrid`: Main container for app flags
- `AppFlag`: Individual app representation
- `AppEditor`: Modal for creating/editing apps
- `VersionManager`: Interface for managing app versions
- `SearchBar`: Filter and search functionality
- `SettingsPanel`: Configuration options

### Interaction Patterns

- Click to launch default version
- Right-click context menu for version selection
- Hover for quick app info
- Drag handles for reordering

## Implementation Phases

### Phase 1: Core Foundation

- Extension manifest and basic structure
- Data models and storage layer
- Basic popup UI framework
- Simple app creation and storage

### Phase 2: Core Features

- App flag UI components
- Version management system
- Launch functionality
- Search and filtering

### Phase 3: Polish & Enhancement

- Visual theming and animations
- Export/import functionality
- Keyboard shortcuts
- Settings and preferences

### Phase 4: Probing features

- Add [DNSLink](https://dnslink.dev/) probing for sites. If a domain has a DNSLink record, prompt the user to save it.
- Probe for local IPFS gateway running on port 8080 ( try the `/ipfs/bafkqaaa` path). Add a config checkbox that to override and load from local gateway if it is available.

### Phase 5: UX polish
- Use the extension button to provide user feedback, for example when a DNSLink is detected, change the icon.
- Icon extraction from websites

### Phase 6: Service worker gateway integration

- Detect if a user is on the Service Worker GW (for now statically using inbrowser.link or inbrowser.dev or a subdomain of these origins) If it is, allow customizing configuration which is stored in the indexed db of the root domain, e.g. inbrowser.link.


## Current Implementation Status

### **Development Phase: Phase 4+ Complete (~90% Project Completion)**

The IPFS App Launcher browser extension is now a fully functional, production-ready application with all core features implemented, polished, and enhanced with advanced probing capabilities.

### **✅ Completed Features**

#### **Core Functionality**

- ✅ App creation, editing, and deletion with petnames
- ✅ Multiple version management per app with CID/hash tracking
- ✅ One-click app launching in new tabs
- ✅ Search and filtering capabilities
- ✅ Context menus and action buttons
- ✅ Chrome Storage API integration with data persistence
- ✅ **CID-based Architecture**: Apps store IPFS CIDs instead of URLs
- ✅ **Gateway Configuration**: Configurable IPFS gateways with custom support
- ✅ **Subdomain Resolution**: Modern `https://cid.ipfs.gateway.com` URL construction

#### **Advanced Features**

- ✅ **Theme System**: Light/Dark/Auto modes with system preference detection
- ✅ **Form State Management**: Auto-save draft functionality with persistence
- ✅ **Data Export/Import**: JSON backup and restore with validation
- ✅ **IPFS Integration**: CID validation, extraction, and format conversion
- ✅ **Keyboard Shortcuts**: Power user navigation (Ctrl+N, Ctrl+F, Ctrl+T, etc.)
- ✅ **Custom Tooltips**: Enhanced UX with informative tooltips (later removed for simplicity)
- ✅ **Responsive Design**: Modern flag-style UI with smooth animations

#### **Phase 4: Probing Features ✅ COMPLETED**

- ✅ **DNSLink Detection**: Automatic probing for DNSLink TXT records using DNS-over-HTTPS
- ✅ **Store-Friendly Implementation**: Uses activeTab permissions instead of broad host permissions
- ✅ **Smart Domain Parsing**: Handles both `_dnslink.domain.com` and direct domain TXT records
- ✅ **Local IPFS Gateway Detection**: Probes localhost:8080 with `/ipfs/bafkqaaa` test endpoint
- ✅ **Local Gateway Preference**: User-configurable checkbox to prefer local gateway when available
- ✅ **Automatic Fallback**: Falls back to remote gateways when local gateway unavailable
- ✅ **User Feedback System**: Visual notifications when DNSLink detected with one-click app creation
- ✅ **Pre-filled Forms**: Auto-populates app creation form with detected DNSLink data

#### **Technical Implementation**

- ✅ **Manifest V3** compliance with service worker
- ✅ **TypeScript** with strict type checking
- ✅ **Modular architecture** with well-organized components
- ✅ **Error handling** and data validation
- ✅ **Performance optimizations** (debouncing, efficient storage)
- ✅ **DNS-over-HTTPS Integration**: No external dependencies, browser-native approach
- ✅ **Chrome Web Store Ready**: Minimal permissions for faster approval

### **🚧 Remaining Work**

#### **Phase 5: UX Polish (In Progress)**
- 🔄 Icon extraction from websites
- ⏳ Enhanced extension button feedback
- ⏳ Visual indicators for different app states

#### **Phase 6: Service Worker Gateway Integration (Planned)**
- ⏳ Detection of Service Worker gateways (inbrowser.link/dev)
- ⏳ Configuration storage in indexed DB
- ⏳ Custom gateway behavior for SW environments

### **📊 Implementation vs. Original Plan**

#### **Enhanced Beyond Original Plan**

- Form state persistence with auto-save
- Comprehensive theme system with auto-detection
- Advanced IPFS utilities with CID format handling
- Rich keyboard shortcuts system
- Data export/import with validation
- **CID-based storage architecture** (major improvement over URL-based)
- **Configurable IPFS gateways** with subdomain resolution support
- **Unix timestamp storage** for simplified date handling
- **Store-friendly DNSLink implementation** (DNS-over-HTTPS vs. Helia)
- **Real-time local gateway detection** with automatic fallback
- **Smart notification system** for discovered IPFS content

#### **Technical Achievements**

- **Zero bundling required**: Pure browser APIs, no complex build process
- **Minimal permissions**: Only activeTab, storage, tabs for maximum store compatibility
- **Performance optimized**: DNS queries cached, local gateway probe with timeout
- **User-centric design**: One-click discovery-to-app workflow
