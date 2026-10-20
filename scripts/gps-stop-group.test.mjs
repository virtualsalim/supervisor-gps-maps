import test from 'node:test';
import assert from 'node:assert/strict';
import {detectStops,mergeNearbyStops,RULES,GROUP_RULES} from './gps-stops.mjs';
const base=Date.UTC(2026,9,18,11);
const p=(m,lat=-23.565,lon=-46.685)=>[base+m*60000,lat,lon];
const standing=(a,b,lat=-23.565,lon=-46.685)=>Array.from({length:b-a+1},(_,i)=>p(a+i,lat,lon));
const run=rows=>mergeNearbyStops(detectStops(rows),rows);
test('retains original 30 meter, five minute recognition',()=>{
 assert.equal(RULES.radius,30);assert.equal(RULES.minMinutes,5);
 assert.equal(detectStops(standing(0,4)).length,0);
 assert.equal(detectStops(standing(0,5)).length,1);
});
test('merges nearby stationary periods',()=>{
 const rows=[...standing(0,9),...standing(10,19,-23.5646)];
 assert.equal(detectStops(rows).length,2);
 const stops=run(rows);assert.equal(stops.length,1);
 assert.equal(stops[0].durationMinutes,19);assert.equal(stops[0].mergedStops,2);
});
test('brief GPS outliers do not count as departure',()=>{
 const rows=[...standing(0,6),p(7,-23.563),p(8,-23.563),...standing(9,17)];
 assert.equal(detectStops(rows).length,2);assert.equal(run(rows).length,1);
});
test('real three-minute departure and return stays separate',()=>{
 const rows=[...standing(0,7),...standing(8,12,-23.563),...standing(13,20)];
 assert.ok(run(rows).length>=2);
});
test('distinct stop sites separated by more than 80 meters remain distinct',()=>{
 const rows=[...standing(0,8),...standing(9,17,-23.564)];
 assert.equal(run(rows).length,2);
});
test('a recording gap above five minutes is not bridged',()=>{
 const rows=[...standing(0,7),...standing(15,22)];
 assert.equal(run(rows).length,2);
});
test('departure rule thresholds remain explicit',()=>{
 assert.equal(GROUP_RULES.departureRadius,80);
 assert.equal(GROUP_RULES.minDepartureMs,180000);
 assert.equal(GROUP_RULES.minDepartureReadings,3);
});
