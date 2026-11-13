"""Generate a warm, upbeat background track (68 s by default) as music.wav. No samples, pure synthesis."""
import numpy as np, wave, sys

SR = 44100
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 68.0
BPM = 100
BEAT = 60 / BPM
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def midi(m): return 440 * 2 ** ((m - 69) / 12)

def add(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= N: return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * (1 - pan) / 2 * 2 ** .5
    R[i:i + len(sig)] += sig * (1 + pan) / 2 * 2 ** .5

def kalimba(f, dur=1.2):
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-t * 4.5) * (1 - np.exp(-t * 400))
    return env * (np.sin(2*np.pi*f*t) + .28*np.sin(2*np.pi*f*3.01*t)*np.exp(-t*9) + .12*np.sin(2*np.pi*f*5.4*t)*np.exp(-t*20))

def bell(f, dur=1.6):
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-t * 3) * (1 - np.exp(-t * 600))
    return env * (np.sin(2*np.pi*f*t) + .4*np.sin(2*np.pi*f*2.0*t)*np.exp(-t*5) + .2*np.sin(2*np.pi*f*4.07*t)*np.exp(-t*10))

def bass(f, dur):
    t = np.arange(int(SR * dur)) / SR
    env = np.minimum(1, t * 60) * np.exp(-t * 1.6)
    return env * (np.sin(2*np.pi*f*t) + .25*np.sin(2*np.pi*f*2*t))

def pad(freqs, dur):
    t = np.arange(int(SR * dur)) / SR
    env = np.minimum(1, t / .6) * np.minimum(1, (dur - t) / .6)
    s = sum(np.sin(2*np.pi*f*t + k) + .3*np.sin(2*np.pi*f*1.003*t) for k, f in enumerate(freqs))
    return env * s / len(freqs)

def shaker(dur=.09):
    n = rng.standard_normal(int(SR * dur))
    n = np.diff(n, prepend=0)  # crude high-pass
    t = np.arange(len(n)) / SR
    return n * np.exp(-t * 60)

def kick():
    t = np.arange(int(SR * .25)) / SR
    f = 120 * np.exp(-t * 25) + 45
    return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 14)

# C – G – Am – F   (roots as MIDI)
CH = [(48, [60, 64, 67]), (43, [59, 62, 67]), (45, [57, 60, 64]), (41, [57, 60, 65])]
ARP = [0, 1, 2, 1, 3, 1, 2, 1]  # index into chord+octave
MEL = [[76, None, 74, 72, None, 74, 76, None], [74, None, 71, None, 74, 76, 74, None],
       [72, None, 76, None, 79, 76, 72, None], [72, 74, 72, None, 69, None, 72, None]]

bar = 4 * BEAT
nbars = int(np.ceil(DUR / bar))
for b in range(nbars):
    t0 = b * bar
    root, ch = CH[b % 4]
    notes = ch + [ch[0] + 12]
    final = t0 >= DUR - 3.6
    if final:  # sustained ending chord
        if b == nbars - 1 or t0 < DUR:
            add(pad([midi(n) for n in [60, 64, 67, 72]], DUR - t0), t0, 0, .10)
            add(bass(midi(48), 3.5), t0, 0, .35)
            for k, n in enumerate([60, 64, 67, 72, 76]):
                add(bell(midi(n), 3.0), t0 + k * .09, (k - 2) * .25, .16)
        break
    add(pad([midi(n) for n in ch], bar + .4), t0, 0, .07)
    for i in range(8):  # eighth-note arpeggio
        add(kalimba(midi(notes[ARP[i]] + 12)), t0 + i * BEAT / 2, .35 * (1 if i % 2 else -1), .17 if b else .12)
    add(bass(midi(root), bar * .5), t0, 0, .32)
    add(bass(midi(root), bar * .5), t0 + bar * .5, 0, .26)
    if b >= 1:
        for i in range(8):
            add(shaker(), t0 + i * BEAT / 2 + (BEAT / 4 if i % 2 else 0), .5, .05 if i % 2 else .03)
    if b >= 2:
        for i in range(4):
            add(kick(), t0 + i * BEAT, 0, .22 if i % 2 == 0 else .14)
    if b >= 4:  # melody joins
        for i, m in enumerate(MEL[b % 4]):
            if m: add(bell(midi(m)), t0 + i * BEAT / 2, -.15, .14)

mix = np.stack([L, R], 1)
# gentle fades
fi = int(SR * .8); mix[:fi] *= np.linspace(0, 1, fi)[:, None]
fo = int(SR * 2.5); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.2) * .82
pcm = (mix * 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', DUR)
