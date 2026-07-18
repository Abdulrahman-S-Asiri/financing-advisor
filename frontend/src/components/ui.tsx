import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants=cva("button",{variants:{variant:{primary:"buttonPrimary",gold:"buttonGold",ghost:"buttonGhost"}},defaultVariants:{variant:"primary"}});

export function Button({ className, variant="primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {variant?:"primary"|"gold"|"ghost"}) {
  return <button className={cn(buttonVariants({variant}),className)} {...props}/>;
}
export function Card({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={cn("card",className)} {...props}/>}
export function Badge({children,tone="default"}:{children:ReactNode;tone?:"default"|"danger"|"success"}){return <span className={cn("badge",tone==="danger"&&"badgeDanger",tone==="success"&&"badgeSuccess")}>{children}</span>}
export function UnverifiedBadge({label}:{label:string}){return <Badge tone="danger">● {label}</Badge>}
export function SimulationBadge({label}:{label:string}){return <Badge>◇ {label}</Badge>}
export function Loading(){return <div className="skeleton" role="status" aria-label="Loading"/>}
export function ErrorState({message,onRetry,label}:{message:string;onRetry?:()=>void;label:string}){return <div className="alert alertError" role="alert"><p>{message}</p>{onRetry&&<Button variant="ghost" onClick={onRetry}>{label}</Button>}</div>}
