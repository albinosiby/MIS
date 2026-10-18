import type {ReactNode} from "react";
export function WorkflowField({label,children}:{label:string;children:ReactNode}){return <label>{label}{children}</label>;}
