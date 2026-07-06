import { useState, useEffect, useRef } from "react";

// ─── DEFAULT CONFIG ────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  flatmates: ["Aman (Admin)", "Ravi", "Priya", "Arjun"],
  cookName: "Ramesh Bhaiya",
  cookPhone: "919876543210",
  flatName: "Flat 4B",
  appLink: "https://your-app-link.com",
  blReminderHour: 6,
  dinnerReminderHour: 16,
  minVotesToSend: 1,
  notificationsEnabled: false,
  messageFormat: `🍽️ *{flatName} Meal Plan — {day}*
_{subtitle}_

🌅 *Breakfast:* {breakfast}
☀️ *Lunch:* {lunch}
🌙 *Dinner:* {dinner}

{comment}Please prepare accordingly. Thank you! 🙏
— {flatName} Residents`,
  reminderFormat: `🔔 *{flatName} — Vote Now!*

Please choose your preference for *{day}*:
📌 {meals}

👉 Vote here: {appLink}

_Takes 30 seconds. Cook needs your vote! 🍳_`,
};

const DEFAULT_MEAL_OPTIONS = {
  Breakfast: ["🥣 Poha","🫓 Upma","🫔 Paratha","🍚 Idli-Sambar","🍳 Bread & Eggs","🌾 Oats","🥪 Sandwich","⏭️ Skip"],
  Lunch:     ["🍛 Dal-Rice","🫘 Rajma-Chawal","🧆 Chole-Bhature","🧀 Paneer Sabzi","🫓 Roti-Sabzi","🍚 Pulao","🍖 Biryani","⏭️ Skip"],
  Dinner:    ["🫓 Roti-Dal","🍲 Khichdi","🍳 Fried Rice","🍝 Pasta","🧀 Paneer Curry","🥗 Mixed Veg","🍜 Soup & Bread","⏭️ Skip"],
};

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ─── STORAGE ─────────────────────────────────────────────────────
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function persist(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── HELPERS ──────────────────────────────────────────────────────
function getTodayIdx() { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }
function getTomorrowIdx() { return (getTodayIdx() + 1) % 7; }
function getNow() { const n = new Date(); return { h: n.getHours(), m: n.getMinutes() }; }

function getWinner(mealVotes) {
  const counts = {};
  Object.values(mealVotes || {}).forEach(c => { counts[c] = (counts[c]||0)+1; });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0] || null;
}

function getVoterCount(votes, meals) {
  const voters = new Set();
  meals.forEach(m => Object.keys(votes[m]||{}).forEach(v => voters.add(v)));
  return voters.size;
}

function buildCookMsg(day, votes, settings, comment) {
  const winner = (meal) => {
    const w = getWinner(votes[meal]);
    if (!w) return "No votes yet";
    const counts = {};
    Object.values(votes[meal]||{}).forEach(c=>{counts[c]=(counts[c]||0)+1;});
    const total = Object.values(counts).reduce((a,b)=>a+b,0);
    return `${w[0].replace(/^.\s/,"")} (${w[1]}/${total} votes)`;
  };
  const subtitle = `Votes at ${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`;
  return settings.messageFormat
    .replace(/{flatName}/g, settings.flatName)
    .replace(/{day}/g, day)
    .replace(/{subtitle}/g, subtitle)
    .replace(/{breakfast}/g, winner("Breakfast"))
    .replace(/{lunch}/g, winner("Lunch"))
    .replace(/{dinner}/g, winner("Dinner"))
    .replace(/{comment}/g, comment ? `💬 _Note: ${comment}_\n` : "")
    .replace(/{appLink}/g, settings.appLink);
}

function buildReminderMsg(meals, day, settings) {
  return settings.reminderFormat
    .replace(/{flatName}/g, settings.flatName)
    .replace(/{day}/g, day)
    .replace(/{meals}/g, meals.join(" & "))
    .replace(/{appLink}/g, settings.appLink);
}

// ─── PUSH NOTIFICATIONS ───────────────────────────────────────────
async function requestNotifPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  const result = await Notification.requestPermission();
  return result;
}

function scheduleNotifications(settings) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  // Clear old scheduled
  const existing = load("scheduledNotifs", []);
  existing.forEach(id => clearTimeout(id));

  const now = new Date();
  const scheduled = [];

  function scheduleAt(hour, minute, title, body) {
    const target = new Date();
    target.setHours(hour, minute, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1); // schedule for next day if passed
    const delay = target - now;
    const id = setTimeout(() => {
      new Notification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png", vibrate: [200,100,200] });
    }, delay);
    scheduled.push({ id: id.toString(), time: target.toISOString() });
  }

  scheduleAt(settings.blReminderHour, 0,
    `🌅 ${settings.flatName} — Vote for Breakfast & Lunch!`,
    `Open the app to vote for tomorrow's meals. Cook needs your input!`
  );
  scheduleAt(settings.dinnerReminderHour, 0,
    `🌙 ${settings.flatName} — Vote for Dinner!`,
    `Don't forget to vote for tonight's dinner before the cook decides.`
  );

  persist("scheduledNotifs", scheduled);
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────
function Avatar({ name, size=34 }) {
  const initials = name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const colors = ["#f97316","#8b5cf6","#06b6d4","#10b981","#f43f5e","#f59e0b"];
  const color = colors[name.charCodeAt(0)%colors.length];
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:color,color:"#fff",
      display:"flex",alignItems:"center",justifyContent:"center",
      fontWeight:800,fontSize:size*0.36,flexShrink:0,boxShadow:"0 2px 6px #0002"}}>
      {initials}
    </div>
  );
}

