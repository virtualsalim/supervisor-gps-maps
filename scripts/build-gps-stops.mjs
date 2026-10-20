import fs from 'node:fs';
import path from 'node:path';
import {detectStops,mergeNearbyStops} from './gps-stops.mjs';
const root=path.resolve(process.argv[2]||'data');
const dates=JSON.parse(fs.readFileSync(path.join(root,'dates.json'),'utf8')).dates;
if(!Array.isArray(dates)||!dates.length)throw Error('Invalid GPS date manifest');
const folder=path.join(root,'stops');fs.mkdirSync(folder,{recursive:true});
for(const date of dates){
 const route=JSON.parse(fs.readFileSync(path.join(root,date+'.json'),'utf8'));
 if(route.date!==date||!Array.isArray(route.positions))throw Error('Invalid route '+date);
 const stops=mergeNearbyStops(detectStops(route.positions),route.positions);
 fs.writeFileSync(path.join(folder,date+'.json'),JSON.stringify({version:1,date,stops})+'\n');
 console.log(date+': '+stops.length+' stops');
}