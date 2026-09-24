import os,sys,json
sys.path.insert(0,'/home/ian/Orkesta/la-forja/scripts')
from pub_comun import CONF
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
c=Credentials.from_authorized_user_file(os.path.join(CONF,'youtube-token.json'))
yt=build('youtube','v3',credentials=c); ya=build('youtubeAnalytics','v2',credentials=c)
ch=yt.channels().list(part='contentDetails',mine=True).execute()['items'][0]
up=ch['contentDetails']['relatedPlaylists']['uploads']
ids=[];tok=None
while True:
    r=yt.playlistItems().list(part='contentDetails',playlistId=up,maxResults=50,pageToken=tok).execute()
    ids+= [x['contentDetails']['videoId'] for x in r['items']]; tok=r.get('nextPageToken')
    if not tok: break
out={}
for i in range(0,len(ids),50):
    r=yt.videos().list(part='snippet,statistics,contentDetails,status',id=','.join(ids[i:i+50])).execute()
    for v in r['items']:
        out[v['id']]={'titulo':v['snippet']['title'],'publicado':v['snippet']['publishedAt'],'dur':v['contentDetails']['duration'],
          'estado':v['status']['privacyStatus'],'vistas':int(v['statistics'].get('viewCount',0)),'likes':int(v['statistics'].get('likeCount',0))}
con=0
for vid,d in out.items():
    if d['estado']!='public' or d['vistas']<30: continue
    try:
        r=ya.reports().query(ids='channel==MINE',startDate='2025-01-01',endDate='2026-09-23',metrics='audienceWatchRatio,relativeRetentionPerformance',dimensions='elapsedVideoTimeRatio',filters=f'video=={vid}').execute()
        d['curva']=r.get('rows',[])
        b=ya.reports().query(ids='channel==MINE',startDate='2025-01-01',endDate='2026-09-23',metrics='views,averageViewDuration,averageViewPercentage,shares,subscribersGained,likes,comments',filters=f'video=={vid}').execute()
        if b.get('rows'): d['analytics']=dict(zip([h['name'] for h in b['columnHeaders']],b['rows'][0]))
        if d['curva']: con+=1
    except Exception as e: d['err']=str(e)[:120]
json.dump(out,open(sys.argv[1] if len(sys.argv)>1 else '/tmp/yt-curvas.json','w'),ensure_ascii=False)
print('videos',len(ids),'publicos>=30 vistas con curva',con)
