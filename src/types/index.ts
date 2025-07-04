export interface App {
  id: string;
  petname: string;
  description?: string;
  icon?: string;
  versions: AppVersion[];
  tags: string[];
  createdAt: Date;
  lastUsed: Date;
}

export interface AppVersion {
  id: string;
  name: string;
  url: string;
  cid?: string; // IPFS CID in base32 format
  hash?: string; // Legacy hash field for backward compatibility
  isDefault: boolean;
  createdAt: Date;
}

export interface AppStorage {
  apps: Record<string, App>;
  settings: UserSettings;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  viewMode: 'grid' | 'list';
  defaultVersionBehavior: 'ask' | 'launch';
}

export interface CreateAppRequest {
  petname: string;
  url: string;
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
  url: string;
  cid?: string; // IPFS CID in base32 format
  hash?: string; // Legacy hash field for backward compatibility
  makeDefault?: boolean;
}