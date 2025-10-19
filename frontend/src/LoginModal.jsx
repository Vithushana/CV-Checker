// src/LoginModal.jsx
import React, { useState } from 'react'
import { requestOtp, verifyOtp, setToken } from './auth'

const box = {
  position:'fixed', inset:0, display:'grid', placeItems:'center',
  background:'rgba(0,0,0,0.6)', zIndex:1000
}
const card = { background:'#0b1220', border:'1px solid #1f2a44', borderRadius:12, padding:16, width:360, color:'#e2e8f0' }
const label = { fontSize:12, color:'#93c5fd', fontWeight:700, marginBottom:6 }
const input = { width:'100%', background:'#0a0f1d', border:'1px solid #233055', borderRadius:10, padding:'10px 12px', color:'#e2e8f0', outline:'none' }
const row = { display:'flex', gap:8, marginTop:12, alignItems:'center' }
const btn = { background:'#2563eb', border:'1px solid #1d4ed8', borderRadius:10, padding:'10px 16px', color:'#fff', fontWeight:800, cursor:'pointer' }
const ghost = { background:'transparent', border:'1px solid #334155', borderRadius:10, padding:'10px 16px', color:'#cbd5e1', cursor:'pointer' }
const error = { marginTop:10, color:'#fecaca', background:'#7f1d1d', border:'1px solid #ef4444', padding:'10px 12px', borderRadius:10, fontSize:13 }

export default function LoginModal({ onClose, onLoggedIn }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const sendOtp = async () => {
    setErr(''); if (!email.trim()) return setErr('Enter email')
    try { setLoading(true); await requestOtp(email.trim()); setStep(2) }
    catch(e){ setErr(e.message || 'OTP failed') }
    finally{ setLoading(false) }
  }

  const doVerify = async () => {
    setErr(''); if (!code.trim()) return setErr('Enter OTP')
    try { setLoading(true); const { token, user } = await verifyOtp(email.trim(), code.trim()); setToken(token); onLoggedIn(user) ; onClose() }
    catch(e){ setErr(e.message || 'Verify failed') }
    finally{ setLoading(false) }
  }

  return (
    <div style={box} onClick={onClose}>
      <div style={card} onClick={(e)=>e.stopPropagation()}>
        <div style={{ fontWeight:900, marginBottom:10 }}>Login via Email OTP</div>

        <div style={{ marginBottom:10 }}>
          <div style={label}>Email</div>
          <input style={input} type="email" placeholder="you@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} disabled={step===2}/>
        </div>

        {step===2 && (
          <div>
            <div style={label}>OTP Code</div>
            <input style={input} type="text" placeholder="6-digit code" value={code} onChange={(e)=>setCode(e.target.value)} />
          </div>
        )}

        {err && <div style={error}>{err}</div>}

        <div style={row}>
          {step===1 ? (
            <button style={btn} onClick={sendOtp} disabled={loading}>{loading?'Sending…':'Send OTP'}</button>
          ) : (
            <button style={btn} onClick={doVerify} disabled={loading}>{loading?'Verifying…':'Verify & Login'}</button>
          )}
          <button style={ghost} onClick={onClose}>Cancel</button>
        </div>

        {step===2 && <div style={{marginTop:8, fontSize:12, color:'#94a3b8'}}>Didn’t get it? Check spam. OTP expires in 10 minutes.</div>}
      </div>
    </div>
  )
}
