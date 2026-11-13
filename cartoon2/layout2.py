# Раскладка монтажа по длительности фраз диктора + сведение звука (музыка, шумы, голос).
import json, wave, numpy as np, subprocess
SR=44100
lines=[l.strip() for l in open('vo/lines.txt',encoding='utf-8') if l.strip()]
def wav(p):
    w=wave.open(p); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float64)/32768; return x
VO=[wav(f'vo/v{i}.wav') for i in range(1,13)]
D=[len(v)/SR for v in VO]
X=0.5  # перекрытие сцен (кроссфейд)
# сцена: id, src (время исходной сцены в film.js, None = своя локальная), паузы/реплики
plan=[
 ('hook',None,[(0.6,0),(0.6,1)],2.4),
 ('problem',None,[(0.5,2),(0.35,3),(0.35,4)],0.9),
 ('s1',0.6,[(0.3,5)],1.3),
 ('cls',None,[(0.4,6),(0.4,7)],0.9),
 ('tutor',None,[(0.3,8)],1.3),
 ('garage',None,[(0.3,9)],2.0),
 ('test',None,[(0.3,10)],None),
 ('s7',54.1,[(2.2,11)],2.4),
]
t=0; scenes=[]; vo=[]
for sid,src,items,tail in plan:
    a=t; u=a
    for gap,li in items:
        u+=gap; vo.append({'t':round(u,3),'d':round(D[li],3),'i':li,'text':lines[li]}); u+=D[li]
    if tail is None: tail=max(1.2,7.0-(u-a))
    b=u+tail
    scenes.append({'id':sid,'a':round(a,3),'b':round(b,3),'src':src,'L':[round(v['t']-a,3) for v in vo if a<=v['t']<b]})
    t=b-X
DUR=round(scenes[-1]['b'],3)
def g(sid,srcT):
    s=next(s for s in scenes if s['id']==sid); return round(s['a']+(srcT-s['src']),3)
S={s['id']:s for s in scenes}
s7=scenes[-1]; t13=vo[-1]['t']
title=[round(s7['src']+(t13+o-s7['a']),3) for o in (0.0,1.79,3.85)]
TL={'dur':DUR,'scenes':[{k:v for k,v in s_.items() if k!='L'} for s_ in scenes],'subs':[[v['t']-0.1,v['t']+v['d']+0.35,v['text']] for v in vo],
    'L':{s_['id']:s_['L'] for s_ in scenes},'sceneDur':{s_['id']:round(s_['b']-s_['a'],3) for s_ in scenes},
    'title':title,'titleText':'Из тетради — в реальность','turnSat':[S['s1']['a'],S['s1']['a']+1.8],
    'steps':[S['cls']['a']+2.6,S['tutor']['a']+0.9,S['garage']['b']-1.9,S['test']['a']+4.2],'stepsShow':[S['cls']['a']+0.3,S['s7']['a']+2.0]}
open('timeline.js','w').write('window.TIMELINE='+json.dumps(TL,ensure_ascii=False)+';\n')
print(json.dumps({'dur':DUR,'scenes':[(s['id'],s['a'],s['b']) for s in scenes],'title':title,'steps':TL['steps']},ensure_ascii=False))

# ---------- звук ----------
N=int(SR*(DUR+0.2)); L=np.zeros(N); R=np.zeros(N); rng=np.random.default_rng(5)
def mtof(m): return 440*2**((m-69)/12)
def add(sig,t0,pan=0.0,gain=1.0,buf=None):
    i=int(t0*SR); j=min(N,i+len(sig))
    if i>=N or j<=0: return
    s=sig[:j-i]*gain; L[i:j]+=s*(1-pan); R[i:j]+=s*(1+pan)
def env(n,a,d): tt=np.arange(n)/SR; return np.minimum(1,tt/a)*np.exp(-tt/d)
def piano(m,dur=1.6,vel=0.3):
    n=int(SR*dur); tt=np.arange(n)/SR; f=mtof(m)
    return (np.sin(2*np.pi*f*tt)+0.45*np.sin(4*np.pi*f*tt)*np.exp(-tt*3)+0.2*np.sin(6*np.pi*f*tt)*np.exp(-tt*5))*env(n,0.004,0.55)*vel
