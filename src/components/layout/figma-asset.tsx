import { figmaAssets } from "./figma-assets";

type Group = keyof typeof figmaAssets;
type AssetProps<G extends Group> = {
  group: G;
  name: keyof (typeof figmaAssets)[G];
};

// Preserve SVG root dimensions rather than stretching exported artwork.
export function FigmaAsset<G extends Group>({ group, name }: AssetProps<G>) {
  const asset = figmaAssets[group][name] as {
    src: string;
    width?: number;
    height?: number;
  };
  return (
    <img
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt=""
      aria-hidden="true"
      className="figma-icon"
    />
  );
}
