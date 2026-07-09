import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-field-group',
  standalone: true,
  template: `
    <div class="ui-field-group" [class]="layoutClass()">
      <ng-content />
    </div>
  `,
  styles: [`
    .ui-field-group {
      display: grid;
      gap: var(--space-lg);
    }
    .ui-field-group--grid {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    }
    .ui-field-group--grid .col-span-2 { grid-column: span 1; }
    @media (min-width: 600px) {
      .ui-field-group--grid .col-span-2 { grid-column: span 2; }
    }
    .ui-field-group--stack {
      grid-template-columns: 1fr;
    }
  `],
})
export class UiFieldGroupComponent {
  /** grid | stack */
  readonly layout = input<'grid' | 'stack'>('grid');
  readonly extraClass = input('', { alias: 'class' });

  layoutClass(): string {
    const base = this.layout() === 'stack' ? 'ui-field-group--stack' : 'ui-field-group--grid';
    const extra = this.extraClass();
    return extra ? `${base} ${extra}` : base;
  }
}
