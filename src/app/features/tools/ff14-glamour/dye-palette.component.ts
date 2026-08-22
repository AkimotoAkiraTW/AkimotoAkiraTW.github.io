import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { stainName, type LodestoneLang, type Stain } from './ff14-glamour.model';
import { filterStains } from './stains';

@Component({
  selector: 'app-dye-palette',
  standalone: true,
  imports: [FormsModule],
  template: `
    <input
      type="search"
      [ngModel]="query()"
      (ngModelChange)="query.set($event)"
      placeholder="搜尋染料名稱（日文或英文）"
    />
    <button type="button" class="clear-dye" (click)="pick.emit(0)">無染色</button>
    <div class="palette" role="listbox">
      @for (stain of filtered(); track stain.id) {
        <button
          type="button"
          class="swatch"
          [class.is-selected]="stain.id === selectedId()"
          [style.background]="stain.hex"
          [title]="label(stain)"
          (click)="pick.emit(stain.id)"
        ></button>
      }
    </div>
    @if (selected(); as stain) {
      <p class="picked">
        <i [style.background]="stain.hex"></i>
        {{ label(stain) }}
      </p>
    }
  `,
  styles: [`
    :host { display: block; }
    input {
      width: 100%;
      border: 1px solid var(--border-color);
      background: var(--surface-alt);
      color: var(--text-primary);
      border-radius: var(--radius-sm);
      padding: 8px 10px;
      font-size: 13px;
    }
    .clear-dye {
      margin-top: 6px;
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
    }
    .palette {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(18px, 1fr));
      gap: 4px;
      margin-top: 8px;
      max-height: 148px;
      overflow: auto;
      padding: 2px;
    }
    .swatch {
      aspect-ratio: 1;
      border: 1px solid rgba(15, 23, 42, 0.25);
      border-radius: 3px;
      cursor: pointer;
      padding: 0;
    }
    .swatch:hover { transform: scale(1.45); z-index: 1; }
    .swatch.is-selected {
      outline: 2px solid var(--accent-color);
      outline-offset: 1px;
    }
    .picked {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .picked i {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      border: 1px solid var(--border-color);
    }
  `],
})
export class DyePaletteComponent {
  readonly stains = input.required<Stain[]>();
  readonly lang = input.required<LodestoneLang>();
  readonly selectedId = input(0);
  readonly pick = output<number>();
  readonly query = signal('');

  readonly filtered = computed(() => filterStains(this.stains(), this.query()));
  readonly selected = computed(
    () => this.stains().find((stain) => stain.id === this.selectedId()) ?? null,
  );

  label(stain: Stain): string {
    return stainName(stain, this.lang());
  }
}