def pluck(m,dur=0.6,vel=0.2):
    n=int(SR*dur); tt=np.arange(n)/SR; f=mtof(m)
    return (np.sign(np.sin(2*np.pi*f*tt))*0.3+np.sin(2*np.pi*f*tt))*env(n,0.002,0.18)*vel
def pad(ms,dur,vel=0.08):
    n=int(SR*dur); tt=np.arange(n)/SR; s=np.zeros(n)
    for m in ms:
        for dt in (-0.12,0.12): s+=np.sin(2*np.pi*mtof(m)*(1+dt/100)*tt)
    a=np.minimum(1,tt/0.6)*np.minimum(1,np.maximum(0,(dur-tt))/0.6); return s*a*vel/len(ms)
def bass(m,dur=0.55,vel=0.3):
    n=int(SR*dur); tt=np.arange(n)/SR; f=mtof(m); return (np.sin(2*np.pi*f*tt)+0.3*np.sin(4*np.pi*f*tt))*env(n,0.005,0.25)*vel
def kick(vel=0.45):
    n=int(SR*0.3); tt=np.arange(n)/SR; f=50+90*np.exp(-tt*30); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*12)*vel
def shaker(vel=0.05): n=int(SR*0.08); return rng.standard_normal(n)*np.exp(-np.arange(n)/SR*60)*vel
def tick(vel=0.12):
    n=int(SR*0.05); tt=np.arange(n)/SR; return (rng.standard_normal(n)*0.5+np.sin(2*np.pi*2500*tt))*np.exp(-tt*120)*vel
def chime(m,vel=0.26):
    n=int(SR*1.8); tt=np.arange(n)/SR; f=mtof(m)
    return (np.sin(2*np.pi*f*tt)+0.5*np.sin(2*np.pi*f*2.76*tt)*np.exp(-tt*4)+0.3*np.sin(2*np.pi*f*5.4*tt)*np.exp(-tt*8))*env(n,0.002,0.6)*vel
def bell(vel=0.12):
    n=int(SR*1.6); tt=np.arange(n)/SR; s=np.zeros(n)
    for k,f in enumerate((1250,1630,2100)): s+=np.sin(2*np.pi*f*tt)*(1+0.5*np.sign(np.sin(2*np.pi*28*tt)))/(k+1)
    return s*np.minimum(1,tt/0.01)*np.minimum(1,(1.6-tt)/0.3)*vel
# 1) крючок: тикание и тёмный пэд
h=S['hook']; add(pad([45,52,57],h['b']-h['a']+0.4,0.10),h['a'])
for k in np.arange(h['a']+0.3,h['b'],0.5): add(tick(0.10),k,0.3)
# 2) проблема: минор, тикание часов, звонок
p=S['problem']; beat=0.6
TL['bells']=[]
for k,ch in enumerate([[45,48,52],[41,45,48],[43,47,50],[40,43,47]]*3):
    tt=p['a']+k*4*beat
    if tt>p['b']: break
    add(pad([m+12 for m in ch],4*beat+0.6,0.07),tt)
    add(piano(ch[0]+12,1.6,0.10),tt,-0.2)
for k in np.arange(p['a']+0.2,p['b'],beat): add(tick(0.08),k,0.3)
for bt in TL['bells']: add(bell(0.10),bt,0.0)
# 3) поворот и решение: тема «Карты», нарастание
BPM=100; bt=60/BPM; bar=4*bt
prog=[(48,[60,64,67]),(45,[57,60,64]),(41,[57,60,65]),(43,[55,59,62])]
theme=[72,74,76,79]
t0=S['s1']['a']; tend=S['s7']['a']+2.0; k=0; t=t0
while t<tend:
    root,ch=prog[k%4]; full = t>=S['cls']['a']
    add(pad([m+12 for m in ch]+[root+12],bar+0.6,0.07),t)
    for q in range(4):
        tb=t+q*bt
        if not full: add(piano(ch[q%3]+12,1.6,0.18),tb,-0.2)
        else:
            for e in range(2): add(pluck(ch[(q*2+e)%3]+12,0.55,0.15),tb+e*bt/2,0.25)
            if q in (0,2): add(bass(root),tb); add(kick(),tb)
            add(shaker(),tb+bt/2,0.4)
    if k%2==0:
        for i,m in enumerate(theme): add(piano(m,1.3,0.15),t+i*bt*0.5,-0.1)
    t+=bar; k+=1
