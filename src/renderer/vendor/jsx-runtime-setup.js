// Expose jsxRuntime globally for @xyflow/react UMD build
// This must run after react.umd.js and before xyflow-react.umd.js
window.jsxRuntime = {
    jsx: window.React.createElement,
    jsxs: window.React.createElement,
    Fragment: window.React.Fragment
};
