import { useEffect, useReducer } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePolicies } from '../contexts/PolicyContext';
import { policyActivity } from '../contexts/policyActivity';
import { subscribeToDirectory } from '../utils/users';

/**
 * Feeds the notification centre from the policies every portal shares, again
 * on each chain refresh, language change or directory update (which can turn
 * "A farmer" into a name).
 */
export function PolicyActivitySync(): null {
  const { user } = useAuth();
  const { policies } = usePolicies();
  const { t } = useI18n();
  const { setActivity } = useNotifications();
  const [directoryVersion, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeToDirectory(bump), []);

  useEffect(() => {
    if (user) setActivity(policyActivity(policies, user, t));
  }, [user, policies, t, setActivity, directoryVersion]);
  return null;
}
