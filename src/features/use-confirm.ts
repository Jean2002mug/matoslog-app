import { useState } from 'react';

import type { ConfirmDialogProps } from '@/components/ui/confirm-dialog';
import type { FlagSetting } from '@/domain/settings';
import { useServices } from '@/features/services-provider';

type DialogText = Pick<ConfirmDialogProps, 'title' | 'message' | 'confirmLabel' | 'destructive'>;

/**
 * Asks "Are you sure?" before running an action.
 * With a `flag`, the dialog offers "Don't ask again", and that choice is saved; once saved,
 * the action runs straight away (it can be switched back on in Settings).
 *
 * Usage: `const confirm = useConfirm(...)`, call `confirm.request(action)`, and render
 * `<ConfirmDialog {...confirm.dialogProps} />`.
 */
export function useConfirm(text: DialogText, flag?: FlagSetting) {
  const { settings } = useServices();
  const [pending, setPending] = useState<(() => Promise<unknown>) | null>(null);

  async function request(action: () => Promise<unknown>) {
    if (flag) {
      const flags = await settings.getFlags();
      if (flags.ok && !flags.value[flag]) {
        await action();
        return;
      }
    }
    // Store a function in state: wrap it, or React would call it as an updater.
    setPending(() => action);
  }

  async function onConfirm(dontAskAgain: boolean) {
    const action = pending;
    setPending(null);
    if (flag && dontAskAgain) await settings.setFlag(flag, false);
    await action?.();
  }

  const dialogProps: ConfirmDialogProps = {
    ...text,
    visible: pending !== null,
    offerDontAskAgain: flag !== undefined,
    onConfirm,
    onCancel: () => setPending(null),
  };

  return { request, dialogProps };
}
