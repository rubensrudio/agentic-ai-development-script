import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Observable, map } from 'rxjs';

export interface ConfirmDialogData {
  title: string;
  message: string;
  /** Label of the confirm button (default "Confirm"). */
  confirmLabel?: string;
}

/** Generic yes/no dialog. Closes with `true` on confirm; anything else means cancel. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancel</button>
      <button mat-flat-button [mat-dialog-close]="true" cdkFocusInitial>
        {{ data.confirmLabel ?? 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}

/** Open the confirm dialog; emits once with `true` only when the user confirmed. */
export function confirmAction(dialog: MatDialog, data: ConfirmDialogData): Observable<boolean> {
  return dialog
    .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data, width: '400px' })
    .afterClosed()
    .pipe(map((result) => result === true));
}
