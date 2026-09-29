import { useEffect, useState } from "react";

import { Icons } from "../ui/Icons.jsx";
import { apiEvents } from "../../lib/api/events.js";

/**
 * Sticky banner for rate limiting and queue back-pressure.
 *
 * Driven by the transport event bus rather than by whichever screen happened to
 * make the failing request, and self-dismissing on a timer so a stale warning
 * cannot linger after the condition clears.
 */
export function ThrottleBanner() {
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let countdown = null;

    const off = apiEvents.on("throttled", (payload) => {
      setNotice({ ...payload, at: Date.now() });
      clearInterval(countdown);

      // Re-check the same condition on a tick; drop the banner once the
      // retry window has elapsed.
      const seconds = Math.max(1, payload.retryAfter ?? 30);
      let remaining = seconds;
      countdown = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(countdown);
          setNotice(null);
        }
      }, 1000);
    });

    return () => {
      clearInterval(countdown);
      off();
    };
  }, []);

  if (!notice) return null;

  const seconds = Math.max(1, notice.retryAfter ?? 30);
  const isBackpressure = notice.kind === "backpressure";

  return (
    <div
      className="throttle-banner"
      data-kind={notice.kind}
      role="alert"
    >
      <span className="throttle-banner__icon">
        {isBackpressure ? <Icons.gauge size={16} /> : <Icons.clock size={16} />}
      </span>
      <div className="throttle-banner__text">
        <span className="throttle-banner__title">
          {isBackpressure ? "Queue at capacity" : "Rate limit reached"}
        </span>{" "}
        <span className="throttle-banner__detail">
          {notice.message ?? "Requests are being throttled. Retrying shortly."}
        </span>
      </div>
      <span className="throttle-banner__count">{seconds}s</span>
      <button
        type="button"
        className="throttle-banner__close"
        onClick={() => setNotice(null)}
        aria-label="Dismiss"
      >
        <Icons.close size={14} />
      </button>
    </div>
  );
}
