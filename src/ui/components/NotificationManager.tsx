import { useEffect, useState } from 'preact/hooks';
import { useAppState } from '../hooks/useAppState';
import { NotificationCard, NotificationProps } from './NotificationCard';
import { TransferDialog } from './TransferDialog';

export function NotificationManager() {
  const status = useAppState((s) => s.status);
  const notificationsEnabled = useAppState((s) => s.notificationsEnabled);

  const [notifications, setNotifications] = useState<Omit<NotificationProps, 'onDismiss'>[]>([]);
  const [hasWarnedWarning, setHasWarnedWarning] = useState(false);
  const [hasWarnedCritical, setHasWarnedCritical] = useState(false);

  const [showTransfer, setShowTransfer] = useState(false);

  useEffect(() => {
    if (!notificationsEnabled) return;

    if (status === 'warning' && !hasWarnedWarning) {
      setHasWarnedWarning(true);
      addNotification({
        id: 'warning-' + Date.now(),
        severity: 'warning',
        title: 'Context Caution',
        description:
          'Your conversation context is getting large. The AI may start forgetting older details.',
        actions: [
          { label: 'Generate Summary', onClick: () => console.log('Generate Summary clicked') },
          { label: 'Dismiss', onClick: () => {} },
        ],
        autoDismissMs: 15000,
      });
    }

    if (status === 'critical' && !hasWarnedCritical) {
      setHasWarnedCritical(true);
      addNotification({
        id: 'critical-' + Date.now(),
        severity: 'critical',
        title: 'Context Critical',
        description:
          'Context window is almost entirely full. We strongly recommend transferring this state to a new chat.',
        actions: [
          { label: 'Open Transfer', primary: true, onClick: () => setShowTransfer(true) },
          {
            label: 'New Chat',
            onClick: () => window.open(window.location.origin + window.location.pathname, '_blank'),
          },
        ],
        autoDismissMs: 0, // Do not auto-dismiss critical alerts
      });
    }

    // Reset flags if status drops back to healthy (e.g. user started new chat)
    if (status === 'healthy' || status === 'caution') {
      setHasWarnedWarning(false);
      setHasWarnedCritical(false);
    }
  }, [status, notificationsEnabled, hasWarnedWarning, hasWarnedCritical]);

  const addNotification = (notif: Omit<NotificationProps, 'onDismiss'>) => {
    setNotifications((prev) => [...prev, notif]);
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {notifications.map((n) => (
          <NotificationCard key={n.id} {...n} onDismiss={dismissNotification} />
        ))}
      </div>

      {showTransfer && (
        <div className="pointer-events-auto">
          <TransferDialog onClose={() => setShowTransfer(false)} />
        </div>
      )}
    </>
  );
}
