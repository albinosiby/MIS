/** Scan school presentation copy; legacy identifiers and storage keys are not display text. */
import ts from "typescript";
import {readdirSync,readFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";
function files(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
const findings:{file:string;line:number;text:string}[]=[];
for(const file of files("src").filter(f=>f.endsWith(".tsx"))){const source=readFileSync(file,"utf8"),sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function walk(n:ts.Node){
  const text=ts.isJsxText(n)?n.text:ts.isStringLiteral(n)?n.text:"";
  if(/\bdemo\b|\bdemonstration\b|\bdummy\b/i.test(text)&&!text.includes("@")&&!text.includes("/")&&/\s/.test(text))findings.push({file,line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,text:text.trim()});
  ts.forEachChild(n,walk);
 }walk(sf);
}
const report={date:new Date().toISOString(),findings,legacyIdentityAndStorageIdentifiersPreserved:true};
writeFileSync("docs/school-copy-audit.json",JSON.stringify(report,null,2)+"\n");console.log({presentationCopyFindings:findings.length});if(findings.length)process.exitCode=1;
