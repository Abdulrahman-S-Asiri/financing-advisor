export const personas=[{id:"ahmed_borderline",ar:"أحمد — حالة حدّية",en:"Ahmed — borderline",amount:80000,tenor:48,age:28},{id:"sara_strong",ar:"سارة — قدرة قوية",en:"Sara — strong",amount:120000,tenor:60,age:34},{id:"khalid_rejected",ar:"خالد — مرفوض مع أسباب",en:"Khalid — rejected with reasons",amount:150000,tenor:36,age:41}] as const;
export type PersonaId=(typeof personas)[number]["id"];
