'use client';

/**
 * The Provenance mark, drawn rather than dropped: the pin settles in, the three
 * "…" dots pop in left-to-right, then the P writes itself inside the pin.
 *
 * Geometry is provenance-mark.svg inlined — it has to be inline (not an <img>)
 * for the P's stroke and the dots to be animatable. The P is authored as a single
 * stroked path, so "writing" it is a stroke-dashoffset sweep; `pathLength={1}`
 * normalises the dash to the path's own length so we don't hard-code it.
 *
 * The timeline lives in globals.css (.mark-*) so it sits with the other intro
 * animations and honours prefers-reduced-motion in one place.
 */

interface Props {
  /** Rendered width/height in px. */
  size?: number;
  className?: string;
}

export default function AnimatedMark({ size = 240, className = '' }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      fill="none"
      className={className}
      role="img"
      aria-label="Provenance"
    >
      <defs>
        <clipPath id="mark-anim-clip">
          <path d="M921 377.609C900.836 563.522 705.088 851.777 570.391 996.416C435.218 851.266 240.168 565.566 219.782 377.609C219.782 183.973 376.755 27 570.391 27C764.027 27 921 183.973 921 377.609Z" />
        </clipPath>
      </defs>

      {/* Pin */}
      <path
        className="mark-pin"
        d="M921 377.609C900.836 563.522 705.088 851.777 570.391 996.416C435.218 851.266 240.168 565.566 219.782 377.609C219.782 183.973 376.755 27 570.391 27C764.027 27 921 183.973 921 377.609Z"
        fill="#A33829"
      />

      {/* P — writes on inside the pin */}
      <g clipPath="url(#mark-anim-clip)">
        <path
          className="mark-p"
          pathLength={1}
          d="M410.188 354.996C410.188 187.506 672.372 172.548 714.554 329.838C733.747 401.407 705.907 472.36 641.571 507.022C610.24 526.991 560.148 526.196 525.202 519.147C490.05 512.056 464.411 494.815 427.594 495.218C414.325 496.62 421.839 570.829 421.757 582.153C422.241 613.724 428.096 794.798 428.096 794.798V867"
          stroke="#FAF6F1"
          strokeWidth={80}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* "…" — first, popping left → right so the trail builds toward the pin
          (which fades in behind them afterward). Delays are inline because they're
          the one per-element value the shared class can't carry. */}
      <circle className="mark-dot" style={{ animationDelay: '0s' }} cx="149.532" cy="881.932" r="47.5315" fill="#A33829" />
      <circle className="mark-dot" style={{ animationDelay: '0.13s' }} cx="273.216" cy="881.932" r="47.5315" fill="#A33829" />
      <circle className="mark-dot" style={{ animationDelay: '0.26s' }} cx="396.9" cy="881.932" r="47.5315" fill="#A33829" />
    </svg>
  );
}
