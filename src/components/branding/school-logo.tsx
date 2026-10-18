/** Shared school mark; surrounding wordmarks retain the configured school name. */
export function SchoolLogo({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/brand/school-mark.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      style={{
        flexShrink: 0,
        display: "inline-block",
        verticalAlign: "middle",
      }}
      draggable={false}
    />
  );
}
