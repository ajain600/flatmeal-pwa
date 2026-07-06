import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase.js'

// ─── CONSTANTS ────────────────────────────────────────────────────
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DEFAULT_SETTINGS = {
  flatmates: ['Aman (Admin)','Ravi','Priya','Arjun'],
  cook_name: 'Ramesh Bhaiya',
  cook_phone: '919876543210',
  flat_name: 'Flat 4B',
  app_link: 'https://your-app.vercel.app',
  bl_reminder_hour: 6,
  dinner_reminder_hour: 16,
  min_votes_to_send: 1,
  meal_options: {
    Breakfast: ['🥣 Poha','🫓 Upma','🫔 Paratha','🍚 Idli-Sambar','🍳 Bread & Eggs','🌾 Oats','🥪 Sandwich','⏭️ Skip'],
    Lunch:     ['🍛 Dal-Rice','🫘 Rajma-Chawal','🧆 Chole-Bhature','🧀 Paneer Sabzi','🫓 Roti-Sabzi','🍚 Pulao','🍖 Biryani','⏭️ Skip'],
    Dinner:    ['🫓 Roti-Dal','🍲 Khichdi','🍳 Fried Rice','🍝 Pasta','🧀 Paneer Curry','🥗 Mixed Veg','🍜 Soup & Bread','⏭️ Skip'],
  },
  message_format: `🍽️ *{flatName} Meal Plan — {day}*\n_{subtitle}_\n\n🌅 *Breakfast:* {breakfast}\n☀️ *Lunch:* {lunch}\n🌙 *Dinner:* {dinner}\n\n{comment}Please prepare accordingly. Thank you! 🙏\n— {flatName} Residents`,
  reminder_format: `🔔 *{flatName} — Vote Now!*\n\nPlease choose your preference for *{day}*:\n📌 {meals}\n\n👉 Vote here: {appLink}\n\n_Takes 30 seconds. Cook needs your vote! 🍳_`,
}

// ─── HELPERS ──────────────────────────────────────────────────────
function getTodayIdx() { const d = new Date().getDay(); return d === 0 ? 6 : d - 1 }
function getTomorrowIdx() { return (getTodayIdx() + 1) % 7 }
function getNow() { const n = new Date(); return { h: n.getHours(), m: n.getMinutes() } }
function todayKey() { return DAYS[getTodayIdx()] }
function tomorrowKey() { return DAYS[getTomorrowIdx()] }

function getWinner(voteList, meal) {
  const counts = {}
  voteList.filter(v => v.meal === meal).forEach(v => { counts[v.choice] = (counts[v.choice]||0)+1 })
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0] || null
}

function getVoterCount(voteList, meals) {
  return new Set(voteList.filter(v => meals.includes(v.meal)).map(v => v.flatmate)).size
}

function buildCookMsg(day, voteList, settings, comment) {
  const winner = (meal) => {
    const w = getWinner(voteList, meal)
    if (!w) return 'No votes yet'
    const total = voteList.filter(v=>v.meal===meal).length
    return `${w[0].replace(/^.\s/,'')} (${w[1]}/${total} votes)`
  }
  const subtitle = `Votes at ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`
  return settings.message_format
    .replace(/{flatName}/g, settings.flat_name)
    .replace(/{day}/g, day)
    .replace(/{subtitle}/g, subtitle)
    .replace(/{breakfast}/g, winner('Breakfast'))
    .replace(/{lunch}/g, winner('Lunch'))
    .replace(/{dinner}/g, winner('Dinner'))
    .replace(/{comment}/g, comment ? `💬 _Note: ${comment}_\n` : '')
    .replace(/{appLink}/g, settings.app_link)
}

function buildReminderMsg(meals, day, settings) {
  return settings.reminder_format
    .replace(/{flatName}/g, settings.flat_name)
    .replace(/{day}/g, day)
    .replace(/{meals}/g, meals.join(' & '))
    .replace(/{appLink}/g, settings.app_link)
}

function openWA(phone, msg) {
  window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank')
}
function openGroupWA(msg) {
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank')
}

// ─── SMALL UI ─────────────────────────────────────────────────────
function Avatar({ name, size=34 }) {
  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  const colors = ['#f97316','#8b5cf6','#06b6d4','#10b981','#f43f5e','#f59e0b']
  const color = colors[name.charCodeAt(0)%colors.length]
  return <div style={{width:size,height:size,borderRadius:'50%',background:color,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:size*0.36,flexShrink:0}}>{initials}</div>
}

function Toast({ msg, type='info', onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,4000); return()=>clearTimeout(t) },[onClose])
  const bg = type==='success'?'#16a34a':type==='warn'?'#d97706':'#1e293b'
  return <div style={{position:'fixed',bottom:96,left:'50%',transform:'translateX(-50%)',background:bg,color:'#fff',borderRadius:14,padding:'12px 22px',fontSize:14,fontWeight:600,zIndex:9999,boxShadow:'0 8px 30px #0003',maxWidth:320,textAlign:'center',whiteSpace:'pre-line',animation:'fadeUp .3s ease'}}>{msg}</div>
}

function Card({ children, style={} }) {
  return <div style={{background:'#fff',borderRadius:16,padding:'18px',boxShadow:'0 1px 8px #0001',marginBottom:14,...style}}>{children}</div>
}

