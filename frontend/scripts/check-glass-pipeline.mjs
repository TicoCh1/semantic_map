import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
const root=fileURLToPath(new URL("../",import.meta.url));
const errors=[];
const pkg=JSON.parse(await fs.readFile(path.join(root,"package.json"),"utf8"));
if(pkg.dependencies["@form-glass/react"]!=="file:vendor/form-glass-react-0.1.0.tgz") errors.push("Use the vendored, versioned FORM package");
for(const entry of ["src/main.tsx","src/region/main.tsx"]){
 const text=await fs.readFile(path.join(root,entry),"utf8");
 if((text.match(/@form-glass\/react\/styles.css/g)||[]).length!==1) errors.push(`${entry}: import FORM styles once`);
}
// App-owned CSS may arrange controls, but cannot reimplement backdrop recipes.
for(const name of await fs.readdir(path.join(root,"src/styles"))){
 if(!name.endsWith(".css"))continue;
 postcss.parse(await fs.readFile(path.join(root,"src/styles",name),"utf8")).walkDecls(decl=>{
  if(/backdrop-filter$/.test(decl.prop))errors.push(`${name}: competing backdrop renderer`);
 });
}
async function inspect(directory){
 for(const item of await fs.readdir(directory,{withFileTypes:true})){
  const file=path.join(directory,item.name);
  if(item.isDirectory()){await inspect(file);continue;}
  if(!item.name.endsWith(".tsx"))continue;
  const text=await fs.readFile(file,"utf8");
  if(/styles\/GlassMaterial/.test(text))errors.push(`${file}: legacy renderer import`);
  if(/<(?:select)\b/.test(text)&&!file.endsWith("GlassDebugPanel.tsx"))errors.push(`${file}: native dropdown bypasses theme`);
 }
}
await inspect(path.join(root,"src"));
if(errors.length)throw new Error(errors.join("\n"));
console.log("Glass integration check passed: FORM owns backdrop rendering; themed dropdowns are shared.");
