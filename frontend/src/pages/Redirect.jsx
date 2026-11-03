import React from 'react';
import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {Logo,Spinner} from '../components/UI';
import {api} from '../services/api';
import {safeNavigate} from '../utils/links';
export default function Redirect(){const {shortCode}=useParams();const [error,setError]=useState('');useEffect(()=>{api.resolve(shortCode).then(url=>{if(url)safeNavigate(url)}).catch(e=>setError(e.message));},[shortCode]);return <div className="redirect-page"><Logo/>{error?<><h1>Unable to open link</h1><p>{error}</p><Link to="/" className="btn btn-primary">Back home</Link></>:<><Spinner/><h2>Redirecting you…</h2><p>Taking you to your destination.</p></>}</div>}
