import json, urllib.request, urllib.parse, time, sys
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36"
def q(term):
    url="https://agelectronica.com/ajax/preBuscador/ajax.buscar_productos.php?q="+urllib.parse.quote(term)
    r=urllib.request.Request(url, headers={"User-Agent":UA,"X-Requested-With":"XMLHttpRequest"})
    try:
        with urllib.request.urlopen(r, timeout=45) as f:
            return json.loads(f.read().decode('utf-8','ignore'))
    except Exception as e:
        return [{"nombre":"ERR","num_parte":str(e)[:40],"descripcion":"","precio":""}]

GRUPOS = {
 "REFERENCIA (calibrar IVA)": ["LRS-1200-48","1N4744A"],
 "MOSFET potencia": ["FDH055N15A","IRFP4568","IRFP4668","IRFP4227","IRFP064N","IRFB4310","IRFB4110",
    "IRFB4115","IRFP260N","IRFP250N","IRFP90N20D","IRFP4768","FDP047N10","STP75NF75","IRFP2907",
    "IRFB3077","IRF3205","IRFP440","IRFPS","IRFP","IRFB","IXFH","IXTQ","AUIRF"],
 "GATE DRIVER": ["UCC27614","UCC27517","UCC27511","UCC27524","MCP1407","TC4420","TC4422","TC4452",
    "TC4427","IX4428","IR4427","MIC4429","FAN3100","IR2110","IR2112","IR2184","TLP250","HCPL3120"],
 "SCHOTTKY/ULTRAFAST": ["MBR20100","MBR30100","MBR40100","MBR60100","MBR2045","SBL2040","STPS30100",
    "STPS41H100","30CPQ100","60CPQ150","60F30","MUR1560","MUR3060","RHRP1560","MUR860","HFA30","MBR"],
 "TVS/ZENER": ["1.5KE100","1.5KE91","1.5KE82","1.5KE75","1.5KE68","1.5KE","5KP","SMCJ","1N4744"],
 "SENSOR HALL": ["ACS758","ACS712","ACS724","ACS772","ACS770"],
 "EXTRAS": ["MOC3021","DISIPADOR TO-247","MICA TO-247","XT60","XT90","PICO 2","RP2350"],
}
for g,terms in GRUPOS.items():
    print("\n" + "="*100); print("###", g); print("="*100)
    for t in terms:
        res=q(t); time.sleep(0.35)
        if not res: print(f"  [{t:16s}] (sin resultados)"); continue
        for it in res[:6]:
            n=it.get('nombre','')[:26]; d=it.get('descripcion','')[:62]; p=it.get('precio','')
            print(f"  [{t:16s}] {n:26s} ${p:>8s}  {d}")
