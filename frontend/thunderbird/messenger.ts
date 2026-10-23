/**
 * Was der Dodatek von Thunderbird braucht — die Teile der WebExtension-API, die er
 * benutzt, als Typen (webextension-api.thunderbird.net, cloudFile). Kein globales
 * `messenger` für die ganze App: wer es braucht, holt es hier.
 */

export interface CloudFileAccount {
  readonly id: string;
  readonly name: string;
  readonly configured: boolean;
  readonly uploadSizeLimit?: number;
  readonly spaceRemaining?: number;
  readonly spaceUsed?: number;
  readonly managementUrl: string;
}

export interface CloudFile {
  readonly id: number;
  readonly name: string;
  readonly data: File;
}

export interface CloudFileTemplateInfo {
  readonly service_name?: string;
  readonly service_icon?: string;
  readonly service_url?: string;
  readonly download_expiry_date?: { readonly timestamp: number; readonly format?: Intl.DateTimeFormatOptions };
  readonly download_limit?: number;
  readonly download_password_protected?: boolean;
}

/** Was `onFileUpload` antwortet: der Link — oder abgebrochen, oder ein Fehler mit Wortlaut. */
export interface UploadResult {
  readonly url?: string;
  readonly aborted?: boolean;
  readonly error?: boolean | string;
  readonly templateInfo?: CloudFileTemplateInfo;
}

export interface RenameResult {
  readonly url?: string;
  readonly error?: boolean | string;
}

export interface AccountUpdate {
  readonly configured?: boolean;
  readonly uploadSizeLimit?: number;
  readonly spaceRemaining?: number;
  readonly spaceUsed?: number;
}

interface Listeners<F> {
  addListener(listener: F): void;
  removeListener(listener: F): void;
}

export interface Messenger {
  readonly cloudFile: {
    getAllAccounts(): Promise<CloudFileAccount[]>;
    getAccount(accountId: string): Promise<CloudFileAccount | undefined>;
    updateAccount(accountId: string, update: AccountUpdate): Promise<CloudFileAccount | undefined>;
    readonly onFileUpload: Listeners<(account: CloudFileAccount, file: CloudFile, tab?: unknown, related?: unknown) => Promise<UploadResult>>;
    readonly onFileUploadAbort: Listeners<(account: CloudFileAccount, fileId: number) => void>;
    readonly onFileDeleted: Listeners<(account: CloudFileAccount, fileId: number) => Promise<void>>;
    readonly onFileRename: Listeners<(account: CloudFileAccount, fileId: number, newName: string) => Promise<RenameResult>>;
    readonly onAccountAdded: Listeners<(account: CloudFileAccount) => void>;
    readonly onAccountDeleted: Listeners<(accountId: string) => void>;
  };
  readonly runtime: {
    readonly onMessage: Listeners<(message: unknown) => Promise<unknown> | undefined>;
    sendMessage(message: unknown): Promise<unknown>;
  };
  readonly storage: {
    readonly local: {
      get(keys?: string | readonly string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | readonly string[]): Promise<void>;
    };
  };
}

/** Thunderbirds `messenger` — in der Hintergrundseite und auf der Seite der Einstellungen. */
export const thunderbird = (): Messenger => (globalThis as unknown as { messenger: Messenger }).messenger;
