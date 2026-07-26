import type { TabItem } from './components/FloatingTabBar';

/**
 * 라우팅 관련 공유 상수의 단일 소유자.
 *
 * <Routes>/<Route> 테이블 자체는 App.tsx가 소유한다(진입 트리 단일화). 여기서는
 * 여러 곳에서 참조하는 탭-루트 네비 설정만 한 곳에 모아 중복 정의를 막는다.
 */

/** 하단 FloatingTabBar 탭(탭-루트 3개) — 홈/체크리스트/기록. */
export const TAB_ITEMS: TabItem[] = [
  { label: '홈', path: '/' },
  { label: '체크리스트', path: '/checklist' },
  { label: '기록', path: '/records' },
];

/** 탭바를 노출하는 탭-루트 경로 집합(상세 화면은 자체 CTA를 쓰므로 제외). */
export const TAB_ROOT_PATHS = new Set(TAB_ITEMS.map((tab) => tab.path));
