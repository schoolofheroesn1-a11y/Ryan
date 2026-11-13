import asyncio, os, sys, subprocess, edge_tts
PROXY=os.environ.get('HTTPS_PROXY')
lines=[l.strip() for l in open('lines.txt',encoding='utf-8') if l.strip()]
def ok(p):
    if not os.path.exists(p) or os.path.getsize(p)==0: return False
    r=subprocess.run(['ffmpeg','-v','error','-i',p,'-f','null','-'],capture_output=True,text=True)
    return r.stderr.strip()==''
async def one(i,text):
    p=f'l{i}.mp3'
    for k in range(12):
        if ok(p): return True
        try:
            c=edge_tts.Communicate(text,'ru-RU-DmitryNeural',rate='+0%',proxy=PROXY)
            await c.save(p)
        except Exception as e:
            print(i,'err',type(e).__name__, flush=True)
        await asyncio.sleep(1.5)
    return ok(p)
async def main():
    for i,t in enumerate(lines,1):
        print(i, await one(i,t), flush=True)
asyncio.run(main())
