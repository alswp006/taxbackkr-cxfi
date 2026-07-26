# TaxBackKR

앱인토스 (Vite + React + TDS) 연말정산·종합소득세 환급액을 30초 안에 시뮬레이션하고, 절세 팁을 리워드 광고 뒤에 공개하는 세금 환급 계산기 대부분의 직장인과 프리랜서가 연말정산·종합소득세 신고 시즌마다 환급액 예측을 못 하고, 홈택스는 너무 복잡해서 포기한다. 절세 방법도 알기 어렵다.

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/Analysis` | Analysis |
| `/Checklist` | Checklist |
| `/Home` | Home |
| `/Records` | Records |
| `/Result` | Result |
| `/Simulate` | Simulate |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-07-26
