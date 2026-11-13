// Render the whole clip: node render.cjs <out.mp4> [music.wav] [voice.wav]
const {chromium}=require('playwright');
const {spawn}=require('child_process');
const FPS=30;
(async()=>{
  const out=process.argv[2]||'shkola_zhizni.mp4', music=process.argv[3], voice=process.argv[4];
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1080,height:1920}});
  await p.goto('file://'+__dirname+'/scene.html');
  await p.evaluate(()=>document.fonts.ready);
  const total=await p.evaluate(()=>window.TOTAL);
  const args=['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-'];
  if(music) args.push('-i',music);
  if(voice) args.push('-i',voice);
  if(music&&voice) args.push('-filter_complex','[1:a]volume=0.9[m];[2:a]asplit=2[v1][v2];[m][v1]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=500[md];[md][v2]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]','-map','0:v','-map','[a]');
  args.push('-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r',String(FPS));
  if(music) args.push('-c:a','aac','-b:a','192k');
  args.push('-t',String(total),'-movflags','+faststart',out);
  const ff=spawn('ffmpeg',args,{stdio:['pipe','inherit','inherit']});
  const n=Math.round(total*FPS);
  for(let i=0;i<n;i++){
    await p.evaluate(t=>renderFrame(t),i/FPS);
    const buf=await p.screenshot({type:'jpeg',quality:94});
    if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r));
    if(i%150===0) console.log(`frame ${i}/${n}`);
  }
  ff.stdin.end();
  await new Promise(r=>ff.on('close',r));
  await b.close();
  console.log('done',out);
})();
