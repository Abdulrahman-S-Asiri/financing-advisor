import{describe,expect,it}from"vitest";import ar from"../../../messages/ar.json";import en from"../../../messages/en.json";
function keys(value:unknown,prefix=""):string[]{if(!value||typeof value!=="object")return[prefix];return Object.entries(value).flatMap(([k,v])=>keys(v,prefix?`${prefix}.${k}`:k))}
describe("messages",()=>{it("keeps Arabic and English key parity",()=>expect(keys(ar).sort()).toEqual(keys(en).sort()));it("keeps Arabic as meaningful source copy",()=>expect(ar.landing.title).toContain("تمويلي"))});
