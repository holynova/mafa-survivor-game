"""Import a pinned, attributed subset of mir2x_res without altering original pixels.
Run with a Python environment containing Pillow. Assets are local evaluation only.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json, urllib.request, hashlib, time, io, math
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.cache'; CACHE.mkdir(exist_ok=True)
OUT=ROOT/'public/assets/mir'; OUT.mkdir(parents=True,exist_ok=True)
REF='9e21ea6631317d06e064fbfa7e1ea43af6a2d3e6'
REPO='https://github.com/etorth/mir2x_res'
def request(url):
 for attempt in range(4):
  try:return urllib.request.urlopen(url,timeout=40).read()
  except Exception:
   if attempt==3:raise
   time.sleep(attempt+1)
def tree(kind):
 p=CACHE/(kind+'.json')
 if not p.exists():
  root=json.loads(request(f'https://api.github.com/repos/etorth/mir2x_res/contents/texture?ref={REF}'))
  sha=next(x['sha'] for x in root if x['name']==kind)
  p.write_bytes(request('https://api.github.com/repos/etorth/mir2x_res/git/trees/'+sha))
 d=json.loads(p.read_text());assert not d.get('truncated');return d['tree']
selected=[];animations={};origins={}
def select(kind,entry,key):selected.append((kind,entry,key));return key
def actor(kind,name,look,motions):
 entries=tree(kind)
 for motion,motionID in motions.items():
  for direction in range(8):
   seq=[]
   for p in entries:
    code=int(p['path'][:8],16)
    match=(code>>12==look) if kind=='monster' else (code>>14==look)
    if match and (code>>8)&(15 if kind=='monster' else 63)==motionID and (code>>5)&7==direction:
     key=f'{name}/{motion}/{direction}/{code&31}'
     select(kind,p,key);seq.append((code&31,key))
   if seq:animations[f'{name}/{motion}/{direction}']=[k for _,k in sorted(seq)]
actor('hero','wizard',(1<<8)|4,{'idle':0,'walk':21,'cast':3,'hurt':15,'death':19})
# IDs are verified against mir2x/common/src/monsterrecord.inc.
for name,look in [('scarecrow',0x28),('cat',0x26),('rakecat',0x27),('orc',0x16),('boss',0x24)]:
 actor('monster',name,look,{'idle':0,'walk':1,'attack':2,'hurt':3,'death':4})
magic={int(p['path'][:8],16):p for p in tree('magic')}
for name,start,count in [('lightning',0x5AA,5),('firewall',0x398,5),('shield',0x352,3)]:
 animations[name]=[select('magic',magic[start+i],f'{name}/{i}') for i in range(count)]
for d in range(16):
 animations[f'fireball/{d}']=[select('magic',magic[0x1A4+d*10+i],f'fireball/{d}/{i}') for i in range(5)]
# Ground PNGs selected from the original map texture catalogue, not recreated.
mp=json.loads((CACHE/'map-list.json').read_text()) if (CACHE/'map-list.json').exists() else json.loads(request(f'https://api.github.com/repos/etorth/mir2x_res/contents/texture/map?ref={REF}'))
for i in [3,10,17,24,31,38,45,52,59,66,100,150,200,250,300,400,500,600,700,800,900]:
 p=mp[i];select('map',{'path':p['name'],'sha':p['sha']},'ground/'+str(i))
# Item IDs verified against the source itemrecord, never guessed from sprite appearance.
source=(ROOT/'tools/itemrecord-source.inc').read_text()
import re
itemmap={}
for block in re.split(r'(?=\{   \.name = u8")',source):
 n=re.search(r'\.name = u8"([^"]+)"',block);g=re.search(r'\.pkgGfxID = (0X[0-9A-F]+)',block)
 if n and g:itemmap[n[1]]=int(g[1],16)
items={int(p['path'][:8],16):p for p in tree('item')}
names=['海魂','偃月','魔杖','骨玉权杖','乌木剑','布衣（男）','魔法长袍（男）','恶魔长袍（男）','魔法头盔','青铜头盔','玻璃戒指','六角戒指','金项链','白金项链','铁手镯','黑檀手镯','骷髅头盔','蛇眼戒指','魅力戒指','紫碧螺','思贝儿手镯','放大镜','生命项链']
for n in names:
 if n in itemmap and itemmap[n] in items:select('item',items[itemmap[n]],'item/'+n)
# Gold is a normal, source-backed item icon.
for n in ['金币','金创药（小）','魔法药（小）']:
 if n in itemmap and itemmap[n] in items:select('item',items[itemmap[n]],'item/'+n)
print('Downloading',len(selected),'original frames',flush=True)
def load(t):
 kind,p,key=t;f=CACHE/'raw'/kind/p['path'];f.parent.mkdir(parents=True,exist_ok=True)
 if not f.exists():f.write_bytes(request(f'https://raw.githubusercontent.com/etorth/mir2x_res/{REF}/texture/{kind}/{p["path"]}'))
 b=f.read_bytes();actual=hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
 if actual!=p['sha']:raise ValueError('Git blob hash mismatch: '+key)
 im=Image.open(io.BytesIO(b)).convert('RGBA');fn=p['path'];dx=dy=0
 if len(fn.split('.')[0])==18:
  dx=int(fn[10:14],16)*(1 if fn[8]!='0' else -1);dy=int(fn[14:18],16)*(1 if fn[9]!='0' else -1)
 return key,im,{'sourcePath':f'texture/{kind}/{fn}','sha1':actual,'sha256':hashlib.sha256(b).hexdigest(),'dx':dx,'dy':dy,'width':im.width,'height':im.height}
with ThreadPoolExecutor(max_workers=16) as ex:loaded=list(ex.map(load,selected))
# Shelf pack; preserve source pixel data, dimensions and per-frame offsets.
frames={};meta={};x=y=rowH=0;atlas=Image.new('RGBA',(2048,8192))
for key,im,info in loaded:
 if x+im.width+2>2048:x=0;y+=rowH+2;rowH=0
 atlas.paste(im,(x,y));frames[key]={'frame':{'x':x,'y':y,'w':im.width,'h':im.height},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':im.width,'h':im.height},'sourceSize':{'w':im.width,'h':im.height}}
 meta[key]=info;x+=im.width+2;rowH=max(rowH,im.height)
atlas=atlas.crop((0,0,2048,y+rowH+2));atlas.save(OUT/'atlas.png')
(OUT/'atlas.json').write_text(json.dumps({'frames':frames,'meta':{'image':'atlas.png','size':{'w':atlas.width,'h':atlas.height},'scale':'1'}}))
manifest={'schemaVersion':1,'repository':REPO,'ref':REF,'referenceVersion':'mir2x 1.45 reference; gameplay 1.76 candidate','rightsStatus':'UNVERIFIED_THIRD_PARTY_ART','distribution':'LOCAL_EVALUATION_ONLY','releaseStatus':'BLOCKED_BY_ASSET_RIGHTS','animations':animations,'frames':meta}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
(ROOT/'docs/asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('Packed',len(frames),'frames, atlas',atlas.size,flush=True)
