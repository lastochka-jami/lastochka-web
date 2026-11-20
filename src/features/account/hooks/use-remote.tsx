'use client';

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { request } from '@/lib/client';
import { ErrorMessage } from '@/components/ui';
import { useShop } from '@/components/shop-context';

export interface RemoteStateResult<T = any> {
  data: T | undefined;
  error: string;
  loading: boolean;
  reload: () => Promise<T | void>;
}

export function useRemote<T = any>(path: string | null): RemoteStateResult<T> {
  const { authKey } = useShop();
  // Include session identity even when the endpoint stays unchanged across accounts.
  const scope = `${authKey || 'guest'}:${path}`;
  const [state, setState] = useState<{
    path: string | null;
    data: T | undefined;
    error: string;
    loading: boolean;
  }>({ path: scope, data: undefined, error: '', loading: !!path });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    if (!path) {
      setState({ path: null, data: undefined, error: '', loading: false });
      return;
    }
    setState((current) => ({
      path: scope,
      data: current.path === scope ? current.data : undefined,
      error: '',
      loading: true,
    }));
    try {
      const response = await request<T>(path);
      if (requestId.current === id) {
        setState({ path: scope, data: response, error: '', loading: false });
        return response;
      }
    } catch (e: any) {
      if (requestId.current === id) {
        setState((current) => ({
          path: scope,
          data: e?.status !== 401 && current.path === scope ? current.data : undefined,
          error: e instanceof Error ? e.message : 'Не удалось загрузить данные',
          loading: false,
        }));
      }
    }
  }, [path, scope]);

  useEffect(() => {
    if (!path) {
      ++requestId.current;
      setState({ path: null, data: undefined, error: '', loading: false });
      return;
    }
    void load();
    return () => {
      ++requestId.current;
    };
  }, [load, path]);

  const current = state.path === scope ? state : {
    path,
    data: undefined,
    error: '',
    loading: !!path,
  };
  return { data: current.data, error: current.error, loading: current.loading, reload: load };
}

export function RemoteState<T = any>({
  r,
  children,
}: {
  r: RemoteStateResult<T>;
  children: ReactNode;
}) {
  if (r.loading && r.data === undefined) {
    return <p className="muted">Загружаем…</p>;
  }
  if (r.error && r.data === undefined) return <ErrorMessage message={r.error} retry={r.reload} />;
  return <>
    {r.error && <ErrorMessage message={r.error} retry={r.reload} />}
    {children}
  </>;
}