function Toast({ msg, type="info", onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,4000); return()=>clearTimeout(t); },[onClose]);
  const bg = type==="success"?"#16a34a":type==="warn"?"#d97706":"#1e293b";
  return (
    <div style={{position:"fixed",bottom:96,left:"50%",transform:"translateX(-50%)",
      background:bg,color:"#fff",borderRadius:14,padding:"12px 22px",
      fontSize:14,fontWeight:600,zIndex:9999,boxShadow:"0 8px 30px #0003",
      maxWidth:320,textAlign:"center",whiteSpace:"pre-line",animation:"fadeUp .3s ease"}}>
      {msg}
    </div>
  );
}

function Card({ children, style={} }) {
  return (
    <div style={{background:"#fff",borderRadius:16,padding:"18px",
      boxShadow:"0 1px 8px #0001",marginBottom:14,...style}}>
      {children}
    </div>
  );
}

function Label({ children }) {
  return <div style={{fontSize:11,fontWeight:800,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1.2,marginBottom:10}}>{children}</div>;
}

function FieldInput({ label, value, onChange, placeholder, type="text" }) {
  return (
    <div style={{marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:5}}>{label}</div>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type}
        style={{width:"100%",padding:"10px 13px",borderRadius:10,border:"2px solid #e2e8f0",
          fontSize:16,outline:"none",background:"#f8fafc",color:"#1e293b"}}/>
    </div>
  );
}

function WaBtn({ label, onClick, outline }) {
  return (
    <button onClick={onClick} style={{
      flex:1,padding:"10px 0",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13,
      background:outline?"#fff":"#25D366",color:outline?"#16a34a":"#fff",
      border:outline?"2px solid #25D366":"none",
    }}>{label}</button>
  );
}

