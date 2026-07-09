import { NgClass } from '@angular/common';
import {
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FormField } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import {
  UI_FIELD_APPEARANCE,
  UI_FIELD_FLOAT_LABEL,
  uiFieldFirstError,
  uiFieldHasError,
  type UiFormFieldPath,
} from './ui-field.utils';

export interface UiSelectOption {
  value: unknown;
  label: string;
}

@Component({
  selector: 'ui-select-field',
  standalone: true,
  imports: [NgClass, FormField, FormsModule, MatFormFieldModule, MatSelectModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiSelectFieldComponent),
      multi: true,
    },
  ],
  template: `
    <mat-form-field
      [appearance]="appearance()"
      [floatLabel]="floatLabel()"
      [ngClass]="['ui-form-field', extraClass()]"
    >
      <mat-label>{{ label() }}</mat-label>
      @if (field()) {
        <mat-select [formField]="field()!" [compareWith]="compareWith()">
          @if (options().length) {
            @for (opt of options(); track opt.value) {
              <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
            }
          } @else {
            <ng-content />
          }
        </mat-select>
        @if (showError()) {
          <mat-error>{{ errorText() }}</mat-error>
        }
      } @else {
        <mat-select
          [(ngModel)]="adapterModel"
          [ngModelOptions]="{ standalone: true }"
          [compareWith]="compareWith()"
          [disabled]="isDisabled()"
          (ngModelChange)="onAdapterChange($event)"
          (blur)="onTouched()"
        >
          @if (options().length) {
            @for (opt of options(); track opt.value) {
              <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
            }
          } @else {
            <ng-content />
          }
        </mat-select>
      }
      @if (hint()) {
        <mat-hint>{{ hint() }}</mat-hint>
      }
    </mat-form-field>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    :host ::ng-deep .mat-mdc-form-field {
      width: 100%;
    }
  `],
})
export class UiSelectFieldComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly options = input<readonly UiSelectOption[]>([]);
  readonly field = input<UiFormFieldPath | null>(null);
  readonly hint = input<string | undefined>(undefined);
  readonly errorFallback = input('此欄位有誤');
  readonly appearance = input(UI_FIELD_APPEARANCE);
  readonly floatLabel = input<'always' | 'auto'>(UI_FIELD_FLOAT_LABEL);
  readonly extraClass = input('', { alias: 'class' });
  readonly compareWith = input<(a: unknown, b: unknown) => boolean>((a, b) => a === b);

  readonly errorTextOverride = input<string | undefined>(undefined, { alias: 'errorMessage' });

  protected adapterModel: unknown = null;
  protected isDisabled = signal(false);

  private onChange: (value: unknown) => void = () => {};
  protected onTouched: () => void = () => {};

  readonly showError = computed(() => {
    if (this.errorTextOverride()) return true;
    return uiFieldHasError(this.field() ?? undefined);
  });

  readonly errorText = computed(() => {
    const override = this.errorTextOverride();
    if (override) return override;
    return uiFieldFirstError(this.field() ?? undefined, this.errorFallback()) ?? '';
  });

  writeValue(value: unknown): void {
    this.adapterModel = value;
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  onAdapterChange(value: unknown): void {
    this.adapterModel = value;
    this.onChange(value);
  }
}
