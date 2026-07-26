import { useEffect } from "react";
import { loadFullScreenAd } from "@apps-in-toss/web-framework";

export default function DebugAd() {
  useEffect(() => {
    loadFullScreenAd({ slotId: "x", onEvent: () => console.log("onEvent fired") } as any);
  }, []);
  return <div>debug</div>;
}
