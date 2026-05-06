/**
 * site.config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * 全站集中式設定檔（已抽離至 assets/data/site.json 以利 CI/CD 腳本共用）。
 * 在此保留匯出供 Angular 應用程式內部使用。
 * ─────────────────────────────────────────────────────────────────────────────
 */
import siteData from '../../../assets/data/site.json';

export const SITE_CONFIG = siteData;

