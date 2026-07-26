import { Top } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";

// TDD red phase 플레이스홀더 — Coder가 packet 0010에서 실제 게이팅/분석 로직으로 교체 예정.
export default function Analysis() {
  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>절세 상세 분석</Top.TitleParagraph>} />}
    >
      <div />
    </ScreenScaffold>
  );
}
