/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOCKET_URL?: string;
  readonly VITE_ADMIN_API_URL?: string;
  readonly VITE_ENABLE_ADMIN_UI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