// ─── INSTALL BANNER ──────────────────────────────────────────────
function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    const standalone = window.navigator.standalone === true;
    setIsIOS(ios);
    if (ios && !standalone) setShow(true);

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    });
  }, []);

  if (!show) return null;

  if (isIOS) return (
    <>
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",borderRadius:16,padding:"16px 18px",marginBottom:14,border:"1px solid #334155"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <span style={{fontSize:24}}>📲</span>
          <div>
            <div style={{color:"#f1f5f9",fontWeight:800,fontSize:14}}>Add to Home Screen</div>
            <div style={{color:"#64748b",fontSize:12}}>Use it like a real app — no App Store needed</div>
          </div>
        </div>
        <button onClick={()=>setShowIOSGuide(!showIOSGuide)} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"none",background:"#f97316",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          {showIOSGuide?"Hide steps":"Show me how ▶"}
        </button>
        {showIOSGuide&&(
          <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
            {[
              ["1️⃣","Tap the Share button","The box with an arrow at the bottom of Safari"],
              ["2️⃣","Scroll down & tap","Add to Home Screen"],
              ["3️⃣","Tap Add","Top right corner — done! 🎉"],
            ].map(([n,t,d])=>(
              <div key={n} style={{display:"flex",gap:10,alignItems:"flex-start",background:"#1e293b",borderRadius:10,padding:"10px 12px"}}>
                <span style={{fontSize:18}}>{n}</span>
                <div><div style={{color:"#f1f5f9",fontWeight:700,fontSize:13}}>{t}</div><div style={{color:"#64748b",fontSize:12}}>{d}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",borderRadius:16,padding:"16px 18px",marginBottom:14,border:"1px solid #334155"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <span style={{fontSize:24}}>📲</span>
        <div>
          <div style={{color:"#f1f5f9",fontWeight:800,fontSize:14}}>Install as App</div>
          <div style={{color:"#64748b",fontSize:12}}>Works offline · Home screen icon · No App Store</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={async()=>{
          if(!deferredPrompt) return;
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          setShow(false);
        }} style={{flex:1,padding:"10px 0",borderRadius:10,border:"none",background:"#f97316",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          ✅ Install App
        </button>
        <button onClick={()=>setShow(false)} style={{padding:"10px 14px",borderRadius:10,border:"1px solid #334155",background:"transparent",color:"#64748b",fontWeight:600,fontSize:13,cursor:"pointer"}}>
          Later
        </button>
      </div>
    </div>
  );
}

// ─── VOTE TAB ─────────────────────────────────────────────────────
function VoteTab({ settings, mealOptions, allVotes, setAllVotes, activeDay, setActiveDay, me, setMe, openMeals, setToast }) {
  const votes = allVotes[activeDay] || {};
  const todayIdx = getTodayIdx();
  const tomorrowIdx = getTomorrowIdx();

  function handleVote(meal, opt) {
    const updated = {
      ...allVotes,
      [activeDay]: {
        ...(allVotes[activeDay]||{}),
        [meal]: {...((allVotes[activeDay]||{})[meal]||{}),[me]:opt},
      },
    };
    setAllVotes(updated);
    persist("flatVotes", updated);
    const vc = getVoterCount(updated[activeDay]||{}, openMeals.length?openMeals:["Breakfast","Lunch","Dinner"]);
    if (vc >= settings.minVotesToSend) {
      setToast({ msg:`✅ Voted! ${vc} vote(s) in — go to Results to send cook.`, type:"success" });
    } else {
      setToast({ msg:`✅ ${meal} saved!`, type:"success" });
    }
  }

  return (
    <>
      <InstallBanner />

      {/* Who am I */}
      <Card>
        <Label>I am voting as</Label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {settings.flatmates.map(fm=>(
            <button key={fm} onClick={()=>setMe(fm)} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 12px",borderRadius:10,
              border:`2px solid ${me===fm?"#f97316":"#e2e8f0"}`,background:me===fm?"#fff7ed":"#f8fafc",cursor:"pointer"}}>
              <Avatar name={fm} size={22}/>
              <span style={{fontSize:13,fontWeight:me===fm?700:500,color:me===fm?"#ea580c":"#374151"}}>{fm.replace(" (Admin)","")}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Day tabs */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[DAYS[todayIdx],DAYS[tomorrowIdx]].map((d,i)=>(
          <button key={d} onClick={()=>setActiveDay(d)} style={{flex:1,padding:"10px 0",borderRadius:12,
            border:`2px solid ${activeDay===d?"#f97316":"#e2e8f0"}`,
            background:activeDay===d?"#f97316":"#fff",
            color:activeDay===d?"#fff":"#475569",fontWeight:700,fontSize:14,cursor:"pointer"}}>
            {i===0?"📅 Today":"📆 Tomorrow"}<br/>
            <span style={{fontSize:11,fontWeight:400,opacity:.8}}>{d}</span>
          </button>
        ))}
      </div>

      {/* Meal cards */}
      {["Breakfast","Lunch","Dinner"].map((meal,i)=>{
        const emojis=["🌅","☀️","🌙"];
        const isOpen=openMeals.includes(meal);
        const myVote=votes[meal]?.[me];
        return (
          <div key={meal} style={{background:isOpen?"#fff":"#f8fafc",borderRadius:16,padding:"16px 18px",marginBottom:12,
            border:`2px solid ${myVote?"#f97316":isOpen?"#e2e8f0":"#f1f5f9"}`,
            opacity:isOpen?1:0.55,transition:"all .2s"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:isOpen?12:0}}>
              <span style={{fontSize:24}}>{emojis[i]}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,color:"#1e293b",fontSize:15}}>{meal}</div>
                {myVote
                  ? <div style={{fontSize:12,color:"#16a34a",fontWeight:600}}>✓ {myVote.replace(/^.\s/,"")}</div>
                  : <div style={{fontSize:12,color:isOpen?"#94a3b8":"#c8d2dc"}}>{isOpen?"Tap to choose":"Opens at "+( meal==="Dinner"?settings.dinnerReminderHour+":00":settings.blReminderHour+":00")}</div>}
              </div>
              {myVote&&<div style={{width:24,height:24,borderRadius:"50%",background:"#dcfce7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✓</div>}
            </div>
            {isOpen&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {(mealOptions[meal]||[]).map(opt=>(
                  <button key={opt} onClick={()=>handleVote(meal,opt)} style={{
                    padding:"7px 13px",borderRadius:20,border:"none",cursor:"pointer",
                    background:myVote===opt?"#f97316":"#f1f5f9",
                    color:myVote===opt?"#fff":"#475569",
                    fontWeight:myVote===opt?700:500,fontSize:13,transition:"all .15s",
                  }}>{opt}</button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Voter tracker */}
      {openMeals.length>0&&(
        <Card>
          <Label>Flatmate vote status</Label>
          {settings.flatmates.map(fm=>{
            const voted=openMeals.filter(m=>votes[m]?.[fm]).length;
            const done=voted===openMeals.length;
            return (
              <div key={fm} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid #f8fafc"}}>
                <Avatar name={fm} size={28}/>
                <div style={{flex:1,fontSize:13,fontWeight:600,color:"#374151"}}>{fm.replace(" (Admin)","")}</div>
                <div style={{display:"flex",gap:5}}>
                  {openMeals.map(m=>(
                    <div key={m} title={m} style={{width:10,height:10,borderRadius:"50%",
                      background:votes[m]?.[fm]?"#22c55e":"#e2e8f0",transition:"background .3s"}}/>
                  ))}
                </div>
                <div style={{fontSize:12,fontWeight:700,color:done?"#16a34a":"#94a3b8",minWidth:50,textAlign:"right"}}>
                  {done?"Done ✓":`${voted}/${openMeals.length}`}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {openMeals.length===0&&(
        <div style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{fontSize:52,marginBottom:14}}>⏰</div>
          <div style={{fontWeight:800,fontSize:16,color:"#475569",marginBottom:8}}>Voting closed right now</div>
          <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.7}}>
            🌅 Breakfast & Lunch opens at <b>{settings.blReminderHour}:00 {settings.blReminderHour<12?"AM":"PM"}</b><br/>
            🌙 Dinner opens at <b>{settings.dinnerReminderHour}:00 {settings.dinnerReminderHour<12?"AM":"PM"}</b>
          </div>
        </div>
      )}
    </>
  );
}

// ─── RESULTS TAB ──────────────────────────────────────────────────
function ResultsTab({ settings, allVotes, activeDay, openMeals, setToast }) {
  const votes = allVotes[activeDay] || {};
  const allMeals = ["Breakfast","Lunch","Dinner"];
  const voterCount = getVoterCount(votes, allMeals);
  const canSend = voterCount >= settings.minVotesToSend;
  const [comment, setComment] = useState("");
  const todayIdx = getTodayIdx();
  const tomorrowIdx = getTomorrowIdx();

  function openWA(phone, msg) { window.open(`https://wa.me/${phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,"_blank"); }
  function openGroupWA(msg) { window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`,"_blank"); }

  return (
    <>
      {/* Reminder cards */}
      <Card>
        <Label>Send Vote Reminders via WhatsApp</Label>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>

          <div style={{background:"#f0f9ff",borderRadius:12,padding:"14px"}}>
            <div style={{fontWeight:700,color:"#0369a1",fontSize:13,marginBottom:2}}>🌅☀️ Breakfast & Lunch reminder</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:10}}>
              For tomorrow ({DAYS[tomorrowIdx]}) — send around {settings.blReminderHour}:00 {settings.blReminderHour<12?"AM":"PM"}
            </div>
            <div style={{display:"flex",gap:8}}>
              <WaBtn label="📤 Group" onClick={()=>openGroupWA(buildReminderMsg(["Breakfast","Lunch"],DAYS[tomorrowIdx],settings))}/>
              <WaBtn label="🧑‍🍳 Cook" onClick={()=>openWA(settings.cookPhone,buildReminderMsg(["Breakfast","Lunch"],DAYS[tomorrowIdx],settings))} outline/>
            </div>
          </div>

          <div style={{background:"#fff7ed",borderRadius:12,padding:"14px"}}>
            <div style={{fontWeight:700,color:"#c2410c",fontSize:13,marginBottom:2}}>🌙 Dinner reminder</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:10}}>
              For today ({DAYS[todayIdx]}) — send around {settings.dinnerReminderHour}:00 {settings.dinnerReminderHour<12?"AM":"PM"}
            </div>
            <div style={{display:"flex",gap:8}}>
              <WaBtn label="📤 Group" onClick={()=>openGroupWA(buildReminderMsg(["Dinner"],DAYS[todayIdx],settings))}/>
              <WaBtn label="🧑‍🍳 Cook" onClick={()=>openWA(settings.cookPhone,buildReminderMsg(["Dinner"],DAYS[todayIdx],settings))} outline/>
            </div>
          </div>
        </div>
      </Card>

      {/* Live bar chart */}
      <Card>
        <Label>Live Results — {activeDay}</Label>
        {allMeals.map((meal,i)=>{
          const mv=votes[meal]||{};
          const counts={};
          Object.values(mv).forEach(c=>{counts[c]=(counts[c]||0)+1;});
          const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
          const total=sorted.reduce((s,[,v])=>s+v,0);
          const emojis=["🌅","☀️","🌙"];
          return (
            <div key={meal} style={{marginBottom:i<2?18:0,paddingBottom:i<2?18:0,borderBottom:i<2?"1px solid #f8fafc":"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontWeight:700,color:"#1e293b",fontSize:14}}>{emojis[i]} {meal}</span>
                <span style={{fontSize:11,color:"#94a3b8"}}>{total} vote{total!==1?"s":""}</span>
              </div>
              {sorted.length===0
                ? <div style={{fontSize:13,color:"#cbd5e1",fontStyle:"italic"}}>No votes yet</div>
                : sorted.map(([k,v],idx)=>(
                  <div key={k} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <span>{idx===0?"🏆":"  "}</span>
                    <div style={{width:110,fontSize:12,color:"#374151",fontWeight:idx===0?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{k.replace(/^.\s/,"")}</div>
                    <div style={{flex:1,background:"#f1f5f9",borderRadius:99,height:8,overflow:"hidden"}}>
                      <div style={{width:`${(v/Math.max(total,1))*100}%`,height:8,background:idx===0?"#f97316":"#cbd5e1",borderRadius:99,transition:"width .5s"}}/>
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:idx===0?"#f97316":"#94a3b8",minWidth:14}}>{v}</div>
                  </div>
                ))
              }
            </div>
          );
        })}
      </Card>

      {/* Comment */}
      <Card>
        <Label>Add note to cook's message</Label>
        <textarea value={comment} onChange={e=>setComment(e.target.value)}
          placeholder="e.g. Less spicy today · Priya skipping dinner · Extra roti please..."
          style={{width:"100%",padding:"11px 13px",borderRadius:10,border:"2px solid #e2e8f0",
            fontSize:14,minHeight:80,outline:"none",color:"#1e293b",background:"#f8fafc",lineHeight:1.5}}/>
        {comment&&<div style={{fontSize:12,color:"#94a3b8",marginTop:6}}>💬 This note will be included in the WhatsApp message.</div>}
      </Card>

      {/* Send to cook */}
      <div style={{
        background:canSend?"linear-gradient(135deg,#f97316,#ea580c)":"#f8fafc",
        borderRadius:16,padding:"20px",marginBottom:14,
        border:canSend?"none":"2px dashed #e2e8f0",
        boxShadow:canSend?"0 6px 24px #f9731644":"none",
      }}>
        <div style={{fontWeight:800,fontSize:16,color:canSend?"#fff":"#94a3b8",marginBottom:4}}>
          {canSend?`✅ ${voterCount} vote(s) collected!`:`⏳ Waiting for ${settings.minVotesToSend} vote to unlock`}
        </div>
        <div style={{fontSize:13,color:canSend?"#fed7aa":"#94a3b8",marginBottom:canSend?16:0}}>
          {canSend?`Ready to send meal plan to ${settings.cookName}`:`Cook message unlocks after ${settings.minVotesToSend} person votes`}
        </div>
        {canSend&&(
          <>
            <div style={{background:"#0002",borderRadius:12,padding:"12px 14px",marginBottom:14,
              fontSize:12,color:"#fff",whiteSpace:"pre-wrap",lineHeight:1.8,fontFamily:"monospace"}}>
              {buildCookMsg(activeDay,votes,settings,comment)}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>openWA(settings.cookPhone,buildCookMsg(activeDay,votes,settings,comment))}
                style={{flex:1,padding:"12px 0",borderRadius:11,border:"none",background:"#fff",
                  color:"#ea580c",fontWeight:800,fontSize:14,cursor:"pointer"}}>
                📲 {settings.cookName}
              </button>
              <button onClick={()=>openGroupWA(buildCookMsg(activeDay,votes,settings,comment))}
                style={{flex:1,padding:"12px 0",borderRadius:11,border:"2px solid #fff",
                  background:"transparent",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}}>
                📤 Group
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────
function SettingsTab({ settings, setSettings, mealOptions, setMealOptions, setToast }) {
  const [section, setSection] = useState("people");
  const [draft, setDraft] = useState(()=>JSON.parse(JSON.stringify(settings)));
  const [mealDraft, setMealDraft] = useState(()=>JSON.parse(JSON.stringify(mealOptions)));
  const [newOpt, setNewOpt] = useState({Breakfast:"",Lunch:"",Dinner:""});
  const [notifStatus, setNotifStatus] = useState(Notification?.permission||"default");

  function saveAll() {
    setSettings(draft);
    setMealOptions(mealDraft);
    persist("flatSettings", draft);
    persist("flatMealOptions", mealDraft);
    if (draft.notificationsEnabled) scheduleNotifications(draft);
    setToast({ msg:"💾 Settings saved!", type:"success" });
  }

  async function handleNotifToggle() {
    const perm = await requestNotifPermission();
    setNotifStatus(perm);
    if (perm==="granted") {
      const updated = {...draft, notificationsEnabled:true};
      setDraft(updated);
      scheduleNotifications(updated);
      setToast({ msg:"🔔 Notifications ON! You'll be reminded daily.", type:"success" });
    } else {
      setToast({ msg:"⚠️ Allow notifications in your browser settings.", type:"warn" });
    }
  }

  const sections=[["people","👥","People"],["meals","🍽️","Meals"],["timing","⏰","Timing"],["messages","💬","Format"]];

  return (
    <>
      {/* Sub-nav */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:"#fff",borderRadius:14,padding:5,boxShadow:"0 1px 6px #0001"}}>
        {sections.map(([key,em,label])=>(
          <button key={key} onClick={()=>setSection(key)} style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",
            background:section===key?"#f97316":"transparent",
            color:section===key?"#fff":"#64748b",fontWeight:700,fontSize:12,cursor:"pointer",lineHeight:1.4}}>
            {em}<br/>{label}
          </button>
        ))}
      </div>

      {/* ── PEOPLE ── */}
      {section==="people"&&(
        <Card>
          <Label>Flatmates (up to 6)</Label>
          {draft.flatmates.map((fm,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
              <Avatar name={fm} size={28}/>
              <input value={fm} onChange={e=>{const a=[...draft.flatmates];a[i]=e.target.value;setDraft({...draft,flatmates:a});}}
                style={{flex:1,padding:"9px 12px",borderRadius:10,border:"2px solid #e2e8f0",fontSize:16,outline:"none"}}/>
              {draft.flatmates.length>2&&(
                <button onClick={()=>setDraft({...draft,flatmates:draft.flatmates.filter((_,j)=>j!==i)})}
                  style={{width:32,height:32,borderRadius:8,border:"none",background:"#fee2e2",color:"#ef4444",fontWeight:800,fontSize:16,cursor:"pointer"}}>×</button>
              )}
            </div>
          ))}
          {draft.flatmates.length<6&&(
            <button onClick={()=>setDraft({...draft,flatmates:[...draft.flatmates,"New Flatmate"]})}
              style={{width:"100%",padding:"9px 0",borderRadius:10,border:"2px dashed #e2e8f0",background:"transparent",color:"#94a3b8",fontWeight:600,fontSize:13,cursor:"pointer",marginTop:4}}>
              + Add Flatmate
            </button>
          )}
          <div style={{marginTop:20}}>
            <Label>Cook & Flat Details</Label>
            <FieldInput label="Cook's Name" value={draft.cookName} onChange={v=>setDraft({...draft,cookName:v})} placeholder="Ramesh Bhaiya"/>
            <FieldInput label="Cook's WhatsApp (with country code, no +)" value={draft.cookPhone} onChange={v=>setDraft({...draft,cookPhone:v})} placeholder="919876543210"/>
            <FieldInput label="Flat / House Name" value={draft.flatName} onChange={v=>setDraft({...draft,flatName:v})} placeholder="Flat 4B"/>
            <FieldInput label="Hosted App Link" value={draft.appLink} onChange={v=>setDraft({...draft,appLink:v})} placeholder="https://yourflat.vercel.app"/>
          </div>

          {/* Notifications */}
          <div style={{marginTop:20,background:notifStatus==="granted"?"#f0fdf4":"#f8fafc",borderRadius:12,padding:"14px",border:`1px solid ${notifStatus==="granted"?"#bbf7d0":"#e2e8f0"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>🔔 Push Notifications</div>
                <div style={{fontSize:12,color:"#64748b"}}>Daily reminders on your phone at meal times</div>
              </div>
              <div style={{fontSize:12,padding:"4px 10px",borderRadius:8,background:notifStatus==="granted"?"#dcfce7":"#f1f5f9",color:notifStatus==="granted"?"#16a34a":"#94a3b8",fontWeight:700}}>
                {notifStatus==="granted"?"ON":"OFF"}
              </div>
            </div>
            <button onClick={handleNotifToggle} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"none",
              background:notifStatus==="granted"?"#16a34a":"#f97316",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
              {notifStatus==="granted"?"✅ Notifications Active — Tap to re-schedule":"Enable Notifications"}
            </button>
          </div>

          {/* Share app */}
          <div style={{marginTop:14,background:"#f0f9ff",borderRadius:12,padding:"14px"}}>
            <div style={{fontWeight:700,fontSize:14,color:"#0369a1",marginBottom:6}}>📤 Share App with Flatmates</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:10}}>Send the link so everyone can install it on their phone</div>
            <button onClick={()=>{
              const msg=`🍽️ Hey! We're using this app for daily meal voting at ${draft.flatName}.\n\nInstall it on your phone: ${draft.appLink}\n\n_Open the link → Add to Home Screen → Done! Takes 10 sec_ 📲`;
              if(navigator.share) navigator.share({title:"Flat Meal Planner",text:msg,url:draft.appLink});
              else { navigator.clipboard?.writeText(draft.appLink); setToast({msg:"🔗 Link copied!",type:"success"}); }
            }} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"2px solid #25D366",background:"#fff",color:"#16a34a",fontWeight:700,fontSize:13,cursor:"pointer"}}>
              📲 Share via WhatsApp
            </button>
          </div>
        </Card>
      )}

      {/* ── MEALS ── */}
      {section==="meals"&&(
        <>
          {["Breakfast","Lunch","Dinner"].map((meal,i)=>(
            <Card key={meal}>
              <Label>{["🌅","☀️","🌙"][i]} {meal} Options</Label>
              {mealDraft[meal].map((opt,j)=>(
                <div key={j} style={{display:"flex",gap:8,marginBottom:7,alignItems:"center"}}>
                  <div style={{flex:1,padding:"9px 12px",borderRadius:10,background:"#f8fafc",fontSize:13,color:"#374151"}}>{opt}</div>
                  <button onClick={()=>setMealDraft({...mealDraft,[meal]:mealDraft[meal].filter((_,k)=>k!==j)})}
                    style={{width:30,height:30,borderRadius:8,border:"none",background:"#fee2e2",color:"#ef4444",fontWeight:800,cursor:"pointer"}}>×</button>
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <input value={newOpt[meal]} onChange={e=>setNewOpt({...newOpt,[meal]:e.target.value})}
                  onKeyDown={e=>{if(e.key==="Enter"&&newOpt[meal].trim()){setMealDraft({...mealDraft,[meal]:[...mealDraft[meal],newOpt[meal].trim()]});setNewOpt({...newOpt,[meal]:""});}}}
                  placeholder={`New ${meal.toLowerCase()} option...`}
                  style={{flex:1,padding:"9px 12px",borderRadius:10,border:"2px solid #e2e8f0",fontSize:14,outline:"none"}}/>
                <button onClick={()=>{if(newOpt[meal].trim()){setMealDraft({...mealDraft,[meal]:[...mealDraft[meal],newOpt[meal].trim()]});setNewOpt({...newOpt,[meal]:""});}}}
                  style={{padding:"9px 16px",borderRadius:10,border:"none",background:"#f97316",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer"}}>+</button>
              </div>
            </Card>
          ))}
        </>
      )}

      {/* ── TIMING ── */}
      {section==="timing"&&(
        <Card>
          <Label>Voting & Reminder Times</Label>

          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:8}}>🌅 Breakfast & Lunch voting opens at:</div>
            <input type="time" value={`${String(draft.blReminderHour).padStart(2,"0")}:00`}
              onChange={e=>setDraft({...draft,blReminderHour:parseInt(e.target.value)})}
              style={{padding:"11px 16px",borderRadius:10,border:"2px solid #f97316",fontSize:18,fontWeight:700,color:"#ea580c",outline:"none",background:"#fff7ed",width:"100%"}}/>
            <div style={{fontSize:12,color:"#94a3b8",marginTop:6}}>App shows voting from this time. Send reminder before this.</div>
          </div>

          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:8}}>🌙 Dinner voting opens at:</div>
            <input type="time" value={`${String(draft.dinnerReminderHour).padStart(2,"0")}:00`}
              onChange={e=>setDraft({...draft,dinnerReminderHour:parseInt(e.target.value)})}
              style={{padding:"11px 16px",borderRadius:10,border:"2px solid #f97316",fontSize:18,fontWeight:700,color:"#ea580c",outline:"none",background:"#fff7ed",width:"100%"}}/>
          </div>

          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:10}}>⚡ Minimum votes to unlock cook message:</div>
            <div style={{display:"flex",gap:8}}>
              {[1,2,3,4].map(n=>(
                <button key={n} onClick={()=>setDraft({...draft,minVotesToSend:n})}
                  style={{flex:1,padding:"12px 0",borderRadius:10,fontSize:18,fontWeight:800,cursor:"pointer",
                    border:`2px solid ${draft.minVotesToSend===n?"#f97316":"#e2e8f0"}`,
                    background:draft.minVotesToSend===n?"#fff7ed":"#f8fafc",
                    color:draft.minVotesToSend===n?"#ea580c":"#64748b"}}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{fontSize:12,color:"#94a3b8",marginTop:8}}>
              Cook message unlocks after <b>{draft.minVotesToSend}</b> person{draft.minVotesToSend>1?"s":""} vote{draft.minVotesToSend===1?"s":""}.
            </div>
          </div>
        </Card>
      )}

      {/* ── MESSAGE FORMAT ── */}
      {section==="messages"&&(
        <>
          <Card>
            <Label>Cook Message Format</Label>
            <div style={{fontSize:12,color:"#64748b",marginBottom:12,lineHeight:1.7,background:"#f8fafc",borderRadius:8,padding:"10px 12px"}}>
              <b>Placeholders you can use:</b><br/>
              <code style={{color:"#f97316"}}>{"{flatName}"}</code> · <code style={{color:"#f97316"}}>{"{day}"}</code> · <code style={{color:"#f97316"}}>{"{subtitle}"}</code><br/>
              <code style={{color:"#f97316"}}>{"{breakfast}"}</code> · <code style={{color:"#f97316"}}>{"{lunch}"}</code> · <code style={{color:"#f97316"}}>{"{dinner}"}</code><br/>
              <code style={{color:"#f97316"}}>{"{comment}"}</code> (your extra note) · <code style={{color:"#f97316"}}>{"{appLink}"}</code>
            </div>
            <textarea value={draft.messageFormat} onChange={e=>setDraft({...draft,messageFormat:e.target.value})}
              style={{width:"100%",padding:"12px",borderRadius:10,border:"2px solid #e2e8f0",
                fontSize:13,minHeight:220,outline:"none",lineHeight:1.7,color:"#1e293b",fontFamily:"monospace"}}/>
            <button onClick={()=>setDraft({...draft,messageFormat:DEFAULT_SETTINGS.messageFormat})}
              style={{marginTop:8,padding:"7px 14px",borderRadius:8,border:"2px solid #e2e8f0",
                background:"transparent",color:"#94a3b8",fontSize:12,cursor:"pointer",fontWeight:600}}>
              ↩ Reset to default
            </button>
          </Card>

          <Card>
            <Label>Voting Reminder Format</Label>
            <div style={{fontSize:12,color:"#64748b",marginBottom:12,lineHeight:1.7,background:"#f8fafc",borderRadius:8,padding:"10px 12px"}}>
              <b>Placeholders:</b> <code style={{color:"#f97316"}}>{"{flatName}"}</code> · <code style={{color:"#f97316"}}>{"{day}"}</code> · <code style={{color:"#f97316"}}>{"{meals}"}</code> · <code style={{color:"#f97316"}}>{"{appLink}"}</code>
            </div>
            <textarea value={draft.reminderFormat} onChange={e=>setDraft({...draft,reminderFormat:e.target.value})}
              style={{width:"100%",padding:"12px",borderRadius:10,border:"2px solid #e2e8f0",
                fontSize:13,minHeight:160,outline:"none",lineHeight:1.7,color:"#1e293b",fontFamily:"monospace"}}/>
            <button onClick={()=>setDraft({...draft,reminderFormat:DEFAULT_SETTINGS.reminderFormat})}
              style={{marginTop:8,padding:"7px 14px",borderRadius:8,border:"2px solid #e2e8f0",
                background:"transparent",color:"#94a3b8",fontSize:12,cursor:"pointer",fontWeight:600}}>
              ↩ Reset to default
            </button>
          </Card>
        </>
      )}

      <button onClick={saveAll} style={{width:"100%",padding:"15px 0",borderRadius:14,border:"none",
        background:"linear-gradient(135deg,#f97316,#ea580c)",color:"#fff",fontWeight:800,fontSize:16,
        cursor:"pointer",boxShadow:"0 4px 20px #f9731644",marginTop:4}}>
        💾 Save All Settings
      </button>
    </>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────
export default function App() {
  const [settings, setSettings] = useState(()=>load("flatSettings", DEFAULT_SETTINGS));
  const [mealOptions, setMealOptions] = useState(()=>load("flatMealOptions", DEFAULT_MEAL_OPTIONS));
  const [allVotes, setAllVotes] = useState(()=>load("flatVotes",{}));
  const [me, setMe] = useState(()=>{
    const s = load("flatSettings", DEFAULT_SETTINGS);
    return s.flatmates[0];
  });
  const [tab, setTab] = useState("vote");
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(getNow());
  const todayIdx = getTodayIdx();
  const [activeDay, setActiveDay] = useState(DAYS[todayIdx]);

  useEffect(()=>{ const t=setInterval(()=>setNow(getNow()),30000); return()=>clearInterval(t); },[]);

  function getOpenMeals(day) {
    const isToday = day===DAYS[todayIdx];
    const isTomorrow = day===DAYS[getTomorrowIdx()];
    const {h}=now;
    const open=[];
    if (isToday) open.push("Breakfast","Lunch");
    if (isTomorrow && h>=settings.blReminderHour) open.push("Breakfast","Lunch");
    if (isToday && h>=settings.dinnerReminderHour) open.push("Dinner");
    return open;
  }

  const openMeals = getOpenMeals(activeDay);
  const votes = allVotes[activeDay]||{};
  const voterCount = getVoterCount(votes, ["Breakfast","Lunch","Dinner"]);
  const cookReady = voterCount >= settings.minVotesToSend;

  const TABS=[["vote","🗳️","Vote"],["results","📊","Results"],["settings","⚙️","Settings"]];

  return (
    <div style={{minHeight:"100vh",background:"#f1f5f9",paddingBottom:90}}>

      {/* ── HEADER ── */}
      <div style={{background:"linear-gradient(135deg,#1e293b 0%,#0f172a 100%)",
        padding:"env(safe-area-inset-top, 0px) 0 0",
        position:"sticky",top:0,zIndex:50,boxShadow:"0 4px 24px #0006"}}>
        <div style={{maxWidth:480,margin:"0 auto",padding:"18px 18px 0"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div>
              <div style={{color:"#f97316",fontWeight:900,fontSize:10,letterSpacing:2,textTransform:"uppercase",marginBottom:3}}>
                {settings.flatName} · Meal Planner
              </div>
              <div style={{color:"#f1f5f9",fontWeight:800,fontSize:20,letterSpacing:-0.5}}>🍽️ Daily Meal Vote</div>
              <div style={{color:"#475569",fontSize:12,marginTop:3}}>
                {DAYS[todayIdx]} · {String(now.h).padStart(2,"0")}:{String(now.m).padStart(2,"0")}
              </div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{background:cookReady?"#f97316":"rgba(255,255,255,0.07)",borderRadius:14,padding:"10px 16px",border:cookReady?"none":"1px solid #334155"}}>
                <div style={{color:"#fff",fontWeight:900,fontSize:22,lineHeight:1}}>{voterCount}<span style={{fontSize:14,fontWeight:500,color:cookReady?"#fed7aa":"#475569"}}>/{settings.flatmates.length}</span></div>
                <div style={{color:cookReady?"#fed7aa":"#64748b",fontSize:10,fontWeight:700,letterSpacing:1,marginTop:2}}>VOTED</div>
              </div>
              {cookReady&&<div style={{fontSize:10,color:"#22c55e",fontWeight:800,marginTop:5,letterSpacing:0.5}}>✅ COOK READY</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:2}}>
            {TABS.map(([key,em,label])=>(
              <button key={key} onClick={()=>setTab(key)} style={{flex:1,padding:"10px 0",background:tab===key?"#f97316":"transparent",
                color:tab===key?"#fff":"#64748b",border:"none",borderRadius:"10px 10px 0 0",
                fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .15s"}}>
                {em} {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{maxWidth:480,margin:"0 auto",padding:"16px 14px"}}>
        {tab==="vote"&&<VoteTab settings={settings} mealOptions={mealOptions} allVotes={allVotes} setAllVotes={setAllVotes} activeDay={activeDay} setActiveDay={setActiveDay} me={me} setMe={setMe} openMeals={openMeals} setToast={setToast}/>}
        {tab==="results"&&<ResultsTab settings={settings} allVotes={allVotes} activeDay={activeDay} openMeals={openMeals} setToast={setToast}/>}
        {tab==="settings"&&<SettingsTab settings={settings} setSettings={setSettings} mealOptions={mealOptions} setMealOptions={setMealOptions} setToast={setToast}/>}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",
        borderTop:"1px solid #f1f5f9",boxShadow:"0 -4px 20px #0002",zIndex:40,
        paddingBottom:"env(safe-area-inset-bottom, 0px)"}}>
        <div style={{display:"flex",maxWidth:480,margin:"0 auto"}}>
          {TABS.map(([key,em,label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{flex:1,padding:"10px 0 12px",background:"none",border:"none",
              color:tab===key?"#f97316":"#94a3b8",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              borderTop:tab===key?"3px solid #f97316":"3px solid transparent"}}>
              <span style={{fontSize:20}}>{em}</span>
              <span style={{fontSize:11,fontWeight:tab===key?800:500}}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}
