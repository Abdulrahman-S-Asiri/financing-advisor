import{describe,expect,it}from"vitest";import fs from"node:fs";import path from"node:path";
function files(dir:string):string[]{return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.(tsx?|css)$/.test(e.name)?[path.join(dir,e.name)]:[])}
describe("direction safety",()=>{it("avoids physical Tailwind direction utilities",()=>{const violations=files(path.resolve("src")).flatMap(file=>{const text=fs.readFileSync(file,"utf8");return /\b(?:ml|mr|pl|pr|left|right|text-left|text-right)-/.test(text)?[file]:[]});expect(violations).toEqual([])})});
