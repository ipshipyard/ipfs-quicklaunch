export interface App {
  id: string;
  petname: string;
  description?: string;
  icon?: string;
  versions: AppVersion[];
  tags: string[];
  createdAt: number; // Unix timestamp
  lastUsed: number; // Unix timestamp
}

export interface AppVersion {
  id: string;
  name: string;
  cid: string; // IPFS CID in base32 format
  hash?: string; // Legacy hash field for backward compatibility
  isDefault: boolean;
  createdAt: number; // Unix timestamp
}

export interface AppStorage {
  apps: Record<string, App>;
  settings: UserSettings;
  gatewayConfig: GatewayConfig;
  dnslinkCache: Record<string, DNSLinkCacheEntry>;
}

export interface DNSLinkCacheEntry {
  domain: string;
  lastCID: string;
  lastChecked: number;
  associatedAppId?: string;
}

export interface GatewayConfig {
  defaultGateway: string;
  customGateways: string[];
  preferLocalGateway: boolean;
  localGatewayUrl: string;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  viewMode: 'grid' | 'list';
  defaultVersionBehavior: 'ask' | 'launch';
}

export interface CreateAppRequest {
  petname: string;
  cid: string;
  description?: string;
  tags?: string[];
  versionName?: string;
}

export interface UpdateAppRequest {
  id: string;
  petname?: string;
  description?: string;
  tags?: string[];
}

export interface CreateVersionRequest {
  appId: string;
  name: string;
  cid: string; // IPFS CID in base32 format
  hash?: string; // Legacy hash field for backward compatibility
  makeDefault?: boolean;
}