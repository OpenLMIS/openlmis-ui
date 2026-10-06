import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogCloseLabelProvider,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';

describe('DialogContent', () => {
  it('names its close buttons in the language given', () => {
    render(
      <DialogCloseLabelProvider label="Fechar">
        <Dialog open>
          <DialogContent>
            <DialogTitle>Edit</DialogTitle>
            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>
      </DialogCloseLabelProvider>,
    );

    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(2);
  });
});
