import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PolarRadiusAxis, Legend, PieChart, Pie, Cell
} from "recharts";

const FontLink = () => (
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
);

const T = {
  bg:"#05090f", bg2:"#090e18", bg3:"#0d1424", card:"#0a1020",
  border:"#ffffff0d", border2:"#ffffff18",
  green:"#00e676", blue:"#2979ff", purple:"#aa00ff", orange:"#ff6d00",
  yellow:"#ffd600", red:"#ff1744", cyan:"#00e5ff",
  text:"#f0f4ff", muted:"#6b7a99",
  font:"'Rajdhani', sans-serif", mono:"'JetBrains Mono', monospace", display:"'Bebas Neue', cursive",
};

const API_URL = "https://cricstatx-advanced.onrender.com/api";

// Helpers
const getAge = dob => { const d=new Date(dob),n=new Date(); let a=n.getFullYear()-d.getFullYear(); if(n<new Date(n.getFullYear(),d.getMonth(),d.getDate()))a--; return a; };
const fc = f => ({Peak:T.green,Good:T.blue,Average:T.yellow,Slump:T.red}[f]||"#888");
const rc = r => r>=95?T.green:r>=88?T.cyan:r>=80?T.yellow:T.red;
const fmtNum = n => n>=1000?(n/1000).toFixed(1)+"K":String(n);
const PCOLORS = [T.green,T.blue,T.purple,T.orange,T.cyan,T.yellow];

// Data Adapters (Maps Backend Data to Frontend UI Structure)
const adaptPlayer = (p) => {
  const matches = p.batting?.matches || 1;
  const runs = p.batting?.runs || 0;
  const wkts = p.bowling?.wickets || 0;
  const batAvg = p.batting?.average || 0;
  const batSr = p.batting?.strike_rate || 0;
  const bowlEcon = p.bowling?.economy || 0;
  const bowlAvg = p.bowling?.average || 0;
  const fours = p.batting?.fours || 0;
  const sixes = p.batting?.sixes || 0;
  const notOuts = p.batting?.not_outs || 0;

  // Rate metrics for advanced scoring (prevents auto-maxing to 99 for high match counts)
  const wktsPerMatch = wkts / matches;
  const foursPerMatch = fours / matches;
  const sixesPerMatch = sixes / matches;

  // --- ASYMPTOTIC FANTASY CURVE RATING ---
  const fpts = runs + (wkts * 25) + (fours * 2) + (sixes * 4);
  const fppm = fpts / matches;

  let rawRating = 40; 
  rawRating += 45 * (fppm / (fppm + 10));
  rawRating += 14 * (fpts / (fpts + 150));

  if (runs > 50 && batSr > 130) rawRating += Math.min(2, (batSr - 130) * 0.04);
  if (wkts > 3 && bowlEcon > 0 && bowlEcon < 7.0) rawRating += Math.min(2, (7.0 - bowlEcon) * 0.5);

  const rating = Math.min(99, Math.max(40, Math.round(rawRating)));
  // -----------------------------------------

  // --- DYNAMIC ADVANCED METRICS (FIXED TO USE AVERAGES) ---
  const consistencyScore = Math.round(Math.min(99, 40 + (batAvg * 1.2) + (wktsPerMatch * 15)));
  const impactScore = Math.round(Math.min(99, 40 + (fppm * 1.2)));
  
  const pressureScore = Math.round(Math.min(99, 40 + (batAvg * 1.0) + (bowlEcon > 0 ? Math.max(0, 10 - bowlEcon)*3 : 10)));
  const powerplayScore = Math.round(Math.min(99, 40 + (batSr * 0.2) + (foursPerMatch * 10)));
  const deathScore = Math.round(Math.min(99, 40 + (batSr * 0.25) + (sixesPerMatch * 15) + (wktsPerMatch * 12)));

  const baseAvg = batAvg > 0 ? batAvg : (wkts > 0 ? 15 : 10); 
  const isChaser = batSr > 110 || notOuts > 1; 

/// --- DYNAMIC MATCH HISTORY GENERATION (INNINGS SIMULATOR) ---
  const numPoints = Math.min(10, Math.max(3, matches)); 
  
  // 1. Create a custom predictable random generator based on the player's name
  let currentSeed = p.name.charCodeAt(0) + p.name.length;
  const seededRandom = () => {
    const x = Math.sin(currentSeed++) * 10000;
    return x - Math.floor(x);
  };
  
  const formHistory = Array.from({length: numPoints}, (_, i) => {
      // The final match is always their exact current overall rating
      if (i === numPoints - 1) return rating; 
      
      // 2. Simulate actual match stats using their real averages
      // They can score anywhere from 0 up to 2.2x their average in a single "game"
      const simRuns = batAvg * (seededRandom() * 2.2); 
      // They can take between 0 and 3x their average wickets
      const simWkts = wkts > 0 ? wktsPerMatch * (seededRandom() * 3) : 0; 
      
      // 3. Calculate Fantasy Points for this specific simulated match
      const simFpts = simRuns + (simWkts * 25);
      
      // 4. Convert that match's fantasy points into a temporary Match Rating (40-99)
      const matchRating = 40 + (simFpts * 1.2);
      
      // 5. Blend it! Combine their simulated match performance (40%) with their real career average (60%)
      // This ensures the graph looks wild and spikey, but stays anchored to their actual skill level.
      const blendedRating = (matchRating * 0.4) + (rating * 0.6);

      return Math.round(Math.min(99, Math.max(40, blendedRating)));
  });
  const isBowler = wkts > 0 && (wkts * 10) >= runs;
  
  return {
    id: p.name, name: p.name, dob: "2000-01-01", 
    role: isBowler ? "Bowler" : "Batsman", 
    batting: "Unknown", bowling: "Unknown", 
    country: "Local", flag: "🏏", franchise: "Club", span: "2026–Present", 
    avatar: p.name.substring(0, 2).toUpperCase(), 
    rating: rating, 
    form: rating > 80 ? "Peak" : rating > 65 ? "Good" : rating > 50 ? "Average" : "Slump", 
    tags: ["Verified Player", isBowler ? "Wicket Taker" : "Run Machine"],
    stats: { 
      odi: {
        m: matches, inn: p.batting?.innings || 0, 
        no: notOuts, runs: runs, balls: p.batting?.balls || 0,
        avg: batAvg, sr: batSr, h: p.batting?.highest || 0,
        "50s": p.batting?.fifties || 0, "100s": p.batting?.hundreds || 0,
        "4s": fours, "6s": sixes,
        wkts: wkts, bbm: p.bowling?.best_figures || "0/0", econ: bowlEcon,
        bowlInn: p.bowling?.innings || 0, overs: p.bowling?.overs || 0, maidens: p.bowling?.maidens || 0,
        bowlRuns: p.bowling?.runs || 0, bowlAvg: bowlAvg
      },
      test: {m:0,inn:0,no:0,runs:0,balls:0,avg:0,sr:0,h:0,"50s":0,"100s":0,"4s":0,"6s":0,wkts:0,bbm:"0/0",econ:0,bowlInn:0,overs:0,maidens:0,bowlRuns:0,bowlAvg:0},
      t20: {m:0,inn:0,no:0,runs:0,balls:0,avg:0,sr:0,h:0,"50s":0,"100s":0,"4s":0,"6s":0,wkts:0,bbm:"0/0",econ:0,bowlInn:0,overs:0,maidens:0,bowlRuns:0,bowlAvg:0},
      ipl: {m:0,inn:0,no:0,runs:0,balls:0,avg:0,sr:0,h:0,"50s":0,"100s":0,"4s":0,"6s":0,wkts:0,bbm:"0/0",econ:0,bowlInn:0,overs:0,maidens:0,bowlRuns:0,bowlAvg:0}
    },
    adv: { 
      consistency: consistencyScore, 
      impact: impactScore, 
      pressure: pressureScore, 
      powerplay: powerplayScore, 
      death: deathScore, 
      homeAvg: Math.round(baseAvg * 1.15), 
      awayAvg: Math.round(baseAvg * 0.85), 
      vsTop5: Math.round(baseAvg * 0.75), 
      chaseAvg: Math.round(baseAvg * (isChaser ? 1.25 : 0.9)), 
      defendAvg: Math.round(baseAvg * (isChaser ? 0.85 : 1.15)), 
      winContrib: Math.min(45, Math.round(12 + (impactScore * 0.25))), 
      formScore: rating, 
      formHistory: formHistory, 
      radar: [
        {s:"Technique", v: Math.round(Math.min(99, 40 + (batAvg * 1.5)))},
        {s:"Power", v: Math.round(Math.min(99, 40 + (batSr * 0.2) + (sixesPerMatch * 10)))},
        {s:"Bowling", v: Math.round(Math.min(99, 40 + (wktsPerMatch * 15)))},
        {s:"Consistency", v: consistencyScore},
        {s:"Impact", v: impactScore},
        {s:"Experience", v: Math.round(Math.min(99, 40 + (matches * 2)))}
      ] 
    }
  };
};

const adaptTeam = (t, index) => ({
  id: t.name, name: t.name, flag: "🛡️", rank: index + 1, rankT20: index + 1, rankODI: index + 1,
  captain: "Unknown", coach: "Unknown", winPct: t.win_pct || 0, 
  strength: Math.min(99, 50 + t.wins * 10), chaseSucc: t.win_pct || 0, color: PCOLORS[index % PCOLORS.length]
});

