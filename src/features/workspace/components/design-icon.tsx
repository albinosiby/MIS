import { workspaceAssets } from "@/components/layout/workspace-assets";
export function DesignIcon({
  group,
  name,
}: {
  group: keyof typeof workspaceAssets;
  name: string;
}) {
  const item = (
    workspaceAssets[group] as Record<
      string,
      { src: string; width: number; height: number }
    >
  )[name];
  if (!item) throw new Error(`Unknown design asset: ${group}/${name}`);
  return (
    <img
      className="ws-design-icon"
      src={item.src}
      alt=""
      width={item.width}
      height={item.height}
    />
  );
}
