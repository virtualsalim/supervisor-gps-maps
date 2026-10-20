import test from 'node:test';
import assert from 'node:assert/strict';
import {detectStops,RULES} from './gps-stops.mjs';
const BASE=Date.UTC(2026,9,19,12);
const fix=(m,lat=-23.565,lon=-46.685)=>[BASE+m*60000,lat,lon];
test('5-minute stop within 30 meters using six one-minute fixes',()=>{
 const stops=detectStops([fix(0),fix(1,-23.56502),fix(2),fix(3),fix(4),fix(5)]);
 assert.equal(stops.length,1);assert.equal(stops[0].durationMinutes,5);
 assert.equal(stops[0].inlierCount,6);
});
test('five observations over four minutes do not count',()=>{
 assert.deepEqual(detectStops([0,1,2,3,4].map(m=>fix(m))),[]);
});
test('one isolated outlier is allowed, two consecutive end the stop',()=>{
 const one=detectStops([fix(0),fix(1),fix(2),fix(3,-23.5642,-46.6842),fix(4),fix(5)]);
 assert.equal(one.length,1);assert.equal(one[0].outlierCount,1);
 const two=detectStops([fix(0),fix(1),fix(2),fix(3),fix(4),fix(5),fix(6,-23.56,-46.68),fix(7,-23.55,-46.67)]);
 assert.equal(two.length,1);assert.equal(two[0].endMs,fix(5)[0]);
});
test('do not infer a stop across an unrecorded long gap',()=>{
 assert.deepEqual(detectStops([fix(0),fix(1),fix(2),fix(30),fix(31),fix(32)]),[]);
});
test('revisit a location produces two distinct stops',()=>{
 const stops=detectStops([...Array.from({length:7},(_,i)=>fix(i)),
 ...Array.from({length:8},(_,i)=>fix(i+10,-23.56+i*.001,-46.68)),
 ...Array.from({length:7},(_,i)=>fix(i+30,-23.52,-46.60))]);
 assert.equal(stops.length,2);
});
test('Clarentia threshold parity',()=>{
 assert.deepEqual([RULES.minMinutes,RULES.radius,RULES.minPoints,RULES.minRatio,RULES.maxOutliers],[5,30,5,.8,1]);
});
