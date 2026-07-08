/**
 * Mock Electron APIs for Testing
 * This file provides mock implementations of Electron APIs used in tests
 */

const mockBrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn().mockResolvedValue(undefined),
  loadFile: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  webContents: {
    send: jest.fn(),
    openDevTools: jest.fn(),
    on: jest.fn(),
    executeJavaScript: jest.fn().mockResolvedValue(undefined),
    session: {
      clearCache: jest.fn().mockResolvedValue(undefined),
      clearStorageData: jest.fn().mockResolvedValue(undefined),
    },
  },
  show: jest.fn(),
  hide: jest.fn(),
  close: jest.fn(),
  destroy: jest.fn(),
  isDestroyed: jest.fn().mockReturnValue(false),
  setMenu: jest.fn(),
  setMenuBarVisibility: jest.fn(),
}));

const mockApp = {
  getPath: jest.fn((name: string) => {
    const paths: Record<string, string> = {
      home: '/mock/home',
      appData: '/mock/appData',
      userData: '/mock/userData',
      temp: '/mock/temp',
      exe: '/mock/exe',
      desktop: '/mock/desktop',
      documents: '/mock/documents',
      downloads: '/mock/downloads',
      music: '/mock/music',
      pictures: '/mock/pictures',
      videos: '/mock/videos',
      logs: '/mock/logs',
    };
    return paths[name] || `/mock/${name}`;
  }),
  getVersion: jest.fn().mockReturnValue('1.0.0'),
  getName: jest.fn().mockReturnValue('FictionLab'),
  quit: jest.fn(),
  exit: jest.fn(),
  relaunch: jest.fn(),
  isReady: jest.fn().mockReturnValue(true),
  whenReady: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  requestSingleInstanceLock: jest.fn().mockReturnValue(true),
  setAppUserModelId: jest.fn(),
};

const mockIpcMain = {
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  handle: jest.fn(),
  handleOnce: jest.fn(),
  removeHandler: jest.fn(),
};

const mockDialog = {
  showOpenDialog: jest.fn().mockResolvedValue({
    canceled: false,
    filePaths: ['/mock/file.txt'],
  }),
  showSaveDialog: jest.fn().mockResolvedValue({
    canceled: false,
    filePath: '/mock/file.txt',
  }),
  showMessageBox: jest.fn().mockResolvedValue({
    response: 0,
    checkboxChecked: false,
  }),
  showErrorBox: jest.fn(),
};

const mockSafeStorage = {
  isEncryptionAvailable: jest.fn().mockReturnValue(true),
  encryptString: jest.fn((plainText: string) => Buffer.from(plainText, 'utf-8')),
  decryptString: jest.fn((encrypted: Buffer) => encrypted.toString('utf-8')),
};

const mockMenu = {
  buildFromTemplate: jest.fn().mockReturnValue({
    popup: jest.fn(),
    closePopup: jest.fn(),
  }),
  setApplicationMenu: jest.fn(),
  getApplicationMenu: jest.fn().mockReturnValue(null),
};

const mockMenuItem = jest.fn().mockImplementation((options: any) => ({
  ...options,
  click: options.click || jest.fn(),
}));

const mockShell = {
  openExternal: jest.fn().mockResolvedValue(undefined),
  openPath: jest.fn().mockResolvedValue(''),
  showItemInFolder: jest.fn(),
  beep: jest.fn(),
};

const mockNativeTheme = {
  themeSource: 'system',
  shouldUseDarkColors: false,
  shouldUseHighContrastColors: false,
  shouldUseInvertedColorScheme: false,
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
};

const mockScreen = {
  getPrimaryDisplay: jest.fn().mockReturnValue({
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    size: { width: 1920, height: 1080 },
    workAreaSize: { width: 1920, height: 1080 },
    scaleFactor: 1,
  }),
  getAllDisplays: jest.fn().mockReturnValue([]),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
};

const mockProtocol = {
  registerFileProtocol: jest.fn(),
  registerHttpProtocol: jest.fn(),
  registerStringProtocol: jest.fn(),
  registerBufferProtocol: jest.fn(),
  registerStreamProtocol: jest.fn(),
  unregisterProtocol: jest.fn(),
  isProtocolRegistered: jest.fn().mockReturnValue(false),
};

const mockSession = {
  defaultSession: {
    clearCache: jest.fn().mockResolvedValue(undefined),
    clearStorageData: jest.fn().mockResolvedValue(undefined),
    setPreloads: jest.fn(),
    getPreloads: jest.fn().mockReturnValue([]),
    cookies: {
      get: jest.fn().mockResolvedValue([]),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    },
  },
  fromPartition: jest.fn().mockReturnValue({
    clearCache: jest.fn().mockResolvedValue(undefined),
    clearStorageData: jest.fn().mockResolvedValue(undefined),
  }),
};

const mockNet = {
  request: jest.fn().mockReturnValue({
    on: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  }),
};

export {
  mockApp as app,
  mockBrowserWindow as BrowserWindow,
  mockIpcMain as ipcMain,
  mockDialog as dialog,
  mockSafeStorage as safeStorage,
  mockMenu as Menu,
  mockMenuItem as MenuItem,
  mockShell as shell,
  mockNativeTheme as nativeTheme,
  mockScreen as screen,
  mockProtocol as protocol,
  mockSession as session,
  mockNet as net,
};

// Default export for convenience
export default {
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain,
  dialog: mockDialog,
  safeStorage: mockSafeStorage,
  Menu: mockMenu,
  MenuItem: mockMenuItem,
  shell: mockShell,
  nativeTheme: mockNativeTheme,
  screen: mockScreen,
  protocol: mockProtocol,
  session: mockSession,
  net: mockNet,
};
