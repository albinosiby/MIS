/** Presentation metadata for typed operational forms; canonical people live in shared models. */
export type FieldDefinition = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select";
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  relation?: string;
};
export type ModuleDefinition = {
  kind: string;
  area: string;
  title: string;
  description: string;
  fields: FieldDefinition[];
  states: string[];
  student?: boolean;
  staff?: boolean;
  restricted?: boolean;
};
