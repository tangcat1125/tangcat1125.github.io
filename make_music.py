import math,wave,struct
from pathlib import Path
out=Path(__file__).parent/'music.wav'; rate=44100; bpm=116; beat=60/bpm
notes={'C5':523.25,'D5':587.33,'E5':659.25,'G5':783.99,'A5':880,'C6':1046.5}
melody=['C5','E5','G5','E5','D5','G5','A5','G5','E5','G5','C6','G5','A5','G5','E5','D5']; data=[]
for i in range(int(16*rate)):
 t=i/rate; b=t/beat; f=notes[melody[int(b*2)%len(melody)]]; ph=(t%(beat/2))/(beat/2); env=min(1,ph*12)*max(0,1-ph*.9); s=.15*math.sin(2*math.pi*f*t)*env
 if b%1<.025:s+=.12*math.sin(2*math.pi*110*t)*max(0,1-(b%1)*40)
 data.append(struct.pack('<h',int(max(-1,min(1,s))*32767)))
with wave.open(str(out),'w') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(b''.join(data))
