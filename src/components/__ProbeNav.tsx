import { useLocation } from "react-router-dom";

export function ProbeNav() {
  const loc = useLocation();
  return <span data-testid="probe">{loc.pathname}</span>;
}
