import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

const ConfirmContext = createContext(null);

/**
 * Confirmação antes de ações destrutivas.
 * Uso: const confirm = useConfirm();
 *      if (await confirm({ title: 'Excluir?', message: '...', danger: true })) { ... }
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setState({
          title: 'Confirmar ação',
          confirmText: 'Confirmar',
          cancelText: 'Cancelar',
          danger: false,
          ...options,
        });
      }),
    []
  );

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={Boolean(state)} onClose={() => close(false)} maxWidth="xs" fullWidth>
        {state && (
          <>
            <DialogTitle>{state.title}</DialogTitle>
            {state.message && (
              <DialogContent>
                <DialogContentText>{state.message}</DialogContentText>
              </DialogContent>
            )}
            <DialogActions>
              <Button onClick={() => close(false)}>{state.cancelText}</Button>
              <Button
                onClick={() => close(true)}
                variant="contained"
                color={state.danger ? 'error' : 'primary'}
                autoFocus
              >
                {state.confirmText}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de <ConfirmProvider>.');
  return ctx;
}
