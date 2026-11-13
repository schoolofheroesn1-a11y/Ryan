import base64,re
tl=open('timeline.js').read(); dur=float(re.search(r'"dur": ([\d.]+)',tl).group(1))
t=open('player_template.html').read()
t=(t.replace('__AUDIO__',base64.b64encode(open('soundtrack.mp3','rb').read()).decode())
    .replace('__TIMELINE__',tl).replace('__FILM__',open('film2.js').read())
    .replace('__DURS__','%d:%02d'%(int(dur)//60,int(dur)%60)).replace('__DUR__',str(dur)))
open('notebook_cartoon.html','w').write(t); print(len(t), dur)
