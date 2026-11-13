# Синтез саундтрека: тема «Карты», звуки пинов, всплеск, карканье, аплодисменты.
import numpy as np, wave
SR=44100; DUR=60.0; N=int(SR*DUR)
L=np.zeros(N); R=np.zeros(N)
rng=np.random.default_rng(5)
def mtof(m): return 440*2**((m-69)/12)
def add(sig,t0,pan=0.0,gain=1.0):
    i=int(t0*SR); j=min(N,i+len(sig))
    if i>=N or j<=0: return
    s=sig[:j-i]*gain
    L[i:j]+=s*(1-pan)*0.5*2**0.5; R[i:j]+=s*(1+pan)*0.5*2**0.5
def env(n,a,d):
    t=np.arange(n)/SR; e=np.minimum(1,t/a)*np.exp(-t/d); return e
def piano(m,dur=1.6,vel=0.3):
    n=int(SR*dur); t=np.arange(n)/SR; f=mtof(m)
    s=np.sin(2*np.pi*f*t)+0.45*np.sin(4*np.pi*f*t)*np.exp(-t*3)+0.2*np.sin(6*np.pi*f*t)*np.exp(-t*5)
    return s*env(n,0.004,0.55)*vel
def pluck(m,dur=0.7,vel=0.25):
    n=int(SR*dur); t=np.arange(n)/SR; f=mtof(m)
    s=np.sign(np.sin(2*np.pi*f*t))*0.3+np.sin(2*np.pi*f*t)
    return s*env(n,0.002,0.18)*vel
def pad(ms,dur,vel=0.08):
    n=int(SR*dur); t=np.arange(n)/SR; s=np.zeros(n)
    for m in ms:
        f=mtof(m)
        for dt in (-0.12,0.12): s+=np.sin(2*np.pi*f*(1+dt/100)*t)
    a=np.minimum(1,t/0.8)*np.minimum(1,(dur-t)/0.8)
    return s*a*vel/len(ms)
def bass(m,dur=0.55,vel=0.35):
    n=int(SR*dur); t=np.arange(n)/SR; f=mtof(m)
    return (np.sin(2*np.pi*f*t)+0.3*np.sin(4*np.pi*f*t))*env(n,0.005,0.25)*vel
def kick(vel=0.5):
    n=int(SR*0.3); t=np.arange(n)/SR; f=50+90*np.exp(-t*30)
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*12)*vel
def shaker(vel=0.06):
    n=int(SR*0.08); return rng.standard_normal(n)*np.exp(-np.arange(n)/SR*60)*vel
def chime(m,vel=0.28):
    n=int(SR*1.8); t=np.arange(n)/SR; f=mtof(m)
    s=np.sin(2*np.pi*f*t)+0.5*np.sin(2*np.pi*f*2.76*t)*np.exp(-t*4)+0.3*np.sin(2*np.pi*f*5.4*t)*np.exp(-t*8)
    return s*env(n,0.002,0.6)*vel
def noise_burst(dur,lp,vel):
    n=int(SR*dur); x=rng.standard_normal(n)
    a=np.exp(-1/(SR*lp)) if lp>0 else 0
    y=np.zeros(n); acc=0
    for i in range(n): acc=a*acc+(1-a)*x[i]; y[i]=acc
    return y*vel
BPM=96; beat=60/BPM; bar=4*beat
prog=[(48,[60,64,67]),(45,[57,60,64]),(41,[57,60,65]),(43,[55,59,62])]  # C Am F G
theme=[72,74,76,79]
t=0.0; b=0
while t<56.0:
    root,ch=prog[b%4]
    energy = 0 if t<16.6 else (2 if 26.8<=t<46 else 1)
    if t>=46: energy=1
    add(pad([m+12 for m in ch]+[root+12],bar+0.9,0.09 if energy<2 else 0.07),t,0,1)
    for k in range(4):
        tb=t+k*beat
        if energy==0:
            add(piano(ch[k%3]+12,1.8,0.22),tb,-0.2)
        else:
            for e in range(2):
                add(pluck(ch[(k*2+e)%3]+12,0.6,0.16 if energy==1 else 0.19),tb+e*beat/2,0.25)
            if k in (0,2): add(bass(root,0.6,0.32),tb)
        if energy==2:
            if k in (0,2): add(kick(0.45),tb)
            add(shaker(0.05),tb+beat/2,0.4); add(shaker(0.03),tb,0.4)
    if b%2==0 and t>=0.5:
        for i,m in enumerate(theme): add(piano(m,1.4,0.16 if energy<2 else 0.2),t+i*beat*0.5,-0.1)
    t+=bar; b+=1
# underwater dip
i0,i1=int(39.85*SR),int(41.2*SR)
for ch_ in (L,R):
    seg_=ch_[i0:i1].copy(); k=np.exp(-1/(SR*0.004)); y=np.zeros_like(seg_); acc=0
    for i in range(len(seg_)): acc=k*acc+(1-k)*seg_[i]; y[i]=acc
    ch_[i0:i1]=y*0.6
# finale chord
add(pad([48,55,60,64,67,72],5.5,0.22),56.2)
for i,m in enumerate([60,64,67,72,76]): add(piano(m,3.5,0.2),56.3+i*0.12)
for i,m in enumerate(theme): add(piano(m,2.0,0.18),57.9+i*0.33)
# SFX
for tt,m in [(16.0,84),(23.0,86),(34.6,88),(44.6,89),(50.4,91)]:
    add(chime(m),tt,0.3); add(chime(m+7,0.14),tt+0.06,0.3)
for i in range(8): add(chime(84+[0,2,4,7,9,12,14,16][i],0.12),53.0+i*0.32,0.2)
def caw(t0):
    n=int(SR*0.35); tt=np.arange(n)/SR; f=520+80*np.sin(2*np.pi*25*tt)
    s=np.sign(np.sin(2*np.pi*np.cumsum(f)/SR))*(0.6+0.4*rng.standard_normal(n)*0.3)
    add(s*np.minimum(1,tt/0.02)*np.exp(-tt*6)*0.12,t0,0.6)
caw(14.35); caw(14.7); caw(48.7)
add(noise_burst(0.9,0.0006,0.5)*np.exp(-np.arange(int(SR*0.9))/SR*4),39.9,0.1)
# applause
n=int(SR*1.6); ap=np.zeros(n)
for k in range(140):
    p=int(rng.uniform(0,n-2000)); c=rng.standard_normal(600)*np.exp(-np.arange(600)/80)
    ap[p:p+600]+=c
ap*=np.minimum(1,np.arange(n)/(SR*0.2))*np.minimum(1,(n-np.arange(n))/(SR*0.5))*0.12
add(ap,34.7,0.0)
# 8-bit fall
n=int(SR*0.8); tt=np.arange(n)/SR; f=900*np.exp(-tt*3)
add(np.sign(np.sin(2*np.pi*np.cumsum(f)/SR))*0.07*np.exp(-tt*1.5),29.6,-0.3)
# fade
fade=np.ones(N); fi=int(59.0*SR); fade[fi:]=np.linspace(1,0,N-fi)
fade[:int(0.6*SR)]=np.linspace(0,1,int(0.6*SR))
L*=fade; R*=fade
m=max(np.abs(L).max(),np.abs(R).max()); L/=m/0.85; R/=m/0.85
out=np.stack([L,R],1); out=(out*32767).astype(np.int16)
w=wave.open('music.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
print('ok')
