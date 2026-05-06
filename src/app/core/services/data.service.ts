import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { shareReplay, catchError } from 'rxjs/operators';
import { ResumeData } from '../models/resume.model';
import { PortfolioItem } from '../models/portfolio.model';
import { ToolEntry } from '../models/tool.model';

/**
 * DataService
 * ─────────────────────────────────────────────────────────────────────────────
 * 全站統一資料服務。
 * 所有 JSON 資料都從 assets/data/ 讀取，只需修改 JSON 即可更新網站內容，
 * 不需要觸碰任何 TypeScript 程式碼。
 *
 * 資料來源：
 *   - assets/data/resume.json    → 履歷資料
 *   - assets/data/portfolio.json → 作品集資料
 *   - assets/data/tools.json     → 工具箱清單
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  private http = inject(HttpClient);

  // 使用 shareReplay 快取，避免重複 HTTP 請求（每次訂閱都拿同一份資料）
  // 加入 catchError 處理檔案未上傳的情境（隱私保護）
  private resume$ = this.http
    .get<ResumeData>('assets/data/resume.json')
    .pipe(
      catchError(() => of(null as unknown as ResumeData)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  private portfolio$ = this.http
    .get<PortfolioItem[]>('assets/data/portfolio.json')
    .pipe(
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  private tools$ = this.http
    .get<ToolEntry[]>('assets/data/tools.json')
    .pipe(
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  /** 取得履歷資料 */
  getResume(): Observable<ResumeData> {
    return this.resume$;
  }

  /** 取得作品集資料 */
  getPortfolio(): Observable<PortfolioItem[]> {
    return this.portfolio$;
  }

  /** 取得工具箱清單 */
  getTools(): Observable<ToolEntry[]> {
    return this.tools$;
  }
}
