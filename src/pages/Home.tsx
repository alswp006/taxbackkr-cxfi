import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, Chip, ChipItem, TextField, Button } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { SeasonBanner } from '../components/SeasonBanner';
import { getProfile, saveProfile } from '../lib/storage';
import type { IncomeType } from '../lib/types';

const MAX_SALARY = 10_000_000_000; // 100억

function fireHaptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

function onlyDigits(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

export default function Home() {
  const navigate = useNavigate();
  const profile = getProfile();
  const hasSavedProfile = !!profile && profile.id !== '';

  const [incomeType, setIncomeType] = useState<IncomeType>(profile?.incomeType ?? 'employee');
  const [annualSalary, setAnnualSalary] = useState(
    hasSavedProfile ? String(profile!.annualSalary) : '',
  );
  const [freelanceIncome, setFreelanceIncome] = useState(
    hasSavedProfile ? String(profile!.freelanceIncome) : '',
  );
  const [dependents, setDependents] = useState(
    hasSavedProfile ? String(profile!.dependents) : '',
  );
  const [salaryError, setSalaryError] = useState<string | null>(null);

  function selectIncomeType(next: IncomeType) {
    if (next === incomeType) return;
    fireHaptic('tickWeak');
    setIncomeType(next);
    setSalaryError(null);
  }

  function handleSubmit() {
    const salary = Number(annualSalary || 0);

    if (incomeType !== 'freelancer') {
      if (salary <= 0) {
        setSalaryError('총급여를 입력해주세요');
        return;
      }
      if (salary > MAX_SALARY) {
        setSalaryError('총급여는 100억원 이하로 입력해주세요');
        return;
      }
    }
    setSalaryError(null);

    const saved = saveProfile({
      id: hasSavedProfile ? profile!.id : crypto.randomUUID(),
      taxYear: profile?.taxYear ?? new Date().getFullYear(),
      incomeType,
      annualSalary: incomeType === 'freelancer' ? 0 : salary,
      freelanceIncome: incomeType === 'freelancer' ? Number(freelanceIncome || 0) : 0,
      dependents: Number(dependents || 0),
      updatedAt: Date.now(),
    });
    if (!saved) return;

    fireHaptic('success');
    navigate('/result');
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>세금 환급 계산</Top.TitleParagraph>} />}
      bottom={
        <FloatingTabBar
          items={[
            { label: '홈', path: '/' },
            { label: '체크리스트', path: '/checklist' },
            { label: '기록', path: '/records' },
          ]}
        />
      }
    >
      <SeasonBanner />

      <Spacing size={16} />

      <Paragraph.Text typography="t4">소득 유형을 골라주세요</Paragraph.Text>
      <Spacing size={12} />
      <Chip style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        <ChipItem
          selected={incomeType === 'employee'}
          onClick={() => selectIncomeType('employee')}
        >
          직장인
        </ChipItem>
        <ChipItem
          selected={incomeType === 'freelancer'}
          onClick={() => selectIncomeType('freelancer')}
        >
          프리랜서
        </ChipItem>
        <ChipItem selected={incomeType === 'multi'} onClick={() => selectIncomeType('multi')}>
          N잡
        </ChipItem>
      </Chip>

      <Spacing size={24} />

      {incomeType !== 'freelancer' ? (
        <TextField
          variant="box"
          label="총급여"
          placeholder="예: 5,000만원"
          inputMode="numeric"
          value={annualSalary}
          hasError={!!salaryError}
          help={salaryError ?? undefined}
          onChange={(e) => setAnnualSalary(onlyDigits(e.target.value))}
        />
      ) : (
        <TextField
          variant="box"
          label="사업소득"
          placeholder="예: 3,000만원"
          inputMode="numeric"
          value={freelanceIncome}
          onChange={(e) => setFreelanceIncome(onlyDigits(e.target.value))}
        />
      )}

      <Spacing size={16} />

      <TextField
        variant="box"
        label="부양가족 수"
        placeholder="본인 제외 인원 수"
        inputMode="numeric"
        value={dependents}
        onChange={(e) => setDependents(onlyDigits(e.target.value))}
      />

      <Spacing size={24} />

      <Button variant="fill" display="block" onClick={handleSubmit}>
        환급액 계산
      </Button>

      <Spacing size={80} />
    </ScreenScaffold>
  );
}
