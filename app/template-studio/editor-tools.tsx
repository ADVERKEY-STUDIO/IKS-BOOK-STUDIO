'use client';
import {createContext,useContext,useId,useState,useRef,useEffect,type ReactNode} from 'react';
const ToolsContext=createContext<{active:string|null;setActive:(id:string|null)=>void}|null>(null);
export function EditorTools({children}:{children:ReactNode}){
 const [active,setActive]=useState<string|null>(null);
 return <ToolsContext.Provider value={{active,setActive}}>{children}</ToolsContext.Provider>;
}
export function ToolPanel({title,children,className=''}:{title:string;children:ReactNode;className?:string}){
 const id=useId(),tools=useContext(ToolsContext);
 const [localOpen,setLocalOpen]=useState(false);
 const open=tools?tools.active===id:localOpen;
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null);
 useEffect(()=>{if(open)panel.current?.focus();},[open]);
 const toggle=()=>tools?tools.setActive(open?null:id):setLocalOpen(!open);
 return <div className={`ts-tool ${className}${open?' is-open':''}`}>
  <button type="button" ref={trigger} className="ts-tool-trigger" aria-expanded={open} aria-controls={id} onClick={toggle}>{title}</button>
  {open&&<section ref={panel} tabIndex={-1} id={id} className="ts-tool-body" aria-label={title} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();toggle();trigger.current?.focus();}}}>
   <header><h2>{title}</h2><button type="button" onClick={()=>{toggle();trigger.current?.focus();}} aria-label={`Close ${title}`}>Done</button></header>
   {children}
  </section>}
 </div>;
}
