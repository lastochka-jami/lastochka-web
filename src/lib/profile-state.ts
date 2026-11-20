import { unwrap, type UserProfileDto } from './types';

export interface ProfileState {
  data: UserProfileDto | undefined;
  loading: boolean;
  error: string;
}

/** One profile per browser session; late responses cannot cross an account boundary. */
export class ProfileStore {
  private identity: string | null = null;
  private revision = 0;
  private listeners = new Set<() => void>();
  private state: ProfileState = { data: undefined, loading: false, error: '' };
  constructor(private load: () => Promise<unknown>) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(state: ProfileState) {
    this.state = state;
    this.listeners.forEach(listener => listener());
  }
  setSession(identity: string | null) {
    if (this.identity === identity) return;
    this.identity = identity;
    ++this.revision;
    this.publish({ data: undefined, loading: !!identity, error: '' });
  }
  refresh = async () => {
    if (!this.identity) return;
    const revision = ++this.revision;
    this.publish({ ...this.state, loading: true, error: '' });
    try {
      const data = unwrap<UserProfileDto>(await this.load());
      if (!data || typeof data.id !== 'number' || !Number.isFinite(data.bonusBalance)) {
        throw new Error('Не удалось получить баланс бонусов');
      }
      if (revision === this.revision) this.publish({ data, loading: false, error: '' });
    } catch (error: any) {
      if (revision !== this.revision) return;
      if (error?.status === 401) this.setSession(null);
      else this.publish({ ...this.state, loading: false, error: error instanceof Error ? error.message : 'Не удалось загрузить профиль' });
    }
  };
}
