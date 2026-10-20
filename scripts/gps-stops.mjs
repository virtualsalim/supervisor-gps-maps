// Standalone 24-hour GPS stop detector, adapted from Clarentia GPS thresholds.
// All outputs are derived from recorded fixes; long recording gaps split the track.
export const RULES={minMinutes:5,radius:30,minPoints:5,minRatio:0.8,maxOutliers:1,maxGap:300000};
const rad=x=>x*Math.PI/180;
function distance(a,b){const dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon);const q=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(q)));}
function median(vals){const s=vals.slice().sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;}
function center(ps){return {lat:median(ps.map(p=>p.lat)),lon:median(ps.map(p=>p.lon))};}
function candidate(points){
 const preliminary=center(points),near=points.filter(p=>distance(p,preliminary)<=RULES.radius);
 if(!near.length)return null;
 const c=center(near),flags=points.map(p=>distance(p,c)<=RULES.radius),first=flags.indexOf(true),last=flags.lastIndexOf(true);
 if(first<0)return null;
 let consecutive=0,maxConsecutive=0;
 for(const yes of flags){if(yes)consecutive=0;else maxConsecutive=Math.max(maxConsecutive,++consecutive);}
 const valid=flags.slice(first,last+1),inside=valid.filter(Boolean).length,outside=valid.length-inside;
 const time=points[last].time-points[first].time;
 return {center:c,first,last,inside,outside,time,maxConsecutive,ratio:inside/(inside+outside)};
}
export function detectStops(rows){
 const points=rows.filter(p=>Array.isArray(p)&&p.length>=3&&p.slice(0,3).every(Number.isFinite)).map(([time,lat,lon])=>({time,lat,lon})).sort((a,b)=>a.time-b.time);
 const segments=[];let segment=[];
 for(const p of points){if(segment.length&&p.time-segment.at(-1).time>RULES.maxGap){segments.push(segment);segment=[];}segment.push(p);}
 if(segment.length)segments.push(segment);
 const stops=[];
 for(const track of segments){
   let start=0;
   while(start<track.length){
     let best=null;
     for(let end=start;end<track.length;end++){
       const analysis=candidate(track.slice(start,end+1));if(!analysis)continue;
       if(analysis.maxConsecutive>RULES.maxOutliers)break;
       if(analysis.time>=RULES.minMinutes*60000&&analysis.inside>=RULES.minPoints&&analysis.ratio>=RULES.minRatio)best=analysis;
     }
     if(!best){start++;continue;}
     stops.push({lat:best.center.lat,lon:best.center.lon,startMs:track[start+best.first].time,endMs:track[start+best.last].time,
       durationMinutes:Math.round(best.time/60000),inlierCount:best.inside,outlierCount:best.outside});
     start+=best.last+1;
   }
 }
 return stops;
}


 // Two-stage grouping: 30 m recognizes individual stops; sustained departure
 // (>80 m for >=3 min across >=3 readings) decides whether to keep them apart.
export const GROUP_RULES={departureRadius:80,minDepartureMs:3*60000,minDepartureReadings:3};
export function mergeNearbyStops(stops,rows){
  if(stops.length<2)return stops;
  const points=rows.filter(p=>Array.isArray(p)&&p.length>=3&&p.slice(0,3).every(Number.isFinite))
    .map(([time,lat,lon])=>({time,lat,lon})).sort((a,b)=>a.time-b.time);
  const result=[];let group=[];
  function flush(){
    if(!group.length)return;
    if(group.length===1){result.push(group[0]);group=[];return;}
    const first=group[0],last=group.at(-1);
    const relevant=points.filter(p=>p.time>=first.startMs&&p.time<=last.endMs);
    const c=center(relevant);
    result.push({lat:c.lat,lon:c.lon,startMs:first.startMs,endMs:last.endMs,
      durationMinutes:Math.round((last.endMs-first.startMs)/60000),
      inlierCount:group.reduce((n,x)=>n+x.inlierCount,0),
      outlierCount:group.reduce((n,x)=>n+x.outlierCount,0),
      mergedStops:group.length});
    group=[];
  }
  function confirmedDeparture(startMs,endMs,anchor){
    let firstFar=null,farCount=0,previous=null;
    for(const p of points){
      if(p.time<startMs)continue;
      if(p.time>endMs)break;
      if(previous&&p.time-previous.time>RULES.maxGap)return true;
      previous=p;
      if(distance(p,anchor)>GROUP_RULES.departureRadius){
        if(firstFar===null)firstFar=p.time;
        farCount++;
        if(farCount>=GROUP_RULES.minDepartureReadings&&p.time-firstFar>=GROUP_RULES.minDepartureMs)return true;
      }else{firstFar=null;farCount=0;}
    }
    return false;
  }
  for(const stop of stops){
    if(!group.length){group.push(stop);continue;}
    const first=group[0],anchor={lat:first.lat,lon:first.lon};
    if(distance(anchor,stop)<=GROUP_RULES.departureRadius&&!confirmedDeparture(first.startMs,stop.endMs,anchor))group.push(stop);
    else {flush();group.push(stop);}
  }
  flush();return result;
}
