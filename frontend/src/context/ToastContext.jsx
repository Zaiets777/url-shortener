import React from 'react';
import { createContext,useContext,useState } from 'react';
import { CheckCircle2,X,AlertCircle } from 'lucide-react';
const ToastContext=createContext(null);
export function ToastProvider({children}) {const [toasts,setToasts]=useState([]); const notify=(message,type='success')=>{const id=crypto.randomUUID();setToasts(t=>[...t,{id,message,type}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4200);};return <ToastContext.Provider value={{notify}}>{children}<div className="toast-stack" role="status" aria-live="polite">{toasts.map(t=><div className={`toast ${t.type}`} key={t.id}>{t.type==='success'?<CheckCircle2 size={19}/>:<AlertCircle size={19}/>}<span>{t.message}</span><button aria-label="Dismiss" onClick={()=>setToasts(x=>x.filter(y=>y.id!==t.id))}><X size={16}/></button></div>)}</div></ToastContext.Provider>}
export const useToast=()=>useContext(ToastContext);
