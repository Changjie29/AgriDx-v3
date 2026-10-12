/// <reference types="vite/client" />

// GLB 模型文件模块声明
declare module '*.glb?url' {
  const src: string;
  export default src;
}

declare module '*.glb' {
  const src: string;
  export default src;
}

export {};

declare global {
  const __AGRIDX_DEV_PREVIEW__: boolean;
  const __AGRIDX_PREVIEW_RELEASE__: { version: string; commit: string; branch: string; repository: string; builtAt: string };
}
