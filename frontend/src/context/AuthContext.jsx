import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
const Context=createContext(null);
export function AuthProvider({children}) { const [user,setUser]=useState(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{ let mounted=true; api.me().then(data=>{if(mounted) setUser(data?.user || data || null);}).catch(()=>{if(mounted) setUser(null);}).finally(()=>{if(mounted)setLoading(false);}); return ()=>{mounted=false;}; },[]);
  const login=async(data)=>{const result=await api.login(data); const u=result?.user || result; if (u?.username) setUser(u); else { const profile=await api.me(); setUser(profile?.user || profile); } };
  const logout=async()=>{try{await api.logout();}finally{setUser(null);}};
  return <Context.Provider value={{user,loading,login,logout}}>{children}</Context.Provider>;
}
export const useAuth=()=>useContext(Context);
