// ESM wrapper for React (loaded as global via UMD)
// This will be loaded after the UMD script sets window.React
export const useState = window.React.useState;
export const useEffect = window.React.useEffect;
export const useRef = window.React.useRef;
export const useCallback = window.React.useCallback;
export const useMemo = window.React.useMemo;
export const useContext = window.React.useContext;
export const createContext = window.React.createContext;
export const Fragment = window.React.Fragment;
export default window.React;
