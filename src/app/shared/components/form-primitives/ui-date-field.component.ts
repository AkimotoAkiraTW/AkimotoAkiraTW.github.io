import { Component, input } from '@angular/core';
import { UiTextFieldComponent } from './ui-text-field.component';
import type { UiFormFieldPath } from './ui-field.utils';

/** 日期欄位：與其他 outline 欄位一致的 `type="date"` 封裝 */
@Component({
  selector: 'ui-date-field',
  standalone: true,
  imports: [UiTextFieldComponent],
  template: `
    <ui-text-field
      [label]="label()"
      [field]="field()"
      [placeholder]="placeholder()"
      [hint]="hint()"
      [errorFallback]="errorFallback()"
      [errorMessage]="errorMessage()"
      [class]="extraClass()"
      type="date"
    />
  `,
  styles: [`:host { display: block; width: 100%; min-width: 0; }`],
})
export class UiDateFieldComponent {
  readonly label = input.required<string>();
  readonly field = input<UiFormFieldPath | null>(null);
  readonly placeholder = input('');
  readonly hint = input<string | undefined>(undefined);
  readonly errorFallback = input('此欄位有誤');
  readonly errorMessage = input<string | undefined>(undefined);
  readonly extraClass = input('', { alias: 'class' });
}
