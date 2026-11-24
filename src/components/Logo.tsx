export default function Logo({ size = 32, withName = true }: { size?: number; withName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/maro.svg" width={size} height={size} alt="" className="rounded-[22%]" />
      {withName && <span className="text-lg font-semibold tracking-tight">MARO <span className="text-saffron">AI</span></span>}
    </span>
  );
}
