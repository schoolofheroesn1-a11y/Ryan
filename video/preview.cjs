// Render individual frames as PNG: node preview.js <outDir> <t1> <t2> ...
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1080,height:1920}});
  const errs=[];
  p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('file://'+__dirname+'/scene.html');
  await p.evaluate(()=>document.fonts.ready);
  const out=process.argv[2];
  for(const t of process.argv.slice(3).map(Number)){
    await p.evaluate(t=>renderFrame(t),t);
    await p.screenshot({path:`${out}/f_${t}.png`});
  }
  console.log(errs.join('\n')||'no errors');
  await b.close();
})();