function Label({ children }) {
  return <div style={{fontSize:11,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.2,marginBottom:10}}>{children}</div>
}

function Spinner() {
  return <div style={{width:20,height:20,border:'3px solid #f97316',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
}

function OnlineDot({ online }) {
  return <div style={{width:8,height:8,borderRadius:'50%',background:online?'#22c55e':'#94a3b8',flexShrink:0,boxShadow:online?'0 0 0 3px #bbf7d055':undefined}}/>
}

// ─── INSTALL BANNER ───────────────────────────────────────────────
function InstallBanner() {
  const [prompt, setPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [iosGuide, setIosGuide] = useState(false)

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const standalone = window.navigator.standalone === true
    setIsIOS(ios)
    if (ios && !standalone) setShow(true)
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); setPrompt(e); setShow(true) })
  }, [])

  if (!show) return null
  if (isIOS) return (
    <div style={{background:'linear-gradient(135deg,#0f172a,#1e293b)',borderRadius:16,padding:'16px 18px',marginBottom:14,border:'1px solid #334155'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <span style={{fontSize:24}}>📲</span>
        <div><div style={{color:'#f1f5f9',fontWeight:800,fontSize:14}}>Add to Home Screen</div><div style={{color:'#64748b',fontSize:12}}>Works offline · Looks like a real app</div></div>
      </div>
      <button onClick={()=>setIosGuide(!iosGuide)} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'none',background:'#f97316',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}}>
        {iosGuide?'Hide steps':'How to install ▶'}
      </button>
      {iosGuide&&['1️⃣ Tap the Share button ↑ at the bottom of Safari','2️⃣ Scroll down → tap "Add to Home Screen"','3️⃣ Tap "Add" top right — done! 🎉'].map((s,i)=>(
        <div key={i} style={{marginTop:8,background:'#1e293b',borderRadius:10,padding:'10px 12px',fontSize:13,color:'#cbd5e1'}}>{s}</div>
      ))}
    </div>
  )
  return (
    <div style={{background:'linear-gradient(135deg,#0f172a,#1e293b)',borderRadius:16,padding:'16px 18px',marginBottom:14,border:'1px solid #334155'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
        <span style={{fontSize:24}}>📲</span>
        <div><div style={{color:'#f1f5f9',fontWeight:800,fontSize:14}}>Install App</div><div style={{color:'#64748b',fontSize:12}}>Home screen icon · Works offline · No App Store</div></div>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={async()=>{ if(!prompt)return; prompt.prompt(); await prompt.userChoice; setShow(false) }} style={{flex:1,padding:'10px 0',borderRadius:10,border:'none',background:'#f97316',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}}>✅ Install Now</button>
        <button onClick={()=>setShow(false)} style={{padding:'10px 14px',borderRadius:10,border:'1px solid #334155',background:'transparent',color:'#64748b',fontSize:13,cursor:'pointer'}}>Later</button>
      </div>
    </div>
  )
}

// ─── VOTE TAB ─────────────────────────────────────────────────────
function VoteTab({ settings, votes, loading, activeDay, setActiveDay, me, setMe, openMeals, onVote, realtime }) {
  const dayVotes = votes.filter(v => v.day === activeDay)

  return (
    <>
      <InstallBanner />

      {/* Realtime indicator */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,padding:'8px 14px',background:'#fff',borderRadius:12,boxShadow:'0 1px 4px #0001'}}>
        <OnlineDot online={realtime}/>
        <span style={{fontSize:12,color:realtime?'#16a34a':'#94a3b8',fontWeight:600}}>
          {realtime?'Live — votes update in real time':'Connecting...'}
        </span>
        {loading&&<Spinner/>}
      </div>

      {/* Who am I */}
      <Card>
        <Label>I am voting as</Label>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {settings.flatmates.map(fm=>(
            <button key={fm} onClick={()=>{ setMe(fm); localStorage.setItem('flatmate_me', fm) }} style={{display:'flex',alignItems:'center',gap:7,padding:'7px 12px',borderRadius:10,border:`2px solid ${me===fm?'#f97316':'#e2e8f0'}`,background:me===fm?'#fff7ed':'#f8fafc',cursor:'pointer'}}>
              <Avatar name={fm} size={22}/>
              <span style={{fontSize:13,fontWeight:me===fm?700:500,color:me===fm?'#ea580c':'#374151'}}>{fm.replace(' (Admin)','')}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Day selector */}
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {[todayKey(), tomorrowKey()].map((d,i)=>(
          <button key={d} onClick={()=>setActiveDay(d)} style={{flex:1,padding:'10px 0',borderRadius:12,border:`2px solid ${activeDay===d?'#f97316':'#e2e8f0'}`,background:activeDay===d?'#f97316':'#fff',color:activeDay===d?'#fff':'#475569',fontWeight:700,fontSize:14,cursor:'pointer',lineHeight:1.4}}>
            {i===0?'📅 Today':'📆 Tomorrow'}<br/><span style={{fontSize:11,fontWeight:400,opacity:.8}}>{d}</span>
          </button>
        ))}
      </div>

      {/* Meal cards */}
      {['Breakfast','Lunch','Dinner'].map((meal,i)=>{
        const emojis=['🌅','☀️','🌙']
        const isOpen = openMeals.includes(meal)
        const myVote = dayVotes.find(v=>v.meal===meal&&v.flatmate===me)?.choice
        return (
          <div key={meal} style={{background:isOpen?'#fff':'#f8fafc',borderRadius:16,padding:'16px 18px',marginBottom:12,border:`2px solid ${myVote?'#f97316':isOpen?'#e2e8f0':'#f1f5f9'}`,opacity:isOpen?1:0.55,transition:'all .2s'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:isOpen?12:0}}>
              <span style={{fontSize:24}}>{emojis[i]}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,color:'#1e293b',fontSize:15}}>{meal}</div>
                {myVote
                  ? <div style={{fontSize:12,color:'#16a34a',fontWeight:600}}>✓ {myVote.replace(/^.\s/,'')}</div>
                  : <div style={{fontSize:12,color:isOpen?'#94a3b8':'#c8d2dc'}}>{isOpen?'Tap to choose':'Opens later'}</div>}
              </div>
              {myVote&&<div style={{width:24,height:24,borderRadius:'50%',background:'#dcfce7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>✓</div>}
            </div>
            {isOpen&&(
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {(settings.meal_options[meal]||[]).map(opt=>(
                  <button key={opt} onClick={()=>onVote(activeDay, meal, opt)} style={{padding:'7px 13px',borderRadius:20,border:'none',cursor:'pointer',background:myVote===opt?'#f97316':'#f1f5f9',color:myVote===opt?'#fff':'#475569',fontWeight:myVote===opt?700:500,fontSize:13,transition:'all .15s'}}>
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Voter status */}
      {openMeals.length > 0 && (
        <Card>
          <Label>Who voted — live</Label>
          {settings.flatmates.map(fm=>{
            const voted = openMeals.filter(m=>dayVotes.find(v=>v.meal===m&&v.flatmate===fm)).length
            const done = voted===openMeals.length
            return (
              <div key={fm} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #f8fafc'}}>
                <Avatar name={fm} size={28}/>
                <div style={{flex:1,fontSize:13,fontWeight:600,color:'#374151'}}>{fm.replace(' (Admin)','')}</div>
                <div style={{display:'flex',gap:5}}>
                  {openMeals.map(m=>(
                    <div key={m} title={m} style={{width:10,height:10,borderRadius:'50%',background:dayVotes.find(v=>v.meal===m&&v.flatmate===fm)?'#22c55e':'#e2e8f0',transition:'background .3s'}}/>
                  ))}
                </div>
                <div style={{fontSize:12,fontWeight:700,color:done?'#16a34a':'#94a3b8',minWidth:50,textAlign:'right'}}>{done?'Done ✓':`${voted}/${openMeals.length}`}</div>
              </div>
            )
          })}
        </Card>
      )}

      {openMeals.length===0&&(
        <div style={{textAlign:'center',padding:'40px 20px'}}>
          <div style={{fontSize:52,marginBottom:14}}>⏰</div>
          <div style={{fontWeight:800,fontSize:16,color:'#475569',marginBottom:8}}>Voting not open yet</div>
          <div style={{fontSize:13,color:'#94a3b8',lineHeight:1.7}}>
            🌅 Breakfast & Lunch opens at <b>{settings.bl_reminder_hour}:00 {settings.bl_reminder_hour<12?'AM':'PM'}</b><br/>
            🌙 Dinner opens at <b>{settings.dinner_reminder_hour}:00 {settings.dinner_reminder_hour<12?'AM':'PM'}</b>
          </div>
        </div>
      )}
    </>
  )
}

// ─── RESULTS TAB ──────────────────────────────────────────────────
function ResultsTab({ settings, votes, activeDay, openMeals, setToast }) {
  const dayVotes = votes.filter(v => v.day === activeDay)
  const allMeals = ['Breakfast','Lunch','Dinner']
  const voterCount = getVoterCount(dayVotes, allMeals)
  const canSend = voterCount >= settings.min_votes_to_send
  const [comment, setComment] = useState('')

  return (
    <>
      {/* Reminder buttons */}
      <Card>
        <Label>Send WhatsApp Reminders</Label>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{background:'#f0f9ff',borderRadius:12,padding:'14px'}}>
            <div style={{fontWeight:700,color:'#0369a1',fontSize:13,marginBottom:2}}>🌅☀️ Breakfast & Lunch Reminder</div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:10}}>For tomorrow ({tomorrowKey()}) — send at {settings.bl_reminder_hour}:00 AM</div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>openGroupWA(buildReminderMsg(['Breakfast','Lunch'],tomorrowKey(),settings))} style={{flex:1,padding:'9px 0',borderRadius:9,border:'none',background:'#25D366',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}}>📤 Group</button>
              <button onClick={()=>openWA(settings.cook_phone,buildReminderMsg(['Breakfast','Lunch'],tomorrowKey(),settings))} style={{flex:1,padding:'9px 0',borderRadius:9,border:'2px solid #25D366',background:'#fff',color:'#16a34a',fontWeight:700,fontSize:13,cursor:'pointer'}}>🧑‍🍳 Cook</button>
            </div>
          </div>
          <div style={{background:'#fff7ed',borderRadius:12,padding:'14px'}}>
            <div style={{fontWeight:700,color:'#c2410c',fontSize:13,marginBottom:2}}>🌙 Dinner Reminder</div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:10}}>For today ({todayKey()}) — send at {settings.dinner_reminder_hour}:00 PM</div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>openGroupWA(buildReminderMsg(['Dinner'],todayKey(),settings))} style={{flex:1,padding:'9px 0',borderRadius:9,border:'none',background:'#25D366',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}}>📤 Group</button>
              <button onClick={()=>openWA(settings.cook_phone,buildReminderMsg(['Dinner'],todayKey(),settings))} style={{flex:1,padding:'9px 0',borderRadius:9,border:'2px solid #25D366',background:'#fff',color:'#16a34a',fontWeight:700,fontSize:13,cursor:'pointer'}}>🧑‍🍳 Cook</button>
            </div>
          </div>
        </div>
      </Card>

      {/* Live results */}
      <Card>
        <Label>Live Votes — {activeDay}</Label>
        {allMeals.map((meal,i)=>{
          const mv = dayVotes.filter(v=>v.meal===meal)
          const counts={}; mv.forEach(v=>{counts[v.choice]=(counts[v.choice]||0)+1})
          const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1])
          const total=mv.length
          const emojis=['🌅','☀️','🌙']
          return (
            <div key={meal} style={{marginBottom:i<2?18:0,paddingBottom:i<2?18:0,borderBottom:i<2?'1px solid #f8fafc':'none'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontWeight:700,color:'#1e293b',fontSize:14}}>{emojis[i]} {meal}</span>
                <span style={{fontSize:11,color:'#94a3b8'}}>{total} vote{total!==1?'s':''}</span>
              </div>
              {sorted.length===0
                ? <div style={{fontSize:13,color:'#cbd5e1',fontStyle:'italic'}}>No votes yet</div>
                : sorted.map(([k,v],idx)=>(
                  <div key={k} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                    <span>{idx===0?'🏆':'  '}</span>
                    <div style={{width:115,fontSize:12,color:'#374151',fontWeight:idx===0?700:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{k.replace(/^.\s/,'')}</div>
                    <div style={{flex:1,background:'#f1f5f9',borderRadius:99,height:8,overflow:'hidden'}}>
                      <div style={{width:`${(v/Math.max(total,1))*100}%`,height:8,background:idx===0?'#f97316':'#cbd5e1',borderRadius:99,transition:'width .5s'}}/>
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:idx===0?'#f97316':'#94a3b8',minWidth:14}}>{v}</div>
                  </div>
                ))
              }
            </div>
          )
        })}
      </Card>

      {/* Comment */}
      <Card>
        <Label>Note for cook's message</Label>
        <textarea value={comment} onChange={e=>setComment(e.target.value)}
          placeholder="e.g. Less spicy today · Priya skipping dinner · Extra roti please..."
          style={{width:'100%',padding:'11px 13px',borderRadius:10,border:'2px solid #e2e8f0',fontSize:14,minHeight:76,outline:'none',color:'#1e293b',background:'#f8fafc',lineHeight:1.5,resize:'none'}}/>
      </Card>

      {/* Send to cook */}
      <div style={{background:canSend?'linear-gradient(135deg,#f97316,#ea580c)':'#f8fafc',borderRadius:16,padding:'20px',marginBottom:14,border:canSend?'none':'2px dashed #e2e8f0',boxShadow:canSend?'0 6px 24px #f9731644':'none'}}>
        <div style={{fontWeight:800,fontSize:16,color:canSend?'#fff':'#94a3b8',marginBottom:4}}>
          {canSend?`✅ ${voterCount} vote(s) in — send to cook!`:`⏳ Need ${settings.min_votes_to_send} vote to unlock`}
        </div>
        <div style={{fontSize:13,color:canSend?'#fed7aa':'#94a3b8',marginBottom:canSend?16:0}}>
          {canSend?`Ready to send to ${settings.cook_name}`:`${settings.min_votes_to_send} vote unlocks the cook message`}
        </div>
        {canSend&&(
          <>
            <div style={{background:'#0002',borderRadius:12,padding:'12px 14px',marginBottom:14,fontSize:12,color:'#fff',whiteSpace:'pre-wrap',lineHeight:1.8,fontFamily:'monospace'}}>
              {buildCookMsg(activeDay,dayVotes,settings,comment)}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>openWA(settings.cook_phone,buildCookMsg(activeDay,dayVotes,settings,comment))} style={{flex:1,padding:'12px 0',borderRadius:11,border:'none',background:'#fff',color:'#ea580c',fontWeight:800,fontSize:14,cursor:'pointer'}}>📲 {settings.cook_name}</button>
              <button onClick={()=>openGroupWA(buildCookMsg(activeDay,dayVotes,settings,comment))} style={{flex:1,padding:'12px 0',borderRadius:11,border:'2px solid #fff',background:'transparent',color:'#fff',fontWeight:800,fontSize:14,cursor:'pointer'}}>📤 Group</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────
function SettingsTab({ settings, onSave, setToast }) {
  const [section, setSection] = useState('people')
  const [draft, setDraft] = useState(()=>JSON.parse(JSON.stringify(settings)))
  const [newOpt, setNewOpt] = useState({Breakfast:'',Lunch:'',Dinner:''})
  const [saving, setSaving] = useState(false)
  const [notifStatus, setNotifStatus] = useState(Notification?.permission||'default')

  // Sync draft when settings change (realtime update from another device)
  useEffect(()=>{ setDraft(JSON.parse(JSON.stringify(settings))) },[settings])

  async function saveAll() {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setToast({ msg:'💾 Settings saved for everyone!', type:'success' })
  }

  async function enableNotif() {
    if(!('Notification' in window)) { setToast({msg:'Notifications not supported on this browser.',type:'warn'}); return }
    const perm = await Notification.requestPermission()
    setNotifStatus(perm)
    if(perm==='granted') {
      // Schedule daily notifications
      scheduleLocalNotifs(draft)
      setToast({msg:'🔔 Notifications enabled! You\'ll be reminded daily.',type:'success'})
    } else {
      setToast({msg:'⚠️ Please allow notifications in browser settings.',type:'warn'})
    }
  }

  function scheduleLocalNotifs(s) {
    // Use setTimeout for today's remaining reminders
    const now = new Date()
    const blTime = new Date(); blTime.setHours(s.bl_reminder_hour,0,0,0)
    const dinnerTime = new Date(); dinnerTime.setHours(s.dinner_reminder_hour,0,0,0)
    if(blTime > now) {
      setTimeout(()=>{ new Notification(`🌅 ${s.flat_name} — Vote for Breakfast & Lunch!`,{body:'Open the app to vote for tomorrow.',icon:'/icon-192.png'}) }, blTime-now)
    }
    if(dinnerTime > now) {
      setTimeout(()=>{ new Notification(`🌙 ${s.flat_name} — Vote for Dinner!`,{body:'Don\'t forget to vote for tonight\'s dinner.',icon:'/icon-192.png'}) }, dinnerTime-now)
    }
  }

  const secs=[['people','👥','People'],['meals','🍽️','Meals'],['timing','⏰','Timing'],['messages','💬','Format']]

  return (
    <>
      <div style={{display:'flex',gap:4,marginBottom:16,background:'#fff',borderRadius:14,padding:5,boxShadow:'0 1px 6px #0001'}}>
        {secs.map(([key,em,label])=>(
          <button key={key} onClick={()=>setSection(key)} style={{flex:1,padding:'9px 0',borderRadius:10,border:'none',background:section===key?'#f97316':'transparent',color:section===key?'#fff':'#64748b',fontWeight:700,fontSize:12,cursor:'pointer',lineHeight:1.4}}>
            {em}<br/>{label}
          </button>
        ))}
      </div>

      {/* PEOPLE */}
      {section==='people'&&(
        <Card>
          <Label>Flatmates</Label>
          {draft.flatmates.map((fm,i)=>(
            <div key={i} style={{display:'flex',gap:8,marginBottom:8,alignItems:'center'}}>
              <Avatar name={fm} size={28}/>
              <input value={fm} onChange={e=>{const a=[...draft.flatmates];a[i]=e.target.value;setDraft({...draft,flatmates:a})}}
                style={{flex:1,padding:'9px 12px',borderRadius:10,border:'2px solid #e2e8f0',fontSize:16,outline:'none'}}/>
              {draft.flatmates.length>2&&<button onClick={()=>setDraft({...draft,flatmates:draft.flatmates.filter((_,j)=>j!==i)})} style={{width:32,height:32,borderRadius:8,border:'none',background:'#fee2e2',color:'#ef4444',fontWeight:800,fontSize:16,cursor:'pointer'}}>×</button>}
            </div>
          ))}
          {draft.flatmates.length<6&&<button onClick={()=>setDraft({...draft,flatmates:[...draft.flatmates,'New Flatmate']})} style={{width:'100%',padding:'9px 0',borderRadius:10,border:'2px dashed #e2e8f0',background:'transparent',color:'#94a3b8',fontWeight:600,fontSize:13,cursor:'pointer',marginTop:4}}>+ Add Flatmate</button>}

          <div style={{marginTop:20}}><Label>Cook & Flat</Label></div>
          {[['Cook Name','cook_name','Ramesh Bhaiya'],['Cook WhatsApp (no + or spaces)','cook_phone','919876543210'],['Flat Name','flat_name','Flat 4B'],['App Link (your Vercel URL)','app_link','https://yourflat.vercel.app']].map(([lbl,key,ph])=>(
            <div key={key} style={{marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:'#64748b',marginBottom:5}}>{lbl}</div>
              <input value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})} placeholder={ph}
                style={{width:'100%',padding:'10px 13px',borderRadius:10,border:'2px solid #e2e8f0',fontSize:16,outline:'none',background:'#f8fafc'}}/>
            </div>
          ))}

          <div style={{marginTop:16,background:notifStatus==='granted'?'#f0fdf4':'#f8fafc',borderRadius:12,padding:'14px',border:`1px solid ${notifStatus==='granted'?'#bbf7d0':'#e2e8f0'}`}}>
            <div style={{fontWeight:700,fontSize:14,color:'#1e293b',marginBottom:4}}>🔔 Push Notifications</div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:10}}>Each flatmate must enable this on their own phone</div>
            <button onClick={enableNotif} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'none',background:notifStatus==='granted'?'#16a34a':'#f97316',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}}>
              {notifStatus==='granted'?'✅ Notifications Active':'Enable Notifications on This Phone'}
            </button>
          </div>

          <div style={{marginTop:12,background:'#f0f9ff',borderRadius:12,padding:'14px'}}>
            <div style={{fontWeight:700,color:'#0369a1',fontSize:14,marginBottom:6}}>📤 Share App Link</div>
            <button onClick={()=>{
              const msg=`🍽️ Hey! Vote for our daily meals at ${draft.flat_name} here:\n\n${draft.app_link}\n\nOpen → Add to Home Screen → Done! 📲`
              if(navigator.share) navigator.share({title:'Flat Meal Planner',text:msg,url:draft.app_link})
              else { navigator.clipboard?.writeText(draft.app_link); setToast({msg:'🔗 Link copied!',type:'success'}) }
            }} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'2px solid #25D366',background:'#fff',color:'#16a34a',fontWeight:700,fontSize:13,cursor:'pointer'}}>
              📲 Share via WhatsApp
            </button>
          </div>
        </Card>
      )}

      {/* MEALS */}
      {section==='meals'&&['Breakfast','Lunch','Dinner'].map((meal,i)=>(
        <Card key={meal}>
          <Label>{['🌅','☀️','🌙'][i]} {meal} Options</Label>
          {(draft.meal_options[meal]||[]).map((opt,j)=>(
            <div key={j} style={{display:'flex',gap:8,marginBottom:7,alignItems:'center'}}>
              <div style={{flex:1,padding:'9px 12px',borderRadius:10,background:'#f8fafc',fontSize:13,color:'#374151'}}>{opt}</div>
              <button onClick={()=>setDraft({...draft,meal_options:{...draft.meal_options,[meal]:draft.meal_options[meal].filter((_,k)=>k!==j)}})} style={{width:30,height:30,borderRadius:8,border:'none',background:'#fee2e2',color:'#ef4444',fontWeight:800,cursor:'pointer'}}>×</button>
            </div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <input value={newOpt[meal]} onChange={e=>setNewOpt({...newOpt,[meal]:e.target.value})}
              onKeyDown={e=>{if(e.key==='Enter'&&newOpt[meal].trim()){setDraft({...draft,meal_options:{...draft.meal_options,[meal]:[...draft.meal_options[meal],newOpt[meal].trim()]}});setNewOpt({...newOpt,[meal]:''});} }}
              placeholder={`Add ${meal.toLowerCase()} option...`}
              style={{flex:1,padding:'9px 12px',borderRadius:10,border:'2px solid #e2e8f0',fontSize:14,outline:'none'}}/>
            <button onClick={()=>{if(newOpt[meal].trim()){setDraft({...draft,meal_options:{...draft.meal_options,[meal]:[...draft.meal_options[meal],newOpt[meal].trim()]}});setNewOpt({...newOpt,[meal]:''});}}} style={{padding:'9px 16px',borderRadius:10,border:'none',background:'#f97316',color:'#fff',fontWeight:700,fontSize:16,cursor:'pointer'}}>+</button>
          </div>
        </Card>
      ))}

      {/* TIMING */}
      {section==='timing'&&(
        <Card>
          <Label>Voting Times</Label>
          {[['🌅 Breakfast & Lunch opens at','bl_reminder_hour'],['🌙 Dinner opens at','dinner_reminder_hour']].map(([lbl,key])=>(
            <div key={key} style={{marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:700,color:'#374151',marginBottom:8}}>{lbl}</div>
              <input type="time" value={`${String(draft[key]).padStart(2,'0')}:00`}
                onChange={e=>setDraft({...draft,[key]:parseInt(e.target.value)})}
                style={{width:'100%',padding:'11px 16px',borderRadius:10,border:'2px solid #f97316',fontSize:18,fontWeight:700,color:'#ea580c',outline:'none',background:'#fff7ed'}}/>
            </div>
          ))}
          <div>
            <div style={{fontSize:13,fontWeight:700,color:'#374151',marginBottom:10}}>⚡ Min votes to unlock cook message</div>
            <div style={{display:'flex',gap:8}}>
              {[1,2,3,4].map(n=>(
                <button key={n} onClick={()=>setDraft({...draft,min_votes_to_send:n})} style={{flex:1,padding:'12px 0',borderRadius:10,fontSize:18,fontWeight:800,cursor:'pointer',border:`2px solid ${draft.min_votes_to_send===n?'#f97316':'#e2e8f0'}`,background:draft.min_votes_to_send===n?'#fff7ed':'#f8fafc',color:draft.min_votes_to_send===n?'#ea580c':'#64748b'}}>{n}</button>
              ))}
            </div>
            <div style={{fontSize:12,color:'#94a3b8',marginTop:8}}>Cook message unlocks after <b>{draft.min_votes_to_send}</b> vote{draft.min_votes_to_send>1?'s':''}.</div>
          </div>
        </Card>
      )}

      {/* MESSAGE FORMAT */}
      {section==='messages'&&(
        <>
          {[
            ['Cook Message Format','message_format','🍽️ *{flatName} Meal Plan — {day}*\n_{subtitle}_\n\n🌅 *Breakfast:* {breakfast}\n☀️ *Lunch:* {lunch}\n🌙 *Dinner:* {dinner}\n\n{comment}Please prepare accordingly. Thank you! 🙏\n— {flatName} Residents',220,'{flatName} {day} {subtitle} {breakfast} {lunch} {dinner} {comment}'],
            ['Reminder Message Format','reminder_format','🔔 *{flatName} — Vote Now!*\n\nPlease choose your preference for *{day}*:\n📌 {meals}\n\n👉 Vote here: {appLink}\n\n_Takes 30 seconds. Cook needs your vote! 🍳_',160,'{flatName} {day} {meals} {appLink}'],
          ].map(([lbl,key,def,h,phs])=>(
            <Card key={key}>
              <Label>{lbl}</Label>
              <div style={{fontSize:12,color:'#64748b',marginBottom:10,background:'#f8fafc',borderRadius:8,padding:'8px 12px',lineHeight:1.7}}>
                <b>Placeholders:</b> {phs.split(' ').map(p=><code key={p} style={{color:'#f97316',marginRight:4}}>{`{${p.replace(/[{}]/g,'')}}`}</code>)}
              </div>
              <textarea value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}
                style={{width:'100%',padding:'12px',borderRadius:10,border:'2px solid #e2e8f0',fontSize:13,minHeight:h,outline:'none',lineHeight:1.7,color:'#1e293b',fontFamily:'monospace'}}/>
              <button onClick={()=>setDraft({...draft,[key]:def})} style={{marginTop:8,padding:'7px 14px',borderRadius:8,border:'2px solid #e2e8f0',background:'transparent',color:'#94a3b8',fontSize:12,cursor:'pointer',fontWeight:600}}>↩ Reset</button>
            </Card>
          ))}
        </>
      )}

      <button onClick={saveAll} disabled={saving} style={{width:'100%',padding:'15px 0',borderRadius:14,border:'none',background:saving?'#cbd5e1':'linear-gradient(135deg,#f97316,#ea580c)',color:'#fff',fontWeight:800,fontSize:16,cursor:saving?'not-allowed':'pointer',boxShadow:'0 4px 20px #f9731644',marginTop:4,display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
        {saving?<><Spinner/> Saving...</>:'💾 Save Settings for Everyone'}
      </button>
    </>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────
export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [votes, setVotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [realtime, setRealtime] = useState(false)
  const [tab, setTab] = useState('vote')
  const [toast, setToast] = useState(null)
  const [now, setNow] = useState(getNow())
  const [me, setMe] = useState(()=>localStorage.getItem('flatmate_me')||DEFAULT_SETTINGS.flatmates[0])
  const [activeDay, setActiveDay] = useState(todayKey())
  const channelRef = useRef(null)

  // ── Load settings from Supabase ──
  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase.from('settings').select('*').eq('id','flat').single()
    if (data && !error) {
      setSettings({
        flatmates: data.flatmates,
        cook_name: data.cook_name,
        cook_phone: data.cook_phone,
        flat_name: data.flat_name,
        app_link: data.app_link,
        bl_reminder_hour: data.bl_reminder_hour,
        dinner_reminder_hour: data.dinner_reminder_hour,
        min_votes_to_send: data.min_votes_to_send,
        message_format: data.message_format,
        reminder_format: data.reminder_format,
        meal_options: data.meal_options,
      })
    }
  }, [])

  // ── Load votes ──
  const loadVotes = useCallback(async () => {
    const today = todayKey()
    const tomorrow = tomorrowKey()
    const { data, error } = await supabase.from('votes').select('*').in('day',[today,tomorrow])
    if (data && !error) setVotes(data)
    setLoading(false)
  }, [])

  // ── Initial load ──
  useEffect(() => {
    loadSettings()
    loadVotes()
  }, [loadSettings, loadVotes])

  // ── Real-time subscriptions ──
  useEffect(() => {
    const channel = supabase.channel('flat-realtime')
      .on('postgres_changes', { event:'*', schema:'public', table:'votes' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setVotes(prev => {
            const filtered = prev.filter(v => !(v.day===payload.new.day && v.meal===payload.new.meal && v.flatmate===payload.new.flatmate))
            return [...filtered, payload.new]
          })
        }
      })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'settings' }, () => {
        loadSettings()
      })
      .subscribe(status => {
        setRealtime(status === 'SUBSCRIBED')
      })

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [loadSettings])

  // ── Clock tick ──
  useEffect(() => {
    const t = setInterval(() => setNow(getNow()), 30000)
    return () => clearInterval(t)
  }, [])

  // ── Vote handler ──
  async function handleVote(day, meal, choice) {
    const { error } = await supabase.from('votes').upsert(
      { day, meal, flatmate: me, choice },
      { onConflict: 'day,meal,flatmate' }
    )
    if (error) { setToast({msg:'❌ Vote failed. Check connection.',type:'warn'}); return }
    const vc = getVoterCount([...votes.filter(v=>!(v.day===day&&v.meal===meal&&v.flatmate===me)),{day,meal,flatmate:me,choice}], ['Breakfast','Lunch','Dinner'])
    if (vc >= settings.min_votes_to_send) setToast({msg:`✅ Voted! Cook message is now ready.`,type:'success'})
    else setToast({msg:`✅ ${meal} vote saved!`,type:'success'})
  }

  // ── Save settings to Supabase ──
  async function handleSaveSettings(draft) {
    const { error } = await supabase.from('settings').update({
      flatmates: draft.flatmates,
      cook_name: draft.cook_name,
      cook_phone: draft.cook_phone,
      flat_name: draft.flat_name,
      app_link: draft.app_link,
      bl_reminder_hour: draft.bl_reminder_hour,
      dinner_reminder_hour: draft.dinner_reminder_hour,
      min_votes_to_send: draft.min_votes_to_send,
      message_format: draft.message_format,
      reminder_format: draft.reminder_format,
      meal_options: draft.meal_options,
      updated_at: new Date().toISOString(),
    }).eq('id','flat')
    if (!error) setSettings(draft)
    else setToast({msg:'❌ Save failed. Check Supabase connection.',type:'warn'})
  }

  // ── Open meals ──
  function getOpenMeals(day) {
    const isToday = day===todayKey()
    const isTomorrow = day===tomorrowKey()
    const {h}=now; const open=[]
    if (isToday) open.push('Breakfast','Lunch')
    if (isTomorrow && h>=settings.bl_reminder_hour) open.push('Breakfast','Lunch')
    if (isToday && h>=settings.dinner_reminder_hour) open.push('Dinner')
    return open
  }

  const openMeals = getOpenMeals(activeDay)
  const allVoterCount = getVoterCount(votes.filter(v=>v.day===activeDay), ['Breakfast','Lunch','Dinner'])
  const cookReady = allVoterCount >= settings.min_votes_to_send

  const TABS=[['vote','🗳️','Vote'],['results','📊','Results'],['settings','⚙️','Settings']]

  return (
    <div style={{minHeight:'100vh',background:'#f1f5f9',paddingBottom:88}}>

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)',position:'sticky',top:0,zIndex:50,boxShadow:'0 4px 24px #0006',paddingTop:'env(safe-area-inset-top,0px)'}}>
        <div style={{maxWidth:480,margin:'0 auto',padding:'18px 18px 0'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div>
              <div style={{color:'#f97316',fontWeight:900,fontSize:10,letterSpacing:2,textTransform:'uppercase',marginBottom:3}}>{settings.flat_name} · Meal Planner</div>
              <div style={{color:'#f1f5f9',fontWeight:800,fontSize:20,letterSpacing:-0.5}}>🍽️ Daily Meal Vote</div>
              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:3}}>
                <OnlineDot online={realtime}/>
                <span style={{fontSize:11,color:realtime?'#22c55e':'#64748b',fontWeight:600}}>{realtime?'Live sync':'Connecting...'}</span>
                <span style={{fontSize:11,color:'#475569'}}>· {DAYS[getTodayIdx()]} {String(now.h).padStart(2,'0')}:{String(now.m).padStart(2,'0')}</span>
              </div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{background:cookReady?'#f97316':'rgba(255,255,255,0.07)',borderRadius:14,padding:'10px 16px',border:cookReady?'none':'1px solid #334155'}}>
                <div style={{color:'#fff',fontWeight:900,fontSize:22,lineHeight:1}}>{allVoterCount}<span style={{fontSize:13,fontWeight:500,color:cookReady?'#fed7aa':'#475569'}}>/{settings.flatmates.length}</span></div>
                <div style={{color:cookReady?'#fed7aa':'#64748b',fontSize:10,fontWeight:700,letterSpacing:1,marginTop:2}}>VOTED</div>
              </div>
              {cookReady&&<div style={{fontSize:10,color:'#22c55e',fontWeight:800,marginTop:4}}>✅ COOK READY</div>}
            </div>
          </div>
          <div style={{display:'flex',gap:2}}>
            {TABS.map(([key,em,label])=>(
              <button key={key} onClick={()=>setTab(key)} style={{flex:1,padding:'10px 0',background:tab===key?'#f97316':'transparent',color:tab===key?'#fff':'#64748b',border:'none',borderRadius:'10px 10px 0 0',fontWeight:700,fontSize:13,cursor:'pointer',transition:'all .15s'}}>
                {em} {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{maxWidth:480,margin:'0 auto',padding:'16px 14px'}}>
        {tab==='vote'&&<VoteTab settings={settings} votes={votes} loading={loading} activeDay={activeDay} setActiveDay={setActiveDay} me={me} setMe={setMe} openMeals={openMeals} onVote={handleVote} realtime={realtime}/>}
        {tab==='results'&&<ResultsTab settings={settings} votes={votes} activeDay={activeDay} openMeals={openMeals} setToast={setToast}/>}
        {tab==='settings'&&<SettingsTab settings={settings} onSave={handleSaveSettings} setToast={setToast}/>}
      </div>

      {/* Bottom nav */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:'1px solid #f1f5f9',boxShadow:'0 -4px 20px #0002',zIndex:40,paddingBottom:'env(safe-area-inset-bottom,0px)'}}>
        <div style={{display:'flex',maxWidth:480,margin:'0 auto'}}>
          {TABS.map(([key,em,label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{flex:1,padding:'10px 0 12px',background:'none',border:'none',color:tab===key?'#f97316':'#94a3b8',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,borderTop:tab===key?'3px solid #f97316':'3px solid transparent'}}>
              <span style={{fontSize:20}}>{em}</span>
              <span style={{fontSize:11,fontWeight:tab===key?800:500}}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  )
}
