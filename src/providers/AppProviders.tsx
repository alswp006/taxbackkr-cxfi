import type { ReactNode } from 'react';
import { TaxDataProvider } from '@/components/TaxDataProvider';

/**
 * 앱 전역 Provider 집합 — 루트 트리에서 정확히 한 번만 마운트한다.
 * App.tsx가 이 컴포넌트로 <Routes>를 감싸므로 모든 페이지가 useTaxContext를 소비할 수 있다.
 * 새 전역 Provider가 필요하면 여기 중첩만 추가하고, main.tsx/각 페이지에서 중복 마운트하지 마라.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <TaxDataProvider>{children}</TaxDataProvider>;
}