# финал
ts=S['s7']['a']+2.0
add(pad([48,55,60,64,67,72],DUR-ts+0.2,0.20),ts)
for i,m in enumerate([60,64,67,72,76]): add(piano(m,3.5,0.18),ts+i*0.12)
for i,m in enumerate(theme): add(piano(m,2.0,0.14),DUR-3.0+i*0.33)
for i in range(5): add(chime(84+[0,4,7,12,16][i],0.10),S['s7']['a']+0.6+i*0.4,0.2)
for st in TL['steps']: add(chime(86,0.24),st,0.3); add(chime(93,0.12),st+0.06,0.3)
def noise(dur,lp):
    n=int(SR*dur); nz=rng.standard_normal(n); y=np.zeros(n); acc=0; a_=np.exp(-1/(SR*lp))
    for i in range(n): acc=a_*acc+(1-a_)*nz[i]; y[i]=acc
    return y
h=S['hook']; sc=noise(2.6,0.00008)
mod=(0.5+0.5*np.sign(np.sin(2*np.pi*7*np.arange(len(sc))/SR)))
add(sc*mod*0.35,h['a']+0.4+0.0,0.2)
add(sc[:int(SR*1.2)]*0.3,h['a']+3.0,0.2)
gg=S['garage']
for k in np.arange(gg['a']+0.4,gg['b']-1.4,0.31): add(tick(0.16),k,-0.2); add(tick(0.10),k+0.08,-0.2)
tt_=S['test']
def engine(dur,f0,f1,vel):
    n=int(SR*dur); x=np.arange(n)/SR; f=np.linspace(f0,f1,n); ph=np.cumsum(f)/SR
    s_=(2*(ph%1)-1)*0.6+np.sin(2*np.pi*ph*0.5)*0.4; return s_*np.minimum(1,x/0.1)*np.minimum(1,(dur-x)/0.2)*vel
add(engine(2.0,55,75,0.10),tt_['a']+0.0,-0.3)
n=int(SR*0.6); x=np.arange(n)/SR; add(np.sin(2*np.pi*np.cumsum(300+500*np.exp(-x*8)*np.abs(np.sin(x*40)))/SR)*np.exp(-x*5)*0.12,tt_['a']+1.9,0.3)
add(engine(3.2,60,110,0.12),tt_['a']+3.3,0.0)
n=int(SR*2.0); ap=np.zeros(n)
for _ in range(180):
    q=int(rng.uniform(0,n-2000)); ap[q:q+600]+=rng.standard_normal(600)*np.exp(-np.arange(600)/80)
add(ap*np.minimum(1,np.arange(n)/(SR*0.2))*np.minimum(1,(n-np.arange(n))/(SR*0.5))*0.11,tt_['a']+4.2)
# приглушение музыки под голосом
duck=np.ones(N)
for v in vo:
    i0=int((v['t']-0.15)*SR); i1=int((v['t']+v['d']+0.15)*SR); duck[max(0,i0):min(N,i1)]=0.42
k_=int(SR*0.12); duck=np.convolve(duck,np.ones(k_)/k_,mode='same')
L*=duck; R*=duck
m=max(np.abs(L).max(),np.abs(R).max()); L*=0.55/m; R*=0.55/m
for v in vo:
    s=VO[v['i']]; i=int(v['t']*SR); j=min(N,i+len(s)); L[i:j]+=s[:j-i]*0.95; R[i:j]+=s[:j-i]*0.95
fade=np.ones(N); fi=int((DUR-1.2)*SR); fade[fi:]=np.linspace(1,0,N-fi); fade[:int(0.4*SR)]=np.linspace(0,1,int(0.4*SR))
L*=fade; R*=fade
m=max(np.abs(L).max(),np.abs(R).max()); L*=0.95/m; R*=0.95/m
out=(np.stack([L,R],1)*32767).astype(np.int16)
w=wave.open('soundtrack.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
subprocess.run(['ffmpeg','-v','error','-y','-i','soundtrack.wav','-b:a','128k','soundtrack.mp3'])
print('audio ok')
