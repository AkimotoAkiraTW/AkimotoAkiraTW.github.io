import { NgClass } from '@angular/common';
import {
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FormField } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  UI_FIELD_APPEARANCE,
  UI_FIELD_FLOAT_LABEL,
  uiFieldFirstError,
  uiFieldHasError,
  type UiFormFieldPath,
} from './ui-field.utils';

@Component({
  selector: 'ui-textarea-field',
  standalone: true,
  imports: [NgClass, FormField, MatFormFieldModule, MatInputModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiTextareaFieldComponent),
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
        <textarea
          matInput
          [formField]="field()!"
          [placeholder]="placeholder()"
          [rows]="rows()"
        ></textarea>
        @if (showError()) {
          <mat-error>{{ errorText() }}</mat-error>
        }
      } @else {
        <textarea
          matInput
          [value]="adapterValue() ?? ''"
          [placeholder]="placeholder()"
          [rows]="rows()"
          [disabled]="isDisabled()"
          (input)="onAdapterInput($event)"
          (blur)="onTouched()"
        ></textarea>
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
    :host ::ng-deep textarea.mat-mdc-input-element {
      width: 100%;
      min-height: 120px;
      resize: vertical;
    }
  `],
})
export class UiTextareaFieldComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly field = input<UiFormFieldPath | null>(null);
  readonly placeholder = input('');
  readonly rows = input(3);
  readonly hint = input<string | undefined>(undefined);
  readonly errorFallback = input('此欄位有誤');
  readonly appearance = input(UI_FIELD_APPEARANCE);
  readonly floatLabel = input<'always' | 'auto'>(UI_FIELD_FLOAT_LABEL);
  readonly extraClass = input('', { alias: 'class' });

  readonly errorTextOverride = input<string | undefined>(undefined, { alias: 'errorMessage' });

  protected readonly adapterValue = signal<string | null>(null);
  protected isDisabled = signal(false);

  private onChange: (value: string | null) => void = () => {};
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

  writeValue(value: string | null): void {
    this.adapterValue.set(value);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  onAdapterInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.adapterValue.set(value);
    this.onChange(value);
  }
}
