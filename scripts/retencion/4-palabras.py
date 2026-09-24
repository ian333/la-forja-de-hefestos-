import sys,os,json
from faster_whisper import WhisperModel
m=WhisperModel('large-v3',device='cuda',compute_type='float16')
src=sys.argv[1]; out=json.load(open(sys.argv[2])) if os.path.exists(sys.argv[2]) else {}
for f in sorted(os.listdir(src)):
    vid=f.rsplit('.',1)[0]
    if vid in out: continue
    segs,_=m.transcribe(os.path.join(src,f),language='es',word_timestamps=True,vad_filter=False)
    out[vid]=[(w.start,w.end,w.word.strip()) for s in segs for w in (s.words or [])]
    print(vid,len(out[vid]),flush=True)
    json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False)
