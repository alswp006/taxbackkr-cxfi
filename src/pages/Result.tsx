import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, Button, ListRow, Toast } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { SummaryHero } from '../components/SummaryHero';
import { Card } from '../components/Card';
import { CountUp } from '../components/CountUp';
import { EmptyState } from '../components/StateView';
import { AdSlot } from '../components/AdSlot';
import { getProfile, getDeductions, saveRecord } from '../lib/storage';
import { calcTax, getGlobalFilingReason } from '../lib/calc';
import { formatNumber } from '../lib/utils';
import type { Deductions, TaxProfile } from '../lib/types';

const AD_GROUP_ID = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? 'result-bottom';

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

function fireHaptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export default function Result() {
  const navigate = useNavigate();
  const profile = getProfile() ?? FALLBACK_PROFILE;
  const deductions = getDeductions() ?? FALLBACK_DEDUCTIONS;
  const hasIncome = profile.annualSalary > 0 || profile.freelanceIncome > 0;

  const result = useMemo(() => calcTax(profile, deductions), [profile, deductions]);
  const [toast, setToast] = useState<{ open: boolean; text: string }>({ open: false, text: '' });

  function handleSave() {
    const saved = saveRecord({
      id: crypto.randomUUID(),
      taxYear: profile.taxYear,
      profile,
      deductions,
      result,
      savedAt: Date.now(),
    });

    if (saved) {
      fireHaptic('success');
      setToast({ open: true, text: '올해 기록을 저장했어요' });
    } else {
      setToast({ open: true, text: '저장 공간이 부족해요' });
    }
  }

  if (!hasIncome) {
    return (
      <ScreenScaffold
        top={<Top title={<Top.TitleParagraph>환급 결과</Top.TitleParagraph>} />}
        bottom={<FloatingTabBar items={TAB_ITEMS} />}
      >
        <EmptyState
          title="소득을 먼저 입력해주세요"
          description="총급여나 사업소득을 입력하면 예상 환급액을 계산해드려요"
          action={
            <Button variant="weak" onClick={() => navigate('/')}>
              입력하러 가기
            </Button>
          }
        />
        <Spacing size={80} />
      </ScreenScaffold>
    );
  }

  const isRefund = result.refundAmount >= 0;
  const heroAmount = Math.abs(result.refundAmount);

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>환급 결과</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={TAB_ITEMS} />}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="weak" size="small" onClick={handleSave}>
          기록 저장
        </Button>
      </div>

      <Spacing size={8} />

      <SummaryHero
        testId="refund-hero"
        label={isRefund ? '예상 환급' : '추가납부 예상'}
        value={<CountUp value={heroAmount} unit="원" typography="t2" />}
        caption="실제 신고 결과와 다를 수 있어요"
      />

      <Spacing size={16} />

      <Card testId="summary-card">
        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top="과세표준"
              bottom={`${formatNumber(result.taxableIncome)}원`}
            />
          }
        />
        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top="산출세액"
              bottom={`${formatNumber(result.calculatedTax)}원`}
            />
          }
        />
        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top="기납부세액"
              bottom={`${formatNumber(result.prepaidTax)}원`}
            />
          }
        />
      </Card>

      <Spacing size={16} />

      <AdSlot adGroupId={AD_GROUP_ID} />

      <Spacing size={16} />

      <Card>
        <Paragraph.Text typography="t5">
          {result.needsGlobalFiling ? '종합소득세 신고 대상이에요' : '종합소득세 신고 대상이 아니에요'}
        </Paragraph.Text>
        <Spacing size={4} />
        <Paragraph.Text typography="st13">{getGlobalFilingReason(profile)}</Paragraph.Text>
      </Card>

      <Spacing size={24} />

      <Paragraph.Text typography="st13">
        실제 신고 결과와 다를 수 있는 참고용 추정치입니다
      </Paragraph.Text>

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
