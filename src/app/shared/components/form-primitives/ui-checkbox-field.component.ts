import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FormField } from '@angular/forms/signals';
import { MatCheckboxModule } from '@angular/material/checkbox';
import type { UiFormFieldPath } from './ui-field.utils';

@Component({
  selector: 'ui-checkbox-field',
  standalone: true,
  imports: [FormField, MatCheckboxModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiCheckboxFieldComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ui-checkbox-field">
      @if (field()) {
        <mat-checkbox [formField]="field()!">{{ label() }}</mat-checkbox>
      } @else {
        <mat-checkbox
          [checked]="!!adapterValue()"
          [disabled]="isDisabled()"
          (change)="onAdapterChange($event.checked)"
          (blur)="onTouched()"
        >{{ label() }}</mat-checkbox>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui-checkbox-field {
      display: flex;
      align-items: flex-start;
    }
  `],
})
export class UiCheckboxFieldComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly field = input<UiFormFieldPath | null>(null);

  protected readonly adapterValue = signal<boolean | null>(false);
  protected isDisabled = signal(false);

  private onChange: (value: boolean | null) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: boolean | null): void {
    this.adapterValue.set(value);
  }

  registerOnChange(fn: (value: boolean | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  onAdapterChange(checked: boolean): void {
    this.adapterValue.set(checked);
    this.onChange(checked);
  }
}