// Atoms
const Pill = ({children,color=T.blue,sm})=>( <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:20,padding:sm?"2px 9px":"3px 12px",fontSize:sm?10:11,fontWeight:700,letterSpacing:.8,fontFamily:T.mono,whiteSpace:"nowrap"}}>{children}</span> );
const Tag = ({children,color=T.green})=>( <span style={{background:color+"15",color,borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:600,fontFamily:T.font}}>{children}</span> );
const SBox = ({label,value,accent=T.blue,big})=>(
  <div style={{background:"#ffffff06",border:`1px solid ${T.border}`,borderRadius:12,padding:big?"18px 20px":"11px 14px",textAlign:"center"}}>
    <div style={{fontSize:big?30:21,fontWeight:800,color:accent,fontFamily:T.display,letterSpacing:1,lineHeight:1}}>{value}</div>
    <div style={{fontSize:10,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginTop:3,fontFamily:T.mono}}>{label}</div>
  </div>
);
const PBar = ({label,value,max=100,color=T.blue})=>(
  <div style={{marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
      <span style={{fontSize:12,color:T.muted,fontFamily:T.mono}}>{label}</span>
      <span style={{fontSize:12,fontWeight:700,color,fontFamily:T.mono}}>{value}</span>
    </div>
    <div style={{height:5,background:"#ffffff0d",borderRadius:3,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${(value/max)*100}%`,background:`linear-gradient(90deg,${color}66,${color})`,borderRadius:3}}/>
    </div>
  </div>
);
const TabRow = ({tabs,active,onChange,accent=T.green})=>(
  <div style={{display:"flex",gap:3,background:"#ffffff06",borderRadius:12,padding:4,flexWrap:"wrap"}}>
    {tabs.map(t=>( <button key={t} onClick={()=>onChange(t)} style={{padding:"7px 15px",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:T.font,background:active===t?accent:"transparent",color:active===t?"#05090f":T.muted,transition:"all .2s",letterSpacing:.3}}>{t}</button> ))}
  </div>
);
const Card = ({children,style={},glow,onClick})=>(
  <div onClick={onClick} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:20,position:"relative",overflow:"hidden",transition:"all .25s",...(onClick?{cursor:"pointer"}:{}),...style}}
    onMouseEnter={e=>{if(onClick){e.currentTarget.style.borderColor=(glow||T.green)+"44";e.currentTarget.style.transform="translateY(-3px)";}}}
    onMouseLeave={e=>{if(onClick){e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="translateY(0)";}}}>{children}</div>
);
const SecTitle = ({children,accent=T.green,sub})=>(
  <div style={{marginBottom:24}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
      <div style={{width:4,height:28,background:`linear-gradient(180deg,${accent},${accent}44)`,borderRadius:2}}/>
      <div style={{fontFamily:T.display,fontSize:28,letterSpacing:2,color:T.text}}>{children}</div>
    </div>
    {sub&&<div style={{fontSize:13,color:T.muted,marginLeft:14,fontFamily:T.font}}>{sub}</div>}
  </div>
);

// --- LIVE STATS TICKER COMPONENT ---
const Ticker = ({ data }) => {
  if (!data || !data.players || data.players.length === 0) {
    return (
      <div style={{background:"#ffffff05", borderBottom:`1px solid ${T.border}`, padding:"12px 20px", fontSize:14, fontFamily:T.mono, textAlign:"center"}}>
        <span style={{color:T.muted}}>🟢 WAITING FOR MATCH DATA...</span>
      </div>
    );
  }
  
  // Safely calculate ALL the top players on the fly
  const topScorer = data.players.reduce((p, c) => ((p.stats?.odi?.runs || 0) > (c.stats?.odi?.runs || 0) ? p : c), data.players[0]);
  const topBowler = data.players.reduce((p, c) => ((p.stats?.odi?.wkts || 0) > (c.stats?.odi?.wkts || 0) ? p : c), data.players[0]);
  const topMVP = data.players.reduce((p, c) => ((p.rating || 0) > (c.rating || 0) ? p : c), data.players[0]);
  const topHigh = data.players.reduce((p, c) => ((p.stats?.odi?.h || 0) > (c.stats?.odi?.h || 0) ? p : c), data.players[0]);
  const topSixes = data.players.reduce((p, c) => ((p.stats?.odi?.["6s"] || 0) > (c.stats?.odi?.["6s"] || 0) ? p : c), data.players[0]);
  const topFours = data.players.reduce((p, c) => ((p.stats?.odi?.["4s"] || 0) > (c.stats?.odi?.["4s"] || 0) ? p : c), data.players[0]);

  // We package the stats into a single block so we can easily duplicate it
  const tickerContent = (
    <div style={{ display: "flex", alignItems: "center", paddingRight: 50 }}>
      <span style={{color:T.green, fontWeight:800}}>🟢 LIVE STATS</span>
      <span style={{color:T.muted, margin:"0 20px"}}>·</span>

      <span>🏏 MOST RUNS: <strong style={{color:T.yellow}}>{topScorer.name.toUpperCase()} ({topScorer.stats?.odi?.runs||0} Runs)</strong></span>
      <span style={{color:T.muted, margin:"0 20px"}}>·</span>
      
      <span>🎯 MOST WICKETS: <strong style={{color:T.orange}}>{topBowler.name.toUpperCase()} ({topBowler.stats?.odi?.wkts||0} Wkts)</strong></span>
      <span style={{color:T.muted, margin:"0 20px"}}>·</span>

      <span>🚀 HIGHEST SCORE: <strong style={{color:T.red}}>{topHigh.name.toUpperCase()} ({topHigh.stats?.odi?.h||0} Runs)</strong></span>
      <span style={{color:T.muted, margin:"0 20px"}}>·</span>

      <span>💥 MOST 6s: <strong style={{color:T.purple}}>{topSixes.name.toUpperCase()} ({topSixes.stats?.odi?.["6s"]||0})</strong></span>
      <span style={{color:T.muted, margin:"0 20px"}}>·</span>

      <span>⚡ MOST 4s: <strong style={{color:T.blue}}>{topFours.name.toUpperCase()} ({topFours.stats?.odi?.["4s"]||0})</strong></span>
      <span style={{color:T.muted, margin:"0 20px"}}>·</span>

      <span>🐐 MVP: <strong style={{color:T.cyan}}>{topMVP.name.toUpperCase()} ({topMVP.rating} Rtn)</strong></span>
      <span style={{color:T.muted, margin:"0 20px"}}>·</span>

    </div>
  );

  return (
    <div style={{background:"#ffffff05", borderBottom:`1px solid ${T.border}`, padding:"12px 0", fontSize:14, fontFamily:T.mono, overflow:"hidden", width:"100%"}}>
      
      <style>
        {`
          @keyframes infinite-scroll {
            0% { transform: translateX(0); }
            /* Slides exactly half the width (one full copy) for a seamless loop */
            100% { transform: translateX(-50%); } 
          }
          .ticker-track {
            display: flex;
            width: max-content;
            animation: infinite-scroll 40s linear infinite;
            cursor: pointer;
          }
          .ticker-track:hover {
            animation-play-state: paused;
          }
        `}
      </style>

      {/* We render the exact same content twice side-by-side to close the gap! */}
      <div className="ticker-track">
        {tickerContent}
        {tickerContent}
      </div>
    </div>
  );
};

// HOME PAGE
const HomePage = ({setPage, onPlayer, onMatch, data}) => {
  const heroStats=[{label:"Players Tracked",value:data.players.length,icon:"👤",color:T.green},{label:"Matches Recorded",value:data.matches.length,icon:"🏏",color:T.blue},{label:"Teams",value:data.teams.length,icon:"🛡️",color:T.orange}];
  return(
    <div>
      <div style={{position:"relative",overflow:"hidden",padding:"72px 28px 60px",textAlign:"center"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(circle at 1px 1px,${T.green}07 1px,transparent 0)`,backgroundSize:"32px 32px",pointerEvents:"none"}}/>
        <div style={{position:"absolute",top:-100,left:"15%",width:500,height:500,borderRadius:"50%",background:`radial-gradient(circle,${T.green}09,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{position:"absolute",top:-60,right:"10%",width:350,height:350,borderRadius:"50%",background:`radial-gradient(circle,${T.blue}09,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontFamily:T.display,fontSize:"clamp(44px,9vw,100px)",letterSpacing:4,color:T.text,lineHeight:.92,margin:"0 0 14px"}}>
            CRIC<span style={{color:T.green}}>STAT</span><span style={{color:T.blue}}>X</span>
          </div>
          <p style={{fontSize:"clamp(14px,2vw,19px)",color:T.muted,maxWidth:540,margin:"0 auto 34px",fontFamily:T.font,lineHeight:1.65}}>
            Upload Scorecards. Extract Data. Generate AI Insights automatically.
          </p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:50}}>
            {/* QUICK NAVIGATION MENU */}
          <div style={{display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginBottom: 40}}>
            
            <button 
              onClick={() => setPage("players")} 
              style={{padding:"12px 28px", borderRadius:10, background:"#ffffff05", border:`1px solid ${T.border}`, color:T.text, cursor:"pointer", fontFamily:T.display, fontSize: 16, letterSpacing: 1, transition:"0.2s", display:"flex", alignItems:"center", gap:10}} 
              onMouseEnter={e=>{e.currentTarget.style.background=`${T.blue}15`; e.currentTarget.style.borderColor=T.blue; e.currentTarget.style.color=T.blue;}} 
              onMouseLeave={e=>{e.currentTarget.style.background="#ffffff05"; e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.text;}}
            >
              <span style={{fontSize: 20}}>👤</span> PLAYERS
            </button>
            
            <button 
              onClick={() => setPage("stats")} 
              style={{padding:"12px 28px", borderRadius:10, background:"#ffffff05", border:`1px solid ${T.border}`, color:T.text, cursor:"pointer", fontFamily:T.display, fontSize: 16, letterSpacing: 1, transition:"0.2s", display:"flex", alignItems:"center", gap:10}} 
              onMouseEnter={e=>{e.currentTarget.style.background=`${T.cyan}15`; e.currentTarget.style.borderColor=T.cyan; e.currentTarget.style.color=T.cyan;}} 
              onMouseLeave={e=>{e.currentTarget.style.background="#ffffff05"; e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.text;}}
            >
              <span style={{fontSize: 20}}>📊</span> STATS
            </button>

            <button 
              onClick={() => setPage("matches")} 
              style={{padding:"12px 28px", borderRadius:10, background:"#ffffff05", border:`1px solid ${T.border}`, color:T.text, cursor:"pointer", fontFamily:T.display, fontSize: 16, letterSpacing: 1, transition:"0.2s", display:"flex", alignItems:"center", gap:10}} 
              onMouseEnter={e=>{e.currentTarget.style.background=`${T.orange}15`; e.currentTarget.style.borderColor=T.orange; e.currentTarget.style.color=T.orange;}} 
              onMouseLeave={e=>{e.currentTarget.style.background="#ffffff05"; e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.text;}}
            >
              <span style={{fontSize: 20}}>🏏</span> MATCHES
            </button>

          </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,maxWidth:680,margin:"0 auto"}}>
            {heroStats.map(({label,value,icon,color})=>(
              <div key={label} style={{background:"#ffffff06",border:`1px solid ${color}22`,borderRadius:16,padding:"18px 12px",textAlign:"center"}}>
                <div style={{fontSize:22,marginBottom:5}}>{icon}</div>
                <div style={{fontFamily:T.display,fontSize:28,color,letterSpacing:1}}>{value}</div>
                <div style={{fontSize:10,color:T.muted,fontFamily:T.mono,letterSpacing:.5}}>{label}</div>
              </div>
            ))}
            
          </div>
          {/* --- TOURNAMENT LEADERS SECTION --- */}
          {data?.players?.length > 0 && (
            <div style={{marginTop: 50}}>
              <div style={{fontFamily:T.display,fontSize:22,color:T.text,letterSpacing:1,marginBottom:20, textAlign: "center"}}>
                <span style={{color: T.green}}>👑</span> TOURNAMENT LEADERS
              </div>
              
              {(() => {
                // Safety checkers to match however your data is formatted (stats.odi or batting/bowling)
                const getRuns = p => p?.batting?.runs || p?.stats?.odi?.runs || 0;
                const getWkts = p => p?.bowling?.wickets || p?.stats?.odi?.wkts || 0;
                const getSixes = p => p?.batting?.sixes || p?.stats?.odi?.["6s"] || 0;
                const getFours = p => p?.batting?.fours || p?.stats?.odi?.["4s"] || 0;
                const getHigh = p => p?.batting?.highest || p?.stats?.odi?.h || 0;
                const getRtg = p => p?.rating || p?.strength || 0;

                // Calculate all the top players instantly
                const topScorer = data.players.reduce((p, c) => getRuns(p) > getRuns(c) ? p : c, data.players[0]);
                const topBowler = data.players.reduce((p, c) => getWkts(p) > getWkts(c) ? p : c, data.players[0]);
                const topSixes = data.players.reduce((p, c) => getSixes(p) > getSixes(c) ? p : c, data.players[0]);
                const topFours = data.players.reduce((p, c) => getFours(p) > getFours(c) ? p : c, data.players[0]);
                const topHigh = data.players.reduce((p, c) => getHigh(p) > getHigh(c) ? p : c, data.players[0]);
                const topMVP = data.players.reduce((p, c) => getRtg(p) > getRtg(c) ? p : c, data.players[0]);

                // Package them into an array for easy rendering
                const leaders = [
                  { label: "MOST RUNS", emoji: "🏏", name: topScorer.name, stat: getRuns(topScorer), color: T.yellow },
                  { label: "MOST WICKETS", emoji: "🎯", name: topBowler.name, stat: getWkts(topBowler), color: T.orange },
                  { label: "HIGHEST SCORE", emoji: "🚀", name: topHigh.name, stat: getHigh(topHigh), color: T.red },
                  { label: "MOST 6s", emoji: "💥", name: topSixes.name, stat: getSixes(topSixes), color: T.purple },
                  { label: "MOST 4s", emoji: "⚡", name: topFours.name, stat: getFours(topFours), color: T.blue },
                  { label: "MVP RATING", emoji: "🐐", name: topMVP.name, stat: getRtg(topMVP), color: T.cyan }
                ];

                return (
                  <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16}}>
                    {leaders.map((l, i) => (
                      <div 
                        key={i} 
                        style={{background: "rgba(0,0,0,0.3)", border: `1px solid ${l.color}30`, borderRadius: 12, padding: "20px 10px", textAlign: "center", transition: "0.3s", cursor: "default"}} 
                        onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-5px)"; e.currentTarget.style.borderColor=l.color; e.currentTarget.style.boxShadow=`0 8px 25px ${l.color}25`; e.currentTarget.style.background=`${l.color}0a`;}} 
                        onMouseLeave={e=>{e.currentTarget.style.transform="none"; e.currentTarget.style.borderColor=`${l.color}30`; e.currentTarget.style.boxShadow="none"; e.currentTarget.style.background="rgba(0,0,0,0.3)";}}
                      >
                        <div style={{fontSize: 26, marginBottom: 8}}>{l.emoji}</div>
                        <div style={{color: T.muted, fontSize: 10, fontFamily: T.mono, letterSpacing: 1, marginBottom: 8}}>{l.label}</div>
                        <div style={{color: l.color, fontSize: 16, fontFamily: T.display, letterSpacing: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 5px"}}>{l.name.toUpperCase()}</div>
                        <div style={{color: T.text, fontSize: 26, fontFamily: T.mono, fontWeight: 800, marginTop: 4}}>{l.stat}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
          {/* -------------------------------------- */}
        </div>
      </div>
      <div style={{padding:"0 24px",maxWidth:1200,margin:"0 auto"}}>
        {data.players.length === 0 && (
          <div style={{textAlign: "center", padding: "60px 20px", color: T.muted, border: `1px dashed ${T.border}`, borderRadius: 20, margin: "44px 0"}}>
            <div style={{fontSize: 40, marginBottom: 15}}>🔌</div>
            <h3 style={{fontFamily: T.display, fontSize: 24, color: T.text, letterSpacing: 1}}>DATABASE EMPTY</h3>
            <p style={{fontFamily: T.font, fontSize: 16, marginTop: 10}}>Go to the Admin Panel and upload scorecard PDFs to populate the dashboard.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// STATS PAGE
const StatsPage = ({onPlayer, data}) => {
  const [fmt,setFmt] = useState("ODI");
  const [cat,setCat] = useState("Batting");
  const [sortK,setSortK] = useState("runs");
  
  if (data.players.length === 0) return <div style={{padding:"60px 24px", textAlign:"center", color:T.muted}}>No player data available.</div>;

  const handleCatChange = (newCat) => {
    setCat(newCat);
    setSortK(newCat === "Batting" ? "runs" : "wkts"); 
  };

  const fk = fmt.toLowerCase();
  const tData = data.players.map(p=>({...p,s:p.stats[fk]||{}}));
  const isBat = cat === "Batting";

  const chartData = tData.filter(p=>(isBat ? p.s.runs>0 : p.s.wkts>0)).sort((a,b)=>(b.s[sortK]||0)-(a.s[sortK]||0)).slice(0,6).map(p=>({name:p.avatar,full:p.name,...p.s}));
  
  const sortKeys = isBat 
    ? [{k:"runs",l:"Runs"},{k:"avg",l:"Avg"},{k:"sr",l:"SR"},{k:"h",l:"HS"},{k:"4s",l:"4s"},{k:"6s",l:"6s"}]
    : [{k:"wkts",l:"Wickets"},{k:"econ",l:"Economy"},{k:"bowlAvg",l:"Avg"},{k:"overs",l:"Overs"}];

  const tableHeaders = isBat 
    ? ["Rank","Player","M","Inn","NO","Runs","Balls","HS","Avg","SR","4s","6s"]
    : ["Rank","Player","M","Inn","Overs","Mdns","Runs","Wkts","Avg","Best","Econ"];

  return(
    <div style={{padding:"28px 24px",maxWidth:1200,margin:"0 auto"}}>
      <SecTitle accent={T.cyan} sub="Deep-dive statistics across extracted matches">STATISTICS EXPLORER</SecTitle>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:22}}>
        <TabRow tabs={["Batting","Bowling"]} active={cat} onChange={handleCatChange} accent={T.orange}/>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {sortKeys.map(({k,l})=>( <button key={k} onClick={()=>setSortK(k)} style={{padding:"7px 13px",borderRadius:9,border:`1px solid ${sortK===k?T.yellow:T.border}`,background:sortK===k?`${T.yellow}18`:"transparent",color:sortK===k?T.yellow:T.muted,cursor:"pointer",fontSize:12,fontFamily:T.mono,fontWeight:600}}>{l}</button> ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:11,marginBottom:24}}>
        {[ {label:`Top ${sortK}`,value:chartData[0]?.[sortK]||"—",accent:T.green},{label:"Category",value:cat,accent:T.orange} ].map((d,i)=><SBox key={i} label={d.label} value={d.value} accent={d.accent} big/>)}
      </div>
      
      <Card style={{marginBottom:20}}>
        <div style={{fontFamily:T.display,fontSize:20,color:T.yellow,letterSpacing:1,marginBottom:16}}>{cat.toUpperCase()} LEADERBOARD</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontFamily:T.font,fontSize:14}}>
            <thead>
              <tr>
                {tableHeaders.map(h=>(<th key={h} style={{padding:"8px 11px",textAlign:h==="Player"?"left":"center",color:T.muted,fontSize:11,fontFamily:T.mono,letterSpacing:1,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {tData.filter(p=> isBat ? p.s.inn>0 : p.s.bowlInn>0).sort((a,b)=>(b.s[sortK]||0)-(a.s[sortK]||0)).map((p, i)=>(
                <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`,cursor:"pointer"}} onClick={()=>onPlayer(p)} onMouseEnter={e=>e.currentTarget.style.background="#ffffff04"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.muted,fontSize:13,fontWeight:700}}>{i + 1}</td>
                  <td style={{padding:"11px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:28,height:28,borderRadius:7,background:`${T.green}18`,border:`1px solid ${T.green}28`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:T.green,fontFamily:T.display}}>{p.avatar}</div>
                      <span style={{fontWeight:700,color:T.text,fontSize:15}}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.muted}}>{p.s.m}</td>
                  
                  {isBat ? (
                    <>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.muted}}>{p.s.inn}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.text}}>{p.s.no}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.orange,fontWeight:800}}>{(p.s.runs||0).toLocaleString()}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.green}}>{p.s.balls}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.red,fontWeight:700}}>{p.s.h||"—"}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.cyan,fontWeight:700}}>{p.s.avg||"—"}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.yellow}}>{p.s.sr||"—"}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.blue,fontWeight:700}}>{p.s["4s"]||0}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.blue,fontWeight:700}}>{p.s["6s"]||0}</td>
                    </>
                  ) : (
                    <>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.muted}}>{p.s.bowlInn}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.yellow}}>{p.s.overs||0}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.muted}}>{p.s.maidens||0}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.orange,fontWeight:800}}>{p.s.bowlRuns||0}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.green,fontWeight:800}}>{p.s.wkts||0}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.cyan,fontWeight:700}}>{p.s.bowlAvg||"—"}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:T.red,fontSize:11}}>{p.s.bbm||"—"}</td>
                      <td style={{padding:"11px",textAlign:"center",fontFamily:T.mono,color:p.s.econ?T.purple:T.muted}}>{p.s.econ||"—"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// PLAYER DETAIL
const PlayerDetail = ({player:p,onBack}) => {
  // Only the main tab state remains. The "fmt" state is deleted!
  const [tab,setTab]=useState("Overview");
  
  // We pull directly from "odi" because that is where adaptPlayer stores the local aggregate data
  const s = p.stats.odi; 
  
  return(
    <div style={{maxWidth:980,margin:"0 auto",padding:"0 20px 40px"}}>
      <button onClick={onBack} style={{background:"#ffffff08",border:`1px solid ${T.border}`,color:T.muted,padding:"7px 16px",borderRadius:9,cursor:"pointer",marginBottom:16,fontSize:13,fontFamily:T.mono}}>← Back</button>
      
      <Card style={{marginBottom:18,background:`linear-gradient(135deg,${T.card},#0d1a2e)`}}>
        <div style={{position:"absolute",top:-70,right:-70,width:220,height:220,borderRadius:"50%",background:`radial-gradient(circle,${T.green}08,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{display:"flex",gap:18,alignItems:"center",flexWrap:"wrap",marginBottom:18}}>
          <div style={{width:76,height:76,borderRadius:20,background:`${T.green}15`,border:`3px solid ${T.green}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:900,color:T.green,fontFamily:T.display}}>{p.avatar}</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:T.display,fontSize:36,letterSpacing:2,color:T.text}}>{p.name}</div>
            <div style={{color:T.muted,fontSize:13,marginBottom:7,fontFamily:T.font}}>{p.flag} Local Match Data · {p.role}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{p.tags.map(t=><Pill key={t} color={T.blue}>{t}</Pill>)}<Pill color={fc(p.form)}>{p.form} Form</Pill></div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:T.display,fontSize:60,color:rc(p.rating),lineHeight:1}}>{p.rating}</div>
            <div style={{fontSize:10,color:T.muted,fontFamily:T.mono,letterSpacing:1}}>AI RATING</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:9}}>
          <SBox label="Matches" value={s?.m || 0} accent={T.blue}/>
          <SBox label="Runs" value={s?.runs || 0} accent={T.green}/>
          <SBox label="Wickets" value={s?.wkts || 0} accent={T.red}/>
          <SBox label="Impact" value={p.adv.impact} accent={T.orange}/>
          <SBox label="Consistency" value={p.adv.consistency} accent={T.purple}/>
        </div>
      </Card>

      {/* TABS UPDATED: Only Overview and Statistics remain */}
      <div style={{marginBottom:14}}>
        <TabRow tabs={["Overview","Statistics"]} active={tab} onChange={setTab}/>
      </div>

      {tab==="Overview"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Card>
            <div style={{fontFamily:T.display,fontSize:18,color:T.green,letterSpacing:1,marginBottom:12}}>RADAR PROFILE</div>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={p.adv.radar.map(r=>({subject:r.s,A:r.v}))}>
                <PolarGrid stroke="#ffffff0d"/><PolarAngleAxis dataKey="subject" tick={{fill:T.muted,fontSize:10,fontFamily:T.mono}}/><PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false}/>
                <Radar dataKey="A" stroke={T.green} fill={`${T.green}18`} strokeWidth={2} dot={{fill:T.green,r:3}}/>
              </RadarChart>
            </ResponsiveContainer>
          </Card>
          
          <Card>
            <div style={{fontFamily:T.display,fontSize:18,color:T.blue,letterSpacing:1,marginBottom:12}}>ADVANCED METRICS</div>
            <PBar label="Consistency Index" value={p.adv.consistency} color={T.green}/>
            <PBar label="Impact Score" value={p.adv.impact} color={T.blue}/>
            <PBar label="Pressure Rating" value={p.adv.pressure} color={T.purple}/>
            <PBar label="Powerplay" value={p.adv.powerplay} color={T.yellow}/>
            <PBar label="Death Overs" value={p.adv.death} color={T.orange}/>
            <PBar label="Form Score" value={p.adv.formScore} color={T.cyan}/>
          </Card>

          <Card style={{display:"flex", flexDirection:"column"}}>
            <div style={{fontFamily:T.display,fontSize:18,color:T.yellow,letterSpacing:1,marginBottom:16}}>SCORING DYNAMICS</div>
            {s?.runs > 0 ? (() => {
              const r = s.runs, f = (s["4s"]||0)*4, sx = (s["6s"]||0)*6;
              const run = Math.max(0, r - f - sx);
              const dt = [
                {n:"Running (1s/2s)", v:run, c:T.blue, g:"url(#gBlue)"},
                {n:"Boundaries (4s)", v:f, c:T.green, g:"url(#gGreen)"},
                {n:"Sixes (6s)", v:sx, c:T.orange, g:"url(#gOrange)"}
              ];

              return (
                <div style={{display:"flex",alignItems:"center",flex:1,gap:28,paddingLeft:8}}>
                  <div style={{position:"relative",width:150,height:150,flexShrink:0}}>
                    <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                      <div style={{fontFamily:T.display,fontSize:32,color:T.text,lineHeight:1}}>{r}</div>
                      <div style={{fontFamily:T.mono,fontSize:10,color:T.muted,letterSpacing:1,marginTop:4}}>RUNS</div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <defs>
                          <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor={T.blue}/></linearGradient>
                          <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor={T.green}/></linearGradient>
                          <linearGradient id="gOrange" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb923c"/><stop offset="100%" stopColor={T.orange}/></linearGradient>
                        </defs>
                        <Pie data={dt} cx="50%" cy="50%" innerRadius={54} outerRadius={72} paddingAngle={6} cornerRadius={8} dataKey="v" stroke="none">
                          {dt.map((e,i)=><Cell key={i} fill={e.g} style={{filter:`drop-shadow(0 4px 6px ${e.c}40)`}}/>)}
                        </Pie>
                        <Tooltip contentStyle={{background:"rgba(10,16,32,0.9)",backdropFilter:"blur(8px)",border:`1px solid ${T.border2}`,borderRadius:10,fontSize:12,fontFamily:T.mono}} itemStyle={{color:T.text}} formatter={v=>[`${v} Runs`,""]}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:18}}>
                    {dt.map(d=>(
                      <div key={d.n} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:d.c,boxShadow:`0 0 10px ${d.c}aa`,flexShrink:0}}/>
                          <div>
                            <div style={{fontFamily:T.font,fontSize:14,fontWeight:700,color:T.text,lineHeight:1.2}}>{d.n}</div>
                            <div style={{fontFamily:T.mono,fontSize:11,color:T.muted,marginTop:2}}>{d.v} runs</div>
                          </div>
                        </div>
                        <div style={{fontFamily:T.mono,fontSize:15,fontWeight:800,color:d.c}}>
                          {Math.round((d.v/r)*100) || 0}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })() : (
              <div style={{height:190,display:"flex",alignItems:"center",justifyContent:"center",color:T.muted,fontFamily:T.mono,fontSize:12}}>Insufficient batting data</div>
            )}
          </Card>

          <Card>
            <div style={{fontFamily:T.display,fontSize:18,color:T.purple,letterSpacing:1,marginBottom:10}}>FORM HISTORY</div>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={p.adv.formHistory.map((v,i,arr) => {
                  const totalM = s?.m || 1;
                  const matchNum = i === arr.length - 1 ? totalM : Math.max(1, Math.round((i + 1) * (totalM / arr.length)));
                  return { m: `M${matchNum}`, v };
              })}>
                <defs><linearGradient id="fgd" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.purple} stopOpacity={.3}/><stop offset="95%" stopColor={T.purple} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05"/>
                <XAxis dataKey="m" tick={{fill:T.muted,fontSize:10,fontFamily:T.mono}} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={10}/>
                <YAxis domain={[40,100]} tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:"#0d1424",border:`1px solid ${T.border2}`,borderRadius:8,fontSize:12,fontFamily:T.mono}}/>
                <Area type="monotone" dataKey="v" stroke={T.purple} strokeWidth={2} fill="url(#fgd)" dot={{fill:T.purple,r:3}}/>
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* STATISTICS TAB UPDATED: Sub-tabs removed, changed to a single Career component */}
      {tab==="Statistics"&&(
        <div>
          <Card>
            <div style={{fontFamily:T.display,fontSize:22,color:T.cyan,letterSpacing:1,marginBottom:18}}>CAREER STATISTICS</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:10,marginBottom:22}}>
              {[{l:"Matches",v:s?.m,c:T.blue},{l:"Innings",v:s?.inn,c:T.blue},{l:"Runs",v:(s?.runs||0).toLocaleString(),c:T.green},{l:"Average",v:s?.avg||"—",c:T.green},{l:"Strike Rate",v:s?.sr||"—",c:T.yellow},{l:"Highest",v:s?.h||"—",c:T.red},{l:"50s",v:s?.["50s"]||0,c:T.purple},{l:"100s",v:s?.["100s"]||0,c:T.orange},...(s?.wkts?[{l:"Wickets",v:s.wkts,c:T.red},{l:"Best",v:s.bbm,c:T.red},{l:"Economy",v:s.econ,c:T.cyan}]:[])].map(({l,v,c},i)=><SBox key={i} label={l} value={v} accent={c}/>)}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// MATCH DETAIL
const MatchDetail = ({match:m,onBack}) => {
  const [inn,setInn]=useState(0);
  
  if (!m || !m.innings || m.innings.length === 0) return <div style={{padding:40, textAlign:"center", color:T.muted}}>Match data incomplete. <button onClick={onBack}>Back</button></div>;
  
  const id = m.innings[inn];

  // Procedurally generate chart data for PDF uploads since they lack ball-by-ball stats
  const totalOvers = Math.ceil(id.overs || 5);
  const overData = m.overData || Array.from({length: totalOvers}, (_, i) => ({o: i+1, r: Math.floor(Math.random() * 12) + 3}));
  const winProb = m.winProb || Array.from({length: totalOvers}, (_, i) => Math.min(95, Math.max(5, 50 + (Math.sin(i) * 20) + (i * (50/totalOvers)))));

  return(
    <div style={{maxWidth:980,margin:"0 auto",padding:"0 20px 40px"}}>
      <button onClick={onBack} style={{background:"#ffffff08",border:`1px solid ${T.border}`,color:T.muted,padding:"7px 16px",borderRadius:9,cursor:"pointer",marginBottom:16,fontSize:13,fontFamily:T.mono}}>← Back</button>
      
      {/* Match Header */}
      <Card style={{marginBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:16}}>
          <div>
            <div style={{display:"flex",gap:7,marginBottom:8}}>
              <Pill color={m.format==="Test"?T.orange:m.format==="ODI"?T.blue:T.green}>{m.format || "Local Match"}</Pill>
            </div>
            <div style={{fontFamily:T.display,fontSize:30,letterSpacing:1,color:T.text,marginBottom:3}}>{m.match_title}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{color:T.green,fontWeight:800,fontSize:14,fontFamily:T.font}}>{m.result}</div>
            {m.potm && <div style={{color:T.yellow,fontSize:12,fontFamily:T.mono,marginTop:5}}>⭐ POTM: {m.potm}</div>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
          {m.innings.map((g,i)=>(
            <div key={i} style={{background:"#ffffff05",border:`1px solid ${T.border}`,borderRadius:12,padding:12}}>
              <div style={{fontWeight:700,color:T.text,marginBottom:3,fontFamily:T.font}}>{g.team}</div>
              <div style={{fontFamily:T.display,fontSize:30,color:T.green,letterSpacing:1}}>{g.score || `${g.total_runs}/${g.total_wickets}`}</div>
              <div style={{color:T.muted,fontSize:12,fontFamily:T.mono}}>{g.overs} overs</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Dynamic Charts */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
        <Card>
          <div style={{fontFamily:T.display,fontSize:16,color:T.blue,letterSpacing:1,marginBottom:11}}>OVER PROGRESSION</div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={overData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05"/>
              <XAxis dataKey="o" tick={{fill:T.muted,fontSize:10,fontFamily:T.mono}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:"#0d1424",border:`1px solid ${T.border2}`,borderRadius:8,fontSize:12,fontFamily:T.mono}}/>
              <Bar dataKey="r" fill={T.blue} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{fontFamily:T.display,fontSize:16,color:T.red,letterSpacing:1,marginBottom:11}}>WIN PROBABILITY</div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={winProb.map((v,i)=>({o:i+1,p:v}))}>
              <defs><linearGradient id="wpd" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.red} stopOpacity={.3}/><stop offset="95%" stopColor={T.red} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05"/>
              <XAxis dataKey="o" tick={{fill:T.muted,fontSize:10,fontFamily:T.mono}} axisLine={false} tickLine={false}/>
              <YAxis domain={[0,100]} tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:"#0d1424",border:`1px solid ${T.border2}`,borderRadius:8,fontSize:12,fontFamily:T.mono}} formatter={v=>`${v.toFixed(1)}%`}/>
              <Area type="monotone" dataKey="p" stroke={T.red} strokeWidth={2} fill="url(#wpd)"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Detailed Scorecards */}
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13,flexWrap:"wrap",gap:8}}>
          <div style={{fontFamily:T.display,fontSize:20,color:T.yellow,letterSpacing:1}}>SCORECARD</div>
          <TabRow tabs={m.innings.map(g=>g.team)} active={m.innings[inn].team} onChange={v=>setInn(m.innings.findIndex(g=>g.team===v))} accent={T.yellow}/>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>{["Batter","How Out","R","B","4s","6s","SR"].map(h=><th key={h} style={{padding:"8px 9px",textAlign:h==="Batter"||h==="How Out"?"left":"right",color:T.muted,fontSize:10,fontFamily:T.mono,letterSpacing:1}}>{h}</th>)}</tr></thead>
            <tbody>{id.batting?.map((b,i)=>(
              <tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
                <td style={{padding:"9px",color:T.text,fontWeight:600,fontFamily:T.font}}>{b.name}</td>
                <td style={{padding:"9px",color:T.muted,fontSize:11,fontFamily:T.mono}}>{b.how_out || b.how || "not out"}</td>
                <td style={{padding:"9px",textAlign:"right",color:T.green,fontWeight:700,fontFamily:T.mono}}>{b.runs}</td>
                <td style={{padding:"9px",textAlign:"right",color:T.muted,fontFamily:T.mono}}>{b.balls}</td>
                <td style={{padding:"9px",textAlign:"right",color:T.blue,fontFamily:T.mono}}>{b.fours ?? b["4s"] ?? 0}</td>
                <td style={{padding:"9px",textAlign:"right",color:T.orange,fontFamily:T.mono}}>{b.sixes ?? b["6s"] ?? 0}</td>
                <td style={{padding:"9px",textAlign:"right",color:T.muted,fontFamily:T.mono}}>{b.sr ?? ((b.runs/b.balls)*100).toFixed(1)}</td>
              </tr>
            ))}</tbody>
          </table>
          <div style={{marginTop:14,fontFamily:T.display,fontSize:17,color:T.purple,letterSpacing:1,marginBottom:9}}>BOWLING</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>{["Bowler","O","M","R","W","Econ"].map(h=><th key={h} style={{padding:"8px 9px",textAlign:h==="Bowler"?"left":"right",color:T.muted,fontSize:10,fontFamily:T.mono,letterSpacing:1}}>{h}</th>)}</tr></thead>
            <tbody>{id.bowling?.map((b,i)=>(
              <tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
                <td style={{padding:"9px",color:T.text,fontWeight:600,fontFamily:T.font}}>{b.name}</td>
                <td style={{padding:"9px",textAlign:"right",color:T.muted,fontFamily:T.mono}}>{b.overs ?? b.o}</td>
                <td style={{padding:"9px",textAlign:"right",color:T.muted,fontFamily:T.mono}}>{b.maidens ?? b.m}</td>
                <td style={{padding:"9px",textAlign:"right",color:T.red,fontFamily:T.mono}}>{b.runs ?? b.r}</td>
                <td style={{padding:"9px",textAlign:"right",color:T.green,fontWeight:700,fontFamily:T.mono}}>{b.wickets ?? b.wkts}</td>
                <td style={{padding:"9px",textAlign:"right",color:T.yellow,fontFamily:T.mono}}>{b.economy ?? b.econ}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// COMPARE
const ComparePage = ({data}) => {
  const [p1,setP1]=useState(data.players[0] || null);
  const [p2,setP2]=useState(data.players[1] || null);
  const fmt = "odi";
  
  if (data.players.length < 2) {
    return (
      <div style={{padding:"60px 24px", maxWidth:980, margin:"0 auto", textAlign:"center"}}>
         <div style={{fontSize: 40, marginBottom: 15}}>⚔️</div>
         <h3 style={{fontFamily: T.display, fontSize: 24, color: T.text, letterSpacing: 1}}>NOT ENOUGH DATA</h3>
         <p style={{color: T.muted, marginTop: 10}}>You need at least two players loaded in the system to compare them.</p>
      </div>
    );
  }

  const CR=({label,v1,v2,higher="high"})=>{
    const n1=parseFloat(v1),n2=parseFloat(v2),w1=higher==="high"?n1>n2:n1<n2,w2=higher==="high"?n2>n1:n2<n1;
    return(<div style={{display:"grid",gridTemplateColumns:"1fr 80px 1fr",gap:7,alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
      <div style={{textAlign:"right",fontFamily:T.mono,fontSize:14,fontWeight:w1?800:400,color:w1?T.green:T.muted}}>{v1}</div>
      <div style={{textAlign:"center",color:T.muted,fontSize:10,fontFamily:T.mono,letterSpacing:.5}}>{label}</div>
      <div style={{fontFamily:T.mono,fontSize:14,fontWeight:w2?800:400,color:w2?T.green:T.muted}}>{v2}</div>
    </div>);
  };
  
  return(
    <div style={{padding:"28px 24px",maxWidth:980,margin:"0 auto"}}>
      <SecTitle accent={T.cyan} sub="Head-to-head player comparison">PLAYER COMPARISON</SecTitle>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        {[{p:p1,setP:setP1,accent:T.green},{p:p2,setP:setP2,accent:T.blue}].map(({p,setP,accent})=>(
          <Card key={p?.id || accent} style={{border:`1px solid ${accent}25`}}>
            <select value={p?.id} onChange={e=>setP(data.players.find(pl=>pl.id===e.target.value))} style={{width:"100%",background:"#ffffff08",border:`1px solid ${T.border}`,color:T.text,padding:"8px 11px",borderRadius:8,marginBottom:11,fontSize:13,fontFamily:T.mono}}>
              {data.players.map(pl=><option key={pl.id} value={pl.id} style={{background:"#0d1424"}}>{pl.name}</option>)}
            </select>
            <div style={{display:"flex",alignItems:"center",gap:11}}>
              <div style={{width:42,height:42,borderRadius:12,background:`${accent}18`,border:`2px solid ${accent}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:accent,fontFamily:T.display}}>{p?.avatar}</div>
              <div style={{flex:1}}><div style={{fontWeight:700,color:T.text,fontSize:15,fontFamily:T.font}}>{p?.name}</div></div>
              <div style={{fontFamily:T.display,fontSize:32,color:accent,lineHeight:1}}>{p?.rating}</div>
            </div>
          </Card>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14}}>
        <Card>
          {[["Matches",p1?.stats[fmt].m,p2?.stats[fmt].m,"high"],["Runs",p1?.stats[fmt].runs,p2?.stats[fmt].runs,"high"],["Average",p1?.stats[fmt].avg,p2?.stats[fmt].avg,"high"],["Strike Rate",p1?.stats[fmt].sr,p2?.stats[fmt].sr,"high"],["Wickets",p1?.stats[fmt].wkts,p2?.stats[fmt].wkts,"high"],["Economy",p1?.stats[fmt].econ,p2?.stats[fmt].econ,"low"],["Impact",p1?.adv.impact,p2?.adv.impact,"high"]].map(([l,v1,v2,h])=><CR key={l} label={l} v1={v1||0} v2={v2||0} higher={h}/>)}
        </Card>
      </div>
    </div>
  );
};

// ADMIN
const AdminPanel = ({data, refreshData}) => {
  const [section,setSection]=useState("dashboard");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const handleFileChange = (e) => { setFiles(Array.from(e.target.files)); };

  const handleUpload = async () => {
    if(files.length === 0) return;
    setUploading(true);
    setUploadStatus("Uploading to Python API...");
    
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));

    try {
      const res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      setUploadStatus(`✅ Successfully processed ${data.uploaded} scorecards.`);
      setFiles([]);
      refreshData();
    } catch (err) {
      console.error(err);
      setUploadStatus("❌ Error uploading files. Is the Flask server running?");
    } finally {
      setUploading(false);
    }
  };

  return(
    <div style={{padding:"28px 24px",maxWidth:1200,margin:"0 auto"}}>
      <SecTitle accent={T.orange} sub="Database management and file processing">ADMIN PANEL</SecTitle>
      <div style={{display:"flex",gap:7,marginBottom:22,flexWrap:"wrap"}}>
        {["dashboard","upload scorecards"].map(s=>(
          <button key={s} onClick={()=>setSection(s)} style={{padding:"8px 17px",borderRadius:10,border:`1px solid ${section===s?T.orange:T.border}`,background:section===s?`${T.orange}18`:"transparent",color:section===s?T.orange:T.muted,cursor:"pointer",fontWeight:700,fontSize:13,textTransform:"capitalize",fontFamily:T.font}}>{s}</button>
        ))}
      </div>
      {section==="dashboard"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:22}}>
            {[{l:"Players",v:data.players.length,i:"👤",c:T.blue},{l:"Matches",v:data.matches.length,i:"🏏",c:T.green},{l:"Teams",v:data.teams.length,i:"🌍",c:T.purple}].map(({l,v,i,c})=>(
              <Card key={l} style={{textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:7}}>{i}</div>
                <div style={{fontFamily:T.display,fontSize:34,color:c,lineHeight:1}}>{v}</div>
                <div style={{fontSize:11,color:T.muted,fontFamily:T.mono,marginTop:3}}>{l}</div>
              </Card>
            ))}
          </div>
        </div>
      )}
      {section==="upload scorecards"&&(
        <Card style={{maxWidth:600}}>
          <div style={{fontFamily:T.display,fontSize:22,color:T.orange,letterSpacing:1,marginBottom:18}}>BULK PDF UPLOAD</div>
          {uploadStatus && <div style={{background:uploadStatus.includes("✅")?`${T.green}18`:`${T.red}18`,border:`1px solid ${uploadStatus.includes("✅")?T.green:T.red}40`,borderRadius:9,padding:"9px 13px",marginBottom:14,fontSize:13,color:uploadStatus.includes("✅")?T.green:T.red,fontFamily:T.mono}}>{uploadStatus}</div>}
          
          <div style={{border:`2px dashed ${T.border2}`, borderRadius: 12, padding: 30, textAlign: "center", marginBottom: 20}}>
            <div style={{fontSize: 30, marginBottom: 10}}>📄</div>
            <p style={{color: T.muted, marginBottom: 15}}>Select one or multiple CricHeroes PDF Scorecards</p>
            <input type="file" multiple accept=".pdf" onChange={handleFileChange} style={{color: T.text}}/>
            
            {files.length > 0 && (
              <div style={{marginTop: 15, textAlign: "left", background: "#ffffff05", padding: 10, borderRadius: 8}}>
                <div style={{fontSize: 11, color: T.muted, fontFamily: T.mono, marginBottom: 5}}>SELECTED FILES:</div>
                <ul style={{fontSize: 13, color: T.cyan, margin:0, paddingLeft: 20}}>
                  {files.map(f => <li key={f.name}>{f.name}</li>)}
                </ul>
              </div>
            )}
          </div>

          <button onClick={handleUpload} disabled={uploading || files.length === 0} style={{width:"100%",padding:"11px",background:files.length===0?"transparent":`linear-gradient(90deg,${T.orange},${T.yellow})`,border:files.length===0?`1px solid ${T.border}`:"none",borderRadius:11,color:files.length===0?T.muted:"#05090f",fontWeight:900,fontSize:15,cursor:files.length===0?"not-allowed":"pointer",fontFamily:T.display,letterSpacing:2}}>
            {uploading ? "PROCESSING PDFs..." : "UPLOAD AND PARSE DATA"}
          </button>
        </Card>
      )}
    </div>
  );
};

// ROOT APP
export default function App(){
  const [page,setPage]=useState("home");
  const [selPlayer,setSelPlayer]=useState(null);
  const [selMatch,setSelMatch]=useState(null);
  const [search,setSearch]=useState("");
  
  // ADD THIS LINE: State to control the popup on the main pages
  const [showInfo, setShowInfo] = useState(false);
  
  // Data States
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [connected, setConnected] = useState(false);

  // Add these right below your other useState hooks inside App
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [loginErr, setLoginErr] = useState("");

  const [selEditPlayer, setSelEditPlayer] = useState("");
  const [selTargetPlayer, setSelTargetPlayer] = useState("");
  const [selEditMatch, setSelEditMatch] = useState("");

  const [showMatchModal, setShowMatchModal] = useState(false);
 const [matchFormData, setMatchFormData] = useState({ id: "", title: "", result: "", innings: [] });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

 // --- 1. JUST SELECT THE FILES (Don't upload yet) ---
  const handleFileSelection = (e) => {
    // Grab the files the user picked and save them to our state
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  };

  // --- 2. CONFIRM AND SEND TO PYTHON ---
  const confirmUpload = async () => {
    // If the list is empty, do nothing
    if (selectedFiles.length === 0) return;
    
    setIsUploading(true); // Turns on the "UPLOADING..." text on the button
    
    // Pack all the selected files into a digital box to send over the internet
    const formData = new FormData();
    selectedFiles.forEach(file => formData.append("files", file));

    try {
      // Send the box to your Python server!
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`Successfully uploaded ${result.uploaded} matches!`);
        setSelectedFiles([]); // Clear the list on the screen because we are done
        
        // If you have a function that refreshes your data, call it here!
        if (typeof fetchData === "function") fetchData(); 
      } else {
        alert("Upload failed: " + result.error);
      }
    } catch (error) {
      alert("Backend error. Is your Python server running on port 5000?");
    } finally {
      setIsUploading(false); // Turn off the "UPLOADING..." text
    }
  };

  // --- ADMIN DATABASE ACTIONS ---
  const handleDeletePlayer = async () => {
    if (!selEditPlayer) return alert("Select a player first!");
    if (!window.confirm(`Delete ${selEditPlayer} from all match records?`)) return;

    const res = await fetch(`${API_URL}/player/${encodeURIComponent(selEditPlayer)}`, { method: "DELETE" });
    if (res.ok) { 
      alert("Player deleted!"); 
      setSelEditPlayer("");
      if (typeof fetchData === "function") fetchData(); 
    }
  };

  const handleMergePlayers = async () => {
    if (!selEditPlayer || !selTargetPlayer) return alert("Select both source and target!");
    if (!window.confirm(`Are you sure you want to merge ${selEditPlayer} into ${selTargetPlayer}?`)) return;
    
    const res = await fetch(`${API_URL}/players/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: selEditPlayer, target: selTargetPlayer })
    });
    if (res.ok) { 
      alert("Players merged successfully!"); 
      setSelEditPlayer("");
      setSelTargetPlayer("");
      if (typeof fetchData === "function") fetchData(); 
    }
  };

  const handleDeleteMatch = async () => {
    if (!selEditMatch) return alert("Select a match first!");
    if (!window.confirm("Delete this match? All player stats will be recalculated.")) return;
    
    // We send selEditMatch which contains the match ID
    const res = await fetch(`${API_URL}/match/${selEditMatch}`, { method: "DELETE" });
    if (res.ok) { 
      alert("Match deleted!"); 
      setSelEditMatch("");
      if (typeof fetchData === "function") fetchData(); 
    }
  };

  // --- OPENS MODAL & LOADS ALL MATCH DATA ---
  const handleOpenEditMatch = () => {
    if (!selEditMatch) return alert("Please select a match first!");
    const targetMatch = data?.matches?.find(m => m.id === selEditMatch);
    
    if (targetMatch) {
      setMatchFormData({
        id: targetMatch.id,
        title: targetMatch.match_title || "",
        result: targetMatch.result || "",
        innings: targetMatch.innings?.map(inn => ({
          team: inn.team || "", total: inn.total || "", wickets: inn.wickets || "", overs: inn.overs || "",
          batting: inn.batting || [], // Load the batters
          bowling: inn.bowling || []  // Load the bowlers
        })) || []
      });
      setShowMatchModal(true);
    }
  };

  const handleSaveMatchEdit = async () => {
    try {
      const res = await fetch(`${API_URL}/match/${matchFormData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          match_title: matchFormData.title, 
          result: matchFormData.result,
          innings: matchFormData.innings // Sends EVERYTHING back to Python
        })
      });
      if (res.ok) {
        alert("Match & Player Stats updated successfully!");
        setShowMatchModal(false);
        setSelEditMatch("");
        if (typeof fetchData === "function") fetchData(); 
      }
    } catch (error) { alert("Error connecting to server."); }
  };

  const handleInningsChange = (index, field, value) => {
    const newInnings = [...matchFormData.innings];
    newInnings[index][field] = value;
    setMatchFormData({ ...matchFormData, innings: newInnings });
  };

  // --- NEW: HANDLE INDIVIDUAL PLAYER EDITS ---
  const handlePlayerStatChange = (innIndex, type, playerIndex, field, value) => {
    const newInnings = [...matchFormData.innings];
    // Parse numbers automatically so Python math doesn't break
    let finalValue = value;
    if (['runs', 'balls', 'fours', 'sixes', 'maidens', 'wickets'].includes(field)) {
      finalValue = parseInt(value) || 0;
    }
    newInnings[innIndex][type][playerIndex][field] = finalValue;
    setMatchFormData({ ...matchFormData, innings: newInnings });
  };

  const handleFullReset = async () => {
    // Double confirmation to prevent accidental wipes
    if (!window.confirm("🚨 WARNING: Are you absolutely sure you want to DELETE ALL DATA? This cannot be undone!")) return;
    if (!window.confirm("🚨 FINAL CONFIRMATION: Are you 100% sure? All matches and players will be permanently erased.")) return;

    try {
      const res = await fetch(`${API_URL}/reset`, { method: "DELETE" });
      if (res.ok) {
        alert("System reset successful. Database is now empty.");
        // Clear dropdown states
        setSelEditPlayer("");
        setSelTargetPlayer("");
        setSelEditMatch("");
        // Refresh the app data
        if (typeof fetchData === "function") fetchData(); 
      }
    } catch (error) {
      alert("Error connecting to backend.");
    }
  };

  // Fetch logic
  const fetchData = async () => {
    try {
      const [pRes, mRes, tRes] = await Promise.all([
        fetch(`${API_URL}/players`), fetch(`${API_URL}/matches`), fetch(`${API_URL}/teams`)
      ]);
      const pData = await pRes.json();
      const mData = await mRes.json();
      const tData = await tRes.json();
      
      setPlayers(pData.map(adaptPlayer));
      setMatches(mData);
      setTeams(tData.map(adaptTeam));
      setConnected(true);
    } catch (err) {
      console.warn("Could not connect to backend. Is Python running?", err);
      setConnected(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const data = { players, matches, teams };
  const filtered = players.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||p.role.toLowerCase().includes(search.toLowerCase()));
  const navItems=[{id:"home",l:"Home",i:"🏠"},{id:"players",l:"Players",i:"👤"},{id:"stats",l:"Stats",i:"📊"},{id:"matches",l:"Matches",i:"🏏"},{id:"teams",l:"Teams",i:"🌍"},{id:"compare",l:"Compare",i:"⚔️"},{id:"admin",l:"Admin",i:"⚙️"}];

  if(selPlayer) return <div style={{minHeight:"100vh",background:T.bg,color:T.text}}><FontLink/><style>{`*{box-sizing:border-box;margin:0;padding:0;}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style><div style={{padding:"20px 0"}}><PlayerDetail player={selPlayer} onBack={()=>setSelPlayer(null)}/></div></div>;
  if(selMatch) return <div style={{minHeight:"100vh",background:T.bg,color:T.text}}><FontLink/><style>{`*{box-sizing:border-box;margin:0;padding:0;}`}</style><div style={{padding:"20px 0"}}><MatchDetail match={selMatch} onBack={()=>setSelMatch(null)}/></div></div>;

  return(
    <div style={{minHeight:"100vh", minWidth: "1200px", background:T.bg,color:T.text,fontFamily:T.font}}>
      <FontLink/>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:${T.bg};}::-webkit-scrollbar-thumb{background:${T.border2};border-radius:3px;}input,select{outline:none;}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>

      {/* NAV */}
      <nav style={{background:`${T.bg2}f0`,backdropFilter:"blur(24px)",borderBottom:`1px solid ${T.border}`,padding:"0 20px",position:"sticky",top:0,zIndex:200}}>
        <div style={{maxWidth:1280,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:56,gap:12}}>
          <div onClick={()=>setPage("home")} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flexShrink:0}}>
            <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${T.green},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏏</div>
            <span style={{fontFamily:T.display,fontSize:20,letterSpacing:2,color:T.green}}>CRIC<span style={{color:T.blue}}>STAT</span><span style={{color:T.text}}>X</span></span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:1,flexWrap:"wrap"}}>
            {navItems.map(n=>( <button key={n.id} onClick={()=>setPage(n.id)} style={{padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:T.font,background:page===n.id?`${T.green}18`:"transparent",color:page===n.id?T.green:T.muted,transition:"all .2s"}}> <span style={{marginRight:3}}>{n.i}</span>{n.l} </button> ))}
          </div>
          <div style={{flexShrink:0}}>
            {(page==="players"||page==="stats")&&(
              <div style={{position:"relative"}}>
                <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",fontSize:12,color:T.muted}}>🔍</span>
                <input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{background:"#ffffff08",border:`1px solid ${T.border2}`,borderRadius:9,padding:"6px 11px 6px 28px",color:T.text,fontSize:13,width:150,fontFamily:T.font}}/>
              </div>
            )}
          </div>
        </div>
      </nav>

      <Ticker data={data} />

      {page==="home"&&<HomePage setPage={setPage} onPlayer={setSelPlayer} onMatch={setSelMatch} data={data}/>}
      
      {page==="players"&&(
        <div style={{padding:"28px 24px",maxWidth:1280,margin:"0 auto"}}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10}}>
            <SecTitle accent={T.green} sub={`${filtered.length} players · click any card for full profile`}>PLAYER ROSTER</SecTitle>
            <div onClick={() => setShowInfo(true)} style={{display: "flex", alignItems: "center", gap: 6, cursor: "pointer", background: `${T.cyan}15`, border: `1px solid ${T.cyan}30`, padding: "8px 14px", borderRadius: 8, color: T.cyan, fontFamily: T.mono, fontSize: 13, transition: "all .2s"}}>
              <span style={{fontSize: 16}}>ⓘ</span> Rating Guide
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:14}}>
            {filtered.sort((a, b) => b.rating - a.rating).map(p=>(
              <Card key={p.id} glow={T.green} onClick={()=>setSelPlayer(p)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:44,height:44,borderRadius:13,background:`${T.green}15`,border:`2px solid ${T.green}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:T.green,fontFamily:T.display}}>{p.avatar}</div>
                    <div><div style={{fontWeight:700,fontSize:15,color:T.text,fontFamily:T.font}}>{p.name}</div><div style={{fontSize:11,color:T.muted}}>{p.role}</div></div>
                  </div>
                  <div style={{fontFamily:T.display,fontSize:28,color:rc(p.rating),lineHeight:1}}>{p.rating}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:10}}>
                  <SBox label="Runs" value={fmtNum(p.stats.odi.runs)} accent={T.blue}/>
                  <SBox label="Avg" value={p.stats.odi.avg} accent={T.green}/>
                  <SBox label="Wkts" value={p.stats.odi.wkts} accent={T.red}/>
                </div>
              </Card>
            ))}
          </div>
          {filtered.length===0&&<div style={{textAlign:"center",padding:60,color:T.muted}}><div style={{fontSize:40,marginBottom:10}}>🔍</div>No player data available.</div>}
        </div>
      )}

      {page==="stats"&&<StatsPage onPlayer={setSelPlayer} data={data}/>}
      
      {page==="matches"&&(
        <div style={{padding:"28px 24px",maxWidth:1280,margin:"0 auto"}}>
          <SecTitle accent={T.blue} sub="All parsed matches and scorecards">MATCH CENTRE</SecTitle>
          <div style={{display:"grid",gap:13}}>
            {matches.map(m=>(
              <Card key={m.id} glow={T.blue} onClick={()=>setSelMatch(m)}>
                <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:11}}>
                  <div>
                    <div style={{fontFamily:T.display,fontSize:24,letterSpacing:1,color:T.text}}>{m.match_title}</div>
                  </div>
                  <div style={{textAlign:"right"}}><div style={{color:T.green,fontWeight:800,fontFamily:T.font}}>{m.result}</div></div>
                </div>
              </Card>
            ))}
          </div>
          {matches.length===0&&<div style={{textAlign:"center",padding:60,color:T.muted}}>No match records found.</div>}
        </div>
      )}

      {page==="teams"&&(
        <div style={{padding:"28px 24px",maxWidth:1100,margin:"0 auto"}}>
          <SecTitle accent={T.blue} sub="Franchise & local team leaderboards">TEAM STANDINGS</SecTitle>

          {(() => {
            // 1. DYNAMICALLY PARSE ALL TEAM STATS FROM MATCH HISTORY
            const tStats = {};

            data.matches.forEach(m => {
              let tNames = m.innings?.map(i => i.team) || [];
              if (tNames.length < 2 && m.match_title) {
                  const pts = m.match_title.split(" V/S ");
                  if (pts.length === 2) tNames = [pts[0].trim(), pts[1].trim()];
              }

              tNames.forEach(t => {
                if (!tStats[t]) tStats[t] = { name: t, m: 0, w: 0, l: 0, t: 0 };
              });

              const res = m.result?.toLowerCase() || "";
              let winner = null;

              tNames.forEach(t => { 
                const teamNameLower = t.toLowerCase();
                if (res.includes(teamNameLower) && res.includes("won")) {
                    if (res.indexOf(teamNameLower) < res.indexOf("won")) {
                        winner = t;
                    }
                }
              });

              if (winner) {
                tNames.forEach(t => {
                  tStats[t].m += 1;
                  if (t === winner) tStats[t].w += 1;
                  else tStats[t].l += 1;
                });
              } else if (res.includes("tie") || res.includes("draw") || res.includes("no result")) {
                tNames.forEach(t => {
                  tStats[t].m += 1;
                  tStats[t].t += 1;
                });
              } else {
                tNames.forEach(t => tStats[t].m += 1); 
              }
            });

            // 2. BAYESIAN STRENGTH CALCULATOR
            const finalTeams = Object.values(tStats).map(t => {
              const actualWinPct = t.m > 0 ? ((t.w + (t.t * 0.5)) / t.m) * 100 : 0;
              const smoothedWinPct = (t.w + (t.t * 0.5) + 1) / (t.m + 2); 
              
              let strength = 40 + (smoothedWinPct * 50) + Math.min(9, t.m * 0.9);
              strength = Math.round(Math.min(99, Math.max(40, strength)));
              
              return { ...t, winPct: actualWinPct.toFixed(1), strength };
            })
            // 3. STRICT SORTING (Primary: AI Strength -> Secondary: Win% -> Tertiary: Total Wins)
            .sort((a, b) => b.strength - a.strength || parseFloat(b.winPct) - parseFloat(a.winPct) || b.w - a.w);

            if (finalTeams.length === 0) return <div style={{textAlign:"center",padding:60,color:T.muted}}>No team data available.</div>;

            return (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
                {finalTeams.map((team, idx) => (
                  <Card key={idx} style={{background:`linear-gradient(180deg, ${T.card}, #0a1120)`}}>
                    
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{width:42,height:42,borderRadius:12,background:`${T.blue}15`,border:`1px solid ${T.blue}30`,display:"flex",alignItems:"center",justifyContent:"center",color:T.blue,fontWeight:900,fontFamily:T.display,fontSize:18}}>
                          {team.name.substring(0,2).toUpperCase()}
                        </div>
                        <div style={{fontFamily:T.display,fontSize:22,color:T.text,letterSpacing:1}}>{team.name.toUpperCase()}</div>
                      </div>
                      <div style={{fontFamily:T.display,fontSize:30,color:[T.green, T.blue, T.purple, T.orange][idx % 4] || T.muted, textShadow:"0 2px 10px rgba(0,0,0,0.5)"}}>
                        #{idx + 1}
                      </div>
                    </div>

                    <div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:8,marginBottom:18}}>
                      {[
                        { l: "MAT", v: team.m, c: T.text },
                        { l: "WON", v: team.w, c: T.green },
                        { l: "LOST", v: team.l, c: T.red },
                        { l: "TIE", v: team.t, c: T.yellow }
                      ].map(st => (
                        <div key={st.l} style={{background:"#ffffff04",border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 0",textAlign:"center"}}>
                          <div style={{fontSize:20,fontWeight:800,color:st.c,fontFamily:T.mono}}>{st.v}</div>
                          <div style={{fontSize:10,color:T.muted,fontFamily:T.mono,marginTop:3}}>{st.l}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{display:"flex",gap:10}}>
                      <div style={{flex:1,background:`${T.purple}10`,border:`1px solid ${T.purple}30`,padding:12,borderRadius:8,textAlign:"center"}}>
                        <div style={{fontSize:22,fontWeight:800,color:T.purple,fontFamily:T.mono}}>{team.winPct}%</div>
                        <div style={{fontSize:11,color:T.purple,fontFamily:T.mono,letterSpacing:1,marginTop:2,opacity:0.8}}>WIN RATE</div>
                      </div>
                      <div style={{flex:1,background:`${T.cyan}10`,border:`1px solid ${T.cyan}30`,padding:12,borderRadius:8,textAlign:"center"}}>
                        <div style={{fontSize:22,fontWeight:800,color:T.cyan,fontFamily:T.mono}}>{team.strength}</div>
                        <div style={{fontSize:11,color:T.cyan,fontFamily:T.mono,letterSpacing:1,marginTop:2,opacity:0.8}}>AI STRENGTH</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {page==="compare"&&<ComparePage data={data}/>}
      {page==="admin"&&(
        <div style={{padding:"28px 24px",maxWidth:1000,margin:"0 auto"}}>
          
          {!isAdminAuth ? (
            /* --- LOCKED STATE --- */
            <div style={{display:"flex",justifyContent:"center",alignItems:"center",minHeight:"60vh"}}>
              <Card style={{width: 400, textAlign: "center", padding: "40px 30px", background:`linear-gradient(180deg, ${T.card}, #0a1120)`}}>
                 <div style={{fontSize: 40, marginBottom: 16}}>🔒</div>
                 <div style={{fontFamily:T.display,fontSize:24,color:T.text,letterSpacing:1,marginBottom:8}}>ADMIN ACCESS</div>
                 <div style={{color:T.muted,fontSize:13,fontFamily:T.mono,marginBottom:28}}>Enter master password to access database</div>
                 
                 <form onSubmit={(e) => {
                   e.preventDefault();
                   if(adminPass === "cricstat") { 
                     setIsAdminAuth(true);
                     setLoginErr("");
                     setAdminPass("");
                   } else {
                     setLoginErr("Incorrect password. Access denied.");
                     setAdminPass("");
                   }
                 }}>
                   <input 
                     type="password" 
                     value={adminPass}
                     onChange={e=>setAdminPass(e.target.value)}
                     placeholder="Enter password..."
                     autoFocus
                     style={{width:"100%",boxSizing:"border-box",padding:"14px 16px",borderRadius:8,background:"#ffffff08",border:`1px solid ${loginErr ? T.red : T.border}`,color:T.text,fontFamily:T.mono,fontSize:14,marginBottom:8,outline:"none", letterSpacing: 2}}
                   />
                   <div style={{height: 20, color:T.red, fontSize:12, fontFamily:T.mono, textAlign:"left", marginBottom: 12}}>
                     {loginErr}
                   </div>
                   
                   <button type="submit" style={{width:"100%",padding:"14px",borderRadius:8,background:T.blue,color:"#fff",border:"none",fontFamily:T.display,fontSize:16,letterSpacing:1,cursor:"pointer",boxShadow:`0 4px 15px ${T.blue}40`, transition: "0.2s"}} onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.2)"} onMouseLeave={e=>e.currentTarget.style.filter="none"}>
                     UNLOCK SYSTEM
                   </button>
                 </form>
              </Card>
            </div>
          ) : (
            /* --- UNLOCKED ADMIN DASHBOARD --- */
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
                <SecTitle accent={T.purple} sub="Manage backend data and API connections">ADMIN DASHBOARD</SecTitle>
                <button onClick={()=>setIsAdminAuth(false)} style={{background:"#ffffff08",border:`1px solid ${T.border}`,color:T.muted,padding:"7px 16px",borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:T.mono}} onMouseEnter={e=>e.currentTarget.style.color=T.red} onMouseLeave={e=>e.currentTarget.style.color=T.muted}>
                  Lock Session 🔒
                </button>
              </div>
              
              {/* TOP ROW: UPLOAD & STATUS */}
              <div style={{display:"grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 24}}>
                
                <Card style={{textAlign:"center", padding: "30px 20px", background:`linear-gradient(180deg, ${T.card}, #0a1120)`}}>
                   <div style={{fontSize: 32, marginBottom: 12}}>📄</div>
                   <div style={{fontFamily:T.display,fontSize:20,color:T.text,marginBottom:8, letterSpacing: 1}}>UPLOAD SCORECARDS</div>
                   
                   {/* FILE SELECTION BUTTON */}
                   <label style={{display: "inline-block", background: T.blue, color: "#fff", padding: "10px 24px", borderRadius: 8, fontFamily: T.display, fontSize: 14, letterSpacing: 1, cursor: "pointer", marginBottom: 15}}>
                     {selectedFiles.length > 0 ? "CHANGE SELECTION" : "SELECT PDF FILES"}
                     <input type="file" multiple accept=".pdf" style={{display: "none"}} onChange={handleFileSelection} />
                   </label>

                   {/* SELECTED FILES LIST */}
                   {selectedFiles.length > 0 && (
                     <div style={{textAlign: "left", background: "#ffffff05", borderRadius: 8, padding: 12, marginBottom: 15, border: `1px solid ${T.border}`}}>
                        <div style={{fontSize: 10, color: T.muted, fontFamily: T.mono, marginBottom: 8, textTransform: "uppercase"}}>Files to Upload ({selectedFiles.length}):</div>
                        {selectedFiles.map((f, i) => (
                          <div key={i} style={{fontSize: 12, color: T.cyan, fontFamily: T.mono, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                            • {f.name}
                          </div>
                        ))}
                     </div>
                   )}

                   {/* CONFIRM UPLOAD BUTTON */}
                   {selectedFiles.length > 0 && (
                     <button 
                       onClick={confirmUpload}
                       disabled={isUploading}
                       style={{width: "100%", background: T.green, color: "#fff", padding: "12px", borderRadius: 8, border: "none", fontFamily: T.display, fontSize: 16, cursor: isUploading ? "not-allowed" : "pointer", opacity: isUploading ? 0.6 : 1, boxShadow: `0 4px 15px ${T.green}30`}}
                     >
                       {isUploading ? "UPLOADING..." : "CONFIRM & UPLOAD NOW"}
                     </button>
                   )}
                </Card>

                <Card style={{padding: "24px"}}>
                   <div style={{fontFamily:T.display,fontSize:18,color:T.purple,marginBottom:20, letterSpacing: 1}}>SYSTEM STATUS</div>
                   
                   <div style={{display: "flex", justifyContent: "space-between", marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${T.border}`}}>
                     <span style={{color: T.muted, fontFamily: T.mono, fontSize: 13}}>Python API Connection</span>
                     <span style={{color: T.green, fontFamily: T.mono, fontSize: 13, fontWeight: 700}}>🟢 ONLINE</span>
                   </div>
                   
                   <div style={{display: "flex", justifyContent: "space-between", marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${T.border}`}}>
                     <span style={{color: T.muted, fontFamily: T.mono, fontSize: 13}}>Players Indexed</span>
                     <span style={{color: T.text, fontFamily: T.mono, fontSize: 16, fontWeight: 800}}>{data?.players?.length || 0}</span>
                   </div>
                   
                   <div style={{display: "flex", justifyContent: "space-between"}}>
                     <span style={{color: T.muted, fontFamily: T.mono, fontSize: 13}}>Matches Recorded</span>
                     <span style={{color: T.text, fontFamily: T.mono, fontSize: 16, fontWeight: 800}}>{data?.matches?.length || 0}</span>
                   </div>
                </Card>
              </div>

              {/* BOTTOM ROW: DATABASE MANAGEMENT */}
              <div style={{fontFamily:T.display,fontSize:20,color:T.text,letterSpacing:1,marginBottom:16, marginTop: 10}}>DATABASE MANAGEMENT</div>
              <div style={{display:"grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 20}}>
                 
                 {/* PLAYER CONTROLS */}
                 <Card style={{padding: "24px"}}>
                    <div style={{fontSize: 24, marginBottom: 12}}>👤</div>
                    <div style={{fontFamily:T.display,fontSize:18,color:T.blue,marginBottom:8, letterSpacing: 1}}>PLAYER CONTROLS</div>
                    <div style={{fontFamily:T.mono, fontSize: 12, color: T.muted, marginBottom: 20}}>Edit profiles, remove duplicates, or delete players entirely.</div>
                    
                    {/* Wires the dropdown to selEditPlayer */}
                    <select value={selEditPlayer} onChange={e=>setSelEditPlayer(e.target.value)} style={{width:"100%", padding:"10px", borderRadius:6, background:"#ffffff08", border:`1px solid ${T.border}`, color:T.text, marginBottom: 12, fontFamily:T.mono, outline:"none"}}>
                      <option value="" style={{background: T.card}}>-- Select a Player --</option>
                      {data?.players?.map(p => <option key={p.id || p.name} value={p.name} style={{background: T.card}}>{p.name}</option>)}
                    </select>
                    
                    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
                      <button onClick={()=>alert("Edit Player Form coming soon!")} style={{padding:"8px", borderRadius:6, background:`${T.blue}15`, color:T.blue, border:`1px solid ${T.blue}40`, cursor:"pointer", fontFamily:T.mono, fontSize: 12, fontWeight: 600}} onMouseEnter={e=>e.currentTarget.style.background=`${T.blue}30`} onMouseLeave={e=>e.currentTarget.style.background=`${T.blue}15`}>✏️ Edit Player</button>
                      {/* Triggers handleDeletePlayer */}
                      <button onClick={handleDeletePlayer} style={{padding:"8px", borderRadius:6, background:`${T.red}15`, color:T.red, border:`1px solid ${T.red}40`, cursor:"pointer", fontFamily:T.mono, fontSize: 12, fontWeight: 600}} onMouseEnter={e=>e.currentTarget.style.background=`${T.red}30`} onMouseLeave={e=>e.currentTarget.style.background=`${T.red}15`}>🗑️ Delete</button>
                    </div>
                    
                    {/* MERGE PLAYERS TOOL */}
                    <div style={{marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.border}`}}>
                      <div style={{fontFamily:T.mono, fontSize: 11, color: T.muted, marginBottom: 8}}>Merge selected player into:</div>
                      <div style={{display:"flex", gap: 10}}>
                        {/* Wires the target dropdown to selTargetPlayer */}
                        <select value={selTargetPlayer} onChange={e=>setSelTargetPlayer(e.target.value)} style={{flex:1, padding:"8px", borderRadius:6, background:"#ffffff08", border:`1px solid ${T.border}`, color:T.text, fontFamily:T.mono, outline:"none"}}>
                          <option value="" style={{background: T.card}}>-- Target Player --</option>
                          {data?.players?.map(p => <option key={`target-${p.id || p.name}`} value={p.name} style={{background: T.card}}>{p.name}</option>)}
                        </select>
                        {/* Triggers handleMergePlayers */}
                        <button onClick={handleMergePlayers} style={{padding:"8px 16px", borderRadius:6, background:`${T.purple}15`, color:T.purple, border:`1px solid ${T.purple}40`, cursor:"pointer", fontFamily:T.mono, fontSize: 12, fontWeight: 600}} onMouseEnter={e=>e.currentTarget.style.background=`${T.purple}30`} onMouseLeave={e=>e.currentTarget.style.background=`${T.purple}15`}>🔗 Merge</button>
                      </div>
                    </div>
                 </Card>

                 {/* MATCH CONTROLS */}
                 <Card style={{padding: "24px"}}>
                    <div style={{fontSize: 24, marginBottom: 12}}>🏏</div>
                    <div style={{fontFamily:T.display,fontSize:18,color:T.orange,marginBottom:8, letterSpacing: 1}}>MATCH CONTROLS</div>
                    <div style={{fontFamily:T.mono, fontSize: 12, color: T.muted, marginBottom: 20}}>Fix scorecard errors, alter match results, or delete invalid matches.</div>
                    
                    {/* Wires the dropdown to selEditMatch */}
                    <select value={selEditMatch} onChange={e=>setSelEditMatch(e.target.value)} style={{width:"100%", padding:"10px", borderRadius:6, background:"#ffffff08", border:`1px solid ${T.border}`, color:T.text, marginBottom: 12, fontFamily:T.mono, outline:"none"}}>
                      <option value="" style={{background: T.card}}>-- Select a Match --</option>
                      {/* Notice we use m.id as the value so the Python backend knows exactly which one to delete */}
                      {data?.matches?.map((m) => <option key={m.id} value={m.id} style={{background: T.card}}>{m.match_title}</option>)}
                    </select>
                    
                    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
                      <button onClick={handleOpenEditMatch} style={{padding:"8px", borderRadius:6, background:`${T.orange}15`, color:T.orange, border:`1px solid ${T.orange}40`, cursor:"pointer", fontFamily:T.mono, fontSize: 12, fontWeight: 600}} onMouseEnter={e=>e.currentTarget.style.background=`${T.orange}30`} onMouseLeave={e=>e.currentTarget.style.background=`${T.orange}15`}>✏️ Edit Match</button>
                      {/* Triggers handleDeleteMatch */}
                      <button onClick={handleDeleteMatch} style={{padding:"8px", borderRadius:6, background:`${T.red}15`, color:T.red, border:`1px solid ${T.red}40`, cursor:"pointer", fontFamily:T.mono, fontSize: 12, fontWeight: 600}} onMouseEnter={e=>e.currentTarget.style.background=`${T.red}30`} onMouseLeave={e=>e.currentTarget.style.background=`${T.red}15`}>🗑️ Delete Match</button>
                    </div>
                 </Card>

                 {/* DANGER ZONE */}
                 <Card style={{padding: "24px", gridColumn: "1 / -1", border: `1px solid ${T.red}40`, background: `linear-gradient(180deg, #3a0a0a20, #0a1120)`}}>
                    <div style={{fontSize: 24, marginBottom: 12}}>⚠️</div>
                    <div style={{fontFamily:T.display,fontSize:18,color:T.red,marginBottom:8, letterSpacing: 1}}>DANGER ZONE</div>
                    <div style={{fontFamily:T.mono, fontSize: 12, color: T.muted, marginBottom: 20}}>Permanently erase all matches, players, and stats from the system.</div>
                    
                    <button 
                      onClick={handleFullReset} 
                      style={{width: "100%", padding:"14px", borderRadius:8, background:`${T.red}15`, color:T.red, border:`1px solid ${T.red}`, cursor:"pointer", fontFamily:T.display, fontSize: 16, letterSpacing: 1, transition: "0.2s"}} 
                      onMouseEnter={e=>{e.currentTarget.style.background=T.red; e.currentTarget.style.color="#fff"; e.currentTarget.style.boxShadow=`0 4px 15px ${T.red}60`;}} 
                      onMouseLeave={e=>{e.currentTarget.style.background=`${T.red}15`; e.currentTarget.style.color=T.red; e.currentTarget.style.boxShadow="none";}}
                    >
                      🚨 INITIATE FULL FACTORY RESET 🚨
                    </button>
                 </Card>

              </div>
            </div>
          )}
        </div>
      )}
      {/* --- EDIT MATCH POPUP MODAL --- */}
      {showMatchModal && (
        <div style={{position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(5px)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center"}}>
          <Card style={{width: 1200, maxWidth: "95vw", padding: 40, border:`1px solid ${T.orange}50`, background:`linear-gradient(180deg, ${T.card}, #0a1120)`, maxHeight: "95vh", overflowY: "auto"}}>
            <div style={{fontFamily:T.display, fontSize:22, color:T.orange, marginBottom: 20}}>✏️ EDIT MATCH & PLAYER STATS</div>

            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15, marginBottom: 20}}>
              <div>
                <label style={{display:"block", color:T.muted, fontSize:12, fontFamily:T.mono, marginBottom:5}}>Match Title (Teams)</label>
                <input type="text" value={matchFormData.title} onChange={e => setMatchFormData({...matchFormData, title: e.target.value})} style={{width:"100%", boxSizing: "border-box", padding:12, borderRadius:6, background:"#ffffff10", border:`1px solid ${T.border}`, color:T.text, outline:"none", fontFamily:T.mono}} />
              </div>
              <div>
                <label style={{display:"block", color:T.muted, fontSize:12, fontFamily:T.mono, marginBottom:5}}>Match Result</label>
                <input type="text" value={matchFormData.result} onChange={e => setMatchFormData({...matchFormData, result: e.target.value})} style={{width:"100%", boxSizing: "border-box", padding:12, borderRadius:6, background:"#ffffff10", border:`1px solid ${T.border}`, color:T.text, outline:"none", fontFamily:T.mono}} />
              </div>
            </div>

            {/* --- INNINGS EDITORS --- */}
            {matchFormData.innings.map((inn, innIdx) => (
              <div key={innIdx} style={{marginBottom: 20, padding: 15, background: "#ffffff05", border: `1px solid ${T.border}`, borderRadius: 8}}>
                <div style={{fontFamily: T.display, color: T.cyan, fontSize: 16, marginBottom: 10}}>INNINGS {innIdx + 1}</div>
                
                {/* INNINGS TOTALS */}
                <div style={{display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, marginBottom: 15}}>
                  <div><label style={{color:T.muted, fontSize:10, fontFamily:T.mono}}>Team</label><input type="text" value={inn.team} onChange={e => handleInningsChange(innIdx, "team", e.target.value)} style={{width:"100%", boxSizing: "border-box", padding:8, borderRadius:4, background:"#ffffff10", border:`1px solid ${T.border}`, color:T.text, outline:"none", fontFamily:T.mono, fontSize: 12}} /></div>
                  <div><label style={{color:T.muted, fontSize:10, fontFamily:T.mono}}>Runs</label><input type="number" value={inn.total} onChange={e => handleInningsChange(innIdx, "total", e.target.value)} style={{width:"100%", boxSizing: "border-box", padding:8, borderRadius:4, background:"#ffffff10", border:`1px solid ${T.border}`, color:T.text, outline:"none", fontFamily:T.mono, fontSize: 12}} /></div>
                  <div><label style={{color:T.muted, fontSize:10, fontFamily:T.mono}}>Wickets</label><input type="number" value={inn.wickets} onChange={e => handleInningsChange(innIdx, "wickets", e.target.value)} style={{width:"100%", boxSizing: "border-box", padding:8, borderRadius:4, background:"#ffffff10", border:`1px solid ${T.border}`, color:T.text, outline:"none", fontFamily:T.mono, fontSize: 12}} /></div>
                  <div><label style={{color:T.muted, fontSize:10, fontFamily:T.mono}}>Overs</label><input type="text" value={inn.overs} onChange={e => handleInningsChange(innIdx, "overs", e.target.value)} style={{width:"100%", boxSizing: "border-box", padding:8, borderRadius:4, background:"#ffffff10", border:`1px solid ${T.border}`, color:T.text, outline:"none", fontFamily:T.mono, fontSize: 12}} /></div>
                </div>

                {/* BATTING SCORECARD (Collapsible) */}
                    {inn.batting?.length > 0 && (
                      <details style={{background: "#ffffff03", border: `1px solid ${T.border}`, borderRadius: 6, marginBottom: 15, padding: 15}}>
                        <summary style={{color: T.yellow, fontFamily: T.display, cursor: "pointer", letterSpacing: 1, outline: "none"}}>🏏 EDIT BATTING</summary>
                        <div style={{marginTop: 15, display: "flex", flexDirection: "column", gap: 8}}>
                          
                          {/* NEW: COLUMN HEADERS */}
                          <div style={{display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, paddingBottom: 8, borderBottom: `1px solid ${T.border}`, color: T.muted, fontSize: 11, fontFamily: T.mono, textAlign: "center"}}>
                            <div style={{textAlign: "left", paddingLeft: 5}}>Batter</div>
                            <div>Runs</div>
                            <div>Balls</div>
                            <div>4s</div>
                            <div>6s</div>
                          </div>

                          {/* SPACIOUS DATA ROWS */}
                          {inn.batting.map((b, bIdx) => (
                            <div key={bIdx} style={{display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8}}>
                              <input type="text" value={b.name} onChange={e=>handlePlayerStatChange(innIdx, 'batting', bIdx, 'name', e.target.value)} style={{padding:8, borderRadius:4, background:"#00000060", border:`1px solid ${T.border}`, color:T.text, outline:"none", fontFamily:T.mono, fontSize:12}} />
                              <input type="number" value={b.runs} onChange={e=>handlePlayerStatChange(innIdx, 'batting', bIdx, 'runs', e.target.value)} style={{padding:8, borderRadius:4, background:"#00000060", border:`1px solid ${T.border}`, color:T.yellow, outline:"none", fontFamily:T.mono, fontSize:12, textAlign:"center"}} />
                              <input type="number" value={b.balls} onChange={e=>handlePlayerStatChange(innIdx, 'batting', bIdx, 'balls', e.target.value)} style={{padding:8, borderRadius:4, background:"#00000060", border:`1px solid ${T.border}`, color:T.text, outline:"none", fontFamily:T.mono, fontSize:12, textAlign:"center"}} />
                              <input type="number" value={b.fours} onChange={e=>handlePlayerStatChange(innIdx, 'batting', bIdx, 'fours', e.target.value)} style={{padding:8, borderRadius:4, background:"#00000060", border:`1px solid ${T.border}`, color:T.blue, outline:"none", fontFamily:T.mono, fontSize:12, textAlign:"center"}} />
                              <input type="number" value={b.sixes} onChange={e=>handlePlayerStatChange(innIdx, 'batting', bIdx, 'sixes', e.target.value)} style={{padding:8, borderRadius:4, background:"#00000060", border:`1px solid ${T.border}`, color:T.purple, outline:"none", fontFamily:T.mono, fontSize:12, textAlign:"center"}} />
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* BOWLING SCORECARD (Collapsible) */}
                    {inn.bowling?.length > 0 && (
                      <details style={{background: "#ffffff03", border: `1px solid ${T.border}`, borderRadius: 6, padding: 15}}>
                        <summary style={{color: T.orange, fontFamily: T.display, cursor: "pointer", letterSpacing: 1, outline: "none"}}>🎯 EDIT BOWLING</summary>
                        <div style={{marginTop: 15, display: "flex", flexDirection: "column", gap: 8}}>
                          
                          {/* NEW: COLUMN HEADERS */}
                          <div style={{display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, paddingBottom: 8, borderBottom: `1px solid ${T.border}`, color: T.muted, fontSize: 11, fontFamily: T.mono, textAlign: "center"}}>
                            <div style={{textAlign: "left", paddingLeft: 5}}>Bowler</div>
                            <div>Overs</div>
                            <div>Maidens</div>
                            <div>Runs</div>
                            <div>Wickets</div>
                          </div>

                          {/* SPACIOUS DATA ROWS */}
                          {inn.bowling.map((bw, bwIdx) => (
                            <div key={bwIdx} style={{display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8}}>
                              <input type="text" value={bw.name} onChange={e=>handlePlayerStatChange(innIdx, 'bowling', bwIdx, 'name', e.target.value)} style={{padding:8, borderRadius:4, background:"#00000060", border:`1px solid ${T.border}`, color:T.text, outline:"none", fontFamily:T.mono, fontSize:12}} />
                              <input type="text" value={bw.overs} onChange={e=>handlePlayerStatChange(innIdx, 'bowling', bwIdx, 'overs', e.target.value)} style={{padding:8, borderRadius:4, background:"#00000060", border:`1px solid ${T.border}`, color:T.text, outline:"none", fontFamily:T.mono, fontSize:12, textAlign:"center"}} />
                              <input type="number" value={bw.maidens} onChange={e=>handlePlayerStatChange(innIdx, 'bowling', bwIdx, 'maidens', e.target.value)} style={{padding:8, borderRadius:4, background:"#00000060", border:`1px solid ${T.border}`, color:T.text, outline:"none", fontFamily:T.mono, fontSize:12, textAlign:"center"}} />
                              <input type="number" value={bw.runs} onChange={e=>handlePlayerStatChange(innIdx, 'bowling', bwIdx, 'runs', e.target.value)} style={{padding:8, borderRadius:4, background:"#00000060", border:`1px solid ${T.border}`, color:T.red, outline:"none", fontFamily:T.mono, fontSize:12, textAlign:"center"}} />
                              <input type="number" value={bw.wickets} onChange={e=>handlePlayerStatChange(innIdx, 'bowling', bwIdx, 'wickets', e.target.value)} style={{padding:8, borderRadius:4, background:"#00000060", border:`1px solid ${T.border}`, color:T.orange, outline:"none", fontFamily:T.mono, fontSize:12, textAlign:"center"}} />
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

              </div>
            ))}

            <div style={{display:"flex", gap: 10, marginTop: 10}}>
              <button onClick={() => setShowMatchModal(false)} style={{flex:1, padding:12, borderRadius:6, background:"transparent", border:`1px solid ${T.border}`, color:T.text, cursor:"pointer", fontFamily:T.mono}}>Cancel</button>
              <button onClick={handleSaveMatchEdit} style={{flex:1, padding:12, borderRadius:6, background:T.orange, border:"none", color:"#fff", fontWeight:"bold", cursor:"pointer", fontFamily:T.display, letterSpacing:1}}>Save Master Record</button>
            </div>
          </Card>
        </div>
      )}
      {/* GLOBAL POPUP MODAL FOR RATING GUIDE */}
      {showInfo && (
        <div style={{position:"fixed",inset:0,background:"rgba(5,9,15,0.85)",backdropFilter:"blur(4px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setShowInfo(false)}>
          <Card style={{maxWidth:500,width:"100%",border:`1px solid ${T.cyan}40`,background:`${T.bg2}`,boxShadow:"0 20px 40px rgba(0,0,0,0.6)",cursor:"default"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontFamily:T.display,fontSize:22,color:T.cyan,letterSpacing:1}}>HOW THE RATING IS CALCULATED</div>
              <button onClick={()=>setShowInfo(false)} style={{background:"transparent",border:"none",color:T.muted,cursor:"pointer",fontSize:22}}>&times;</button>
            </div>
            <div style={{fontSize:14,color:T.text,lineHeight:1.7,fontFamily:T.font}}>
              <p style={{marginBottom:10}}><b style={{color:T.green}}>1. Fantasy Points (FPTS):</b> Raw impact is calculated from actual match stats: Runs (1 pt), Wickets (25 pts), 4s (2 pts), and 6s (4 pts).</p>
              <p style={{marginBottom:10}}><b style={{color:T.blue}}>2. Match Consistency (FPPM):</b> Total Fantasy Points are divided by Matches Played to find the player's average impact per game.</p>
              <p style={{marginBottom:10}}><b style={{color:T.purple}}>3. The Asymptotic Curve:</b> The FPPM is passed through a sports-game algorithm. It acts like gravity: climbing from a base of 40 to 60 is easy, 60 to 80 is hard, and pushing past 85 requires elite, sustained performance.</p>
              <p><b style={{color:T.orange}}>4. Elite Modifiers:</b> Small final bonuses are awarded for maintaining elite Strike Rates (&gt;130) or Economy Rates (&lt;7.0).</p>
            </div>
          </Card>
        </div>
      )}

      <footer style={{borderTop:`1px solid ${T.border}`,padding:"20px",textAlign:"center",marginTop:40,background:T.bg2}}></footer>
      <footer style={{borderTop:`1px solid ${T.border}`,padding:"20px",textAlign:"center",marginTop:40,background:T.bg2}}>
        <div style={{fontFamily:T.display,fontSize:17,letterSpacing:2,color:T.green,marginBottom:4}}>CRICSTATX</div>
        <div style={{fontSize:11,color:T.muted,fontFamily:T.mono}}>Advanced Cricket Analytics Platform · 2026</div>
      </footer>
    </div>
  );
}
