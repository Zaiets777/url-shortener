import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Navigate,Outlet} from 'react-router-dom';
import {AuthProvider,useAuth} from './context/AuthContext';
import {ToastProvider} from './context/ToastContext';
import {PageLoader} from './components/UI';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Stats from './pages/Stats';
import Redirect from './pages/Redirect';
import './styles.css';
function PrivateRoute(){const {user,loading}=useAuth();if(loading)return <PageLoader/>;return user?<Outlet/>:<Navigate to="/auth/login" replace/>}
function App(){return <BrowserRouter><AuthProvider><ToastProvider><Routes><Route path="/" element={<Landing/>}/><Route path="/auth/:type" element={<Auth/>}/><Route element={<PrivateRoute/>}><Route path="/dashboard" element={<Dashboard/>}/><Route path="/dashboard/:shortCode" element={<Stats/>}/></Route><Route path="/r/:shortCode" element={<Redirect/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></ToastProvider></AuthProvider></BrowserRouter>}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
