import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, Button, ListRow, Toast } from '@toss/tds-mobile';
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { Card } from '@/components/Card';
import { MiniBar } from '@/components/MiniBar';
import { EmptyState } from '@/components/StateView';
import { getProfile, getDeductions } from '@/lib/storage';
import { calcTax } from '@/lib/calc';
import { formatNumber } from '@/lib/utils';
import type { Deductions, TaxProfile } from '@/lib/types';

const AD_SLOT_ID = import.meta.env.VITE_TOSS_AD_SLOT_ID ?? 'analysis-unlock';

const AD_LOAD_FAIL_TEXT = '광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요';

const TAB_ITEMS = [
  { label: '홈', path: '/' },
  { label: '체크리스트', path: '/checklist' },
  { label: '기록', path: '/records' },
];

const FALLBACK_PROFILE: TaxProfile = {
  id: '',
  taxYear: new Date().getFullYear(),
  incomeType: 'employee',
  annualSalary: 0,
  freelanceIncome: 0,
  dependents: 0,
  updatedAt: 0,
};

const FALLBACK_DEDUCTIONS: Deductions = {
  creditCard: 0,
  medical: 0,
  education: 0,
  irp: 0,
  insurance: 0,
  donation: 0,
};

export default function Analysis() {
  const navigate = useNavigate();
  const profile = getProfile() ?? FALLBACK_PROFILE;
  const deductions = getDeductions() ?? FALLBACK_DEDUCTIONS;

  const result = useMemo(() => calcTax(profile, deductions), [profile, deductions]);
  const hasDeductions = result.breakdown.some((item) => item.appliedAmount > 0);

  const [adReady, setAdReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [showing, setShowing] = useState(false);
  const [toast, setToast] = useState({ open: false, text: '' });

  useEffect(() => {
    console.log('EFFECT RUN', hasDeductions);
    if (!hasDeductions) return;
    console.log('typeof loadFullScreenAd', typeof loadFullScreenAd, loadFullScreenAd.name, loadFullScreenAd.toString().slice(0, 200));
    try {
      loadFullScreenAd({
        slotId: AD_SLOT_ID,
        onEvent: () => setAdReady(true),
        onError: () => setAdReady(false),
      } as Parameters<typeof loadFullScreenAd>[0]);
      console.log('CALLED OK');
    } catch (e) {
      console.log('CATCH', e);
      // SDK 미제공 환경(개발 브라우저 등) — 광고 없이 진행 못 하므로 준비 안 됨 상태 유지
      setAdReady(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDeductions]);

  function handleWatchAd() {
    if (!adReady) {
      setToast({ open: true, text: AD_LOAD_FAIL_TEXT });
      return;
    }

    setShowing(true);
    try {
      showFullScreenAd({
        slotId: AD_SLOT_ID,
        onEvent: (event: { type?: string }) => {
          setShowing(false);
          if (event?.type === 'rewarded' || event?.type === 'completed') {
            setUnlocked(true);
          }
        },
        onError: () => {
          setShowing(false);
          setToast({ open: true, text: AD_LOAD_FAIL_TEXT });
        },
      } as Parameters<typeof showFullScreenAd>[0]);
    } catch {
      setShowing(false);
      setToast({ open: true, text: AD_LOAD_FAIL_TEXT });
    }
  }

  if (!hasDeductions) {
    return (
      <ScreenScaffold
        top={<Top title={<Top.TitleParagraph>절세 상세 분석</Top.TitleParagraph>} />}
        bottom={<FloatingTabBar items={TAB_ITEMS} />}
      >
        <EmptyState
          title="분석할 공제 내역이 없어요"
          description="공제 항목을 입력하면 항목별 절세 여지를 분석해드려요"
          action={
            <Button variant="weak" onClick={() => navigate('/simulate')}>
              공제 입력하기
            </Button>
          }
        />
        <Spacing size={80} />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>절세 상세 분석</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={TAB_ITEMS} />}
    >
      {unlocked ? (
        <Card testId="analysis-card">
          {result.breakdown.map((item) => {
            const remain = Math.max(0, item.limit - item.appliedAmount);
            return (
              <ListRow
                key={item.key}
                contents={
                  <ListRow.Texts
                    type="2RowTypeA"
                    top={item.label}
                    bottom={`한도까지 ${formatNumber(remain)}원 남음`}
                  />
                }
                right={<MiniBar ratio={item.usedRatio} />}
              />
            );
          })}
        </Card>
      ) : (
        <div
          style={{
            position: 'relative',
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: 'var(--adaptiveLayeredBackground)',
          }}
        >
          <div
            style={{
              filter: 'blur(6px)',
              opacity: 0.6,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            aria-hidden="true"
          >
            {result.breakdown.map((item) => (
              <div
                key={item.key}
                style={{ height: 44, borderRadius: 8, backgroundColor: 'var(--adaptiveGrey100)' }}
              />
            ))}
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <Button variant="fill" onClick={handleWatchAd} disabled={showing}>
              {showing ? '광고 재생 중...' : '광고 보고 분석 확인'}
            </Button>
          </div>
        </div>
      )}

      <Spacing size={24} />

      <Paragraph.Text typography="st13">참고용 추정치예요</Paragraph.Text>

      <Spacing size={80} />

      <Toast
        open={toast.open}
        text={toast.text}
        position="bottom"
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </ScreenScaffold>
  );
}
