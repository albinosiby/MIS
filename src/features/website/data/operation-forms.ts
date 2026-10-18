import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "cms-pages",
    area: "website",
    title: "Website pages",
    description:
      "Draft, preview and publish school information independently of private records.",
    fields: [
      {
        name: "slug",
        label: "URL slug",
        type: "text",
        required: true,
      },
      {
        name: "body",
        label: "Page content",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "published"],
  },
  {
    kind: "cms-news",
    area: "website",
    title: "News & gallery",
    description: "Prepare school news and image URL metadata for publication.",
    fields: [
      {
        name: "body",
        label: "News content",
        type: "textarea",
        required: true,
      },
      {
        name: "imageUrl",
        label: "Public image URL",
        type: "text",
        required: true,
      },
    ],
    states: ["draft", "published"],
  },
  {
    kind: "domains",
    area: "website",
    title: "Domains & SEO",
    description:
      "Prepare domain configuration; DNS and hosting are not connected.",
    fields: [
      {
        name: "domain",
        label: "School domain",
        type: "text",
        required: true,
      },
      {
        name: "description",
        label: "Site description",
        type: "textarea",
        required: true,
      },
    ],
    states: ["unconfigured"],
  },
];
