import React from 'react';
import { AlertTriangle, ExternalLink, HelpCircle, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export const AuthErrorModal: React.FC = () => {
  const { authError, clearAuthError, clientId } = useAuth();

  if (!authError) return null;

  const currentOrigin = window.location.origin;

  return (
    <Modal
      isOpen={!!authError}
      onClose={clearAuthError}
      title="YouTube Connection Issue"
      description="Google OAuth authentication could not be completed."
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="p-4 bg-status-error/15 border border-status-error/30 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-status-error shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-status-error">Error Details:</p>
            <p className="text-xs text-foreground font-mono leading-relaxed">{authError}</p>
          </div>
        </div>

        <div className="p-4 bg-surface-2 rounded-2xl border border-border-subtle space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-primary" /> Common Reasons & Fixes
          </h4>

          <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside leading-relaxed">
            <li>
              <strong className="text-foreground">Authorized JavaScript Origins:</strong> In Google Cloud Console under{' '}
              <span className="text-primary font-mono font-bold">OAuth 2.0 Client IDs</span>, ensure your current origin{' '}
              <code className="bg-surface-0 px-1.5 py-0.5 rounded text-primary font-bold">{currentOrigin}</code>{' '}
              is added to <strong>Authorized JavaScript origins</strong>.
            </li>
            <li>
              <strong className="text-foreground">OAuth Consent Screen Test Users:</strong> If your Google Cloud app is in "Testing" mode, add your Gmail account as a <strong>Test User</strong> under the OAuth consent screen.
            </li>
            <li>
              <strong className="text-foreground">YouTube Data API v3:</strong> Ensure <strong>YouTube Data API v3</strong> is enabled in your Google Cloud project.
            </li>
          </ul>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
          <span className="text-[10px] font-mono text-muted-foreground truncate max-w-xs">
            Client ID: {clientId.slice(0, 20)}...
          </span>
          <Button variant="primary" size="sm" onClick={clearAuthError}>
            Understood
          </Button>
        </div>
      </div>
    </Modal>
  );
};
