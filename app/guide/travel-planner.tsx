'use client';
import { useState } from 'react';
export function TravelPlanner() {
  const [origin,setOrigin]=useState(''),[start,setStart]=useState('19:30'),[duration,setDuration]=useState('60'),[kind,setKind]=useState('match');
  const question=`I'm starting at ${origin}. ${kind==='concert'?'Concert':'Match'} at Q2 starts at ${start}. My travel takes ${duration} minutes. Show my options and when to leave.`;
  return <form className="guide-feature" action="/">
    <h2>Plan your arrival</h2><p>Compare car, rideshare, Red Line, Rapid 803, and bike options. Use the route duration from Maps to calculate a leave-by time.</p>
    <label htmlFor="origin">Starting point</label><input id="origin" required maxLength={120} value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="UT Austin or a street address"/>
    <label htmlFor="event-kind">Event type</label><select id="event-kind" value={kind} onChange={e=>setKind(e.target.value)}><option value="match">Austin FC match</option><option value="concert">Concert / other event</option></select>
    <label htmlFor="start-time">Start time (Austin time)</label><input id="start-time" type="time" required value={start} onChange={e=>setStart(e.target.value)}/>
    <label htmlFor="travel-duration">Travel duration / planning allowance (minutes)</label><input id="travel-duration" type="number" min={1} max={240} required value={duration} onChange={e=>setDuration(e.target.value)}/>
    <input type="hidden" name="ask" value={question}/><button type="submit">Build my arrival plan</button>
  </form>;
}
