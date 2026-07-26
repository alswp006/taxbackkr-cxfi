import { useLocation } from "react-router-dom";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";

export function ProbeNavSdk() {
  const loc = useLocation();
  void generateHapticFeedback;
  return <span data-testid="probe-sdk">{loc.pathname}</span>;
}
