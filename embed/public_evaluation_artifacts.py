#!/usr/bin/env python3
"""Export grouped uncertainty, charts, diagnostic images and tabular annexes."""
import collections
import csv
import io
import json
from pathlib import Path
import sys
import zipfile
import numpy as np
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from sklearn.metrics import average_precision_score
from evaluate_public_cosine import ROOT,EXP,OUT,dump

REPORT=OUT/'report';REPORT.mkdir(exist_ok=True);FIG=REPORT/'figures';FIG.mkdir(exist_ok=True)
font_manager.fontManager.addfont(str(OUT/'simhei.ttf'))
plt.rcParams.update({'font.family':'SimHei','axes.unicode_minus':False,'figure.dpi':130,'savefig.dpi':190,'axes.spines.top':False,'axes.spines.right':False,'font.size':10})
NAMES={'bdd100k_100k':'BDD100K 场景与对象','bdd100k_10k':'BDD10K 语义类别','cityscapes':'Cityscapes','mapillary_msls':'MSLS 属性探针','mapillary_mtsd':'MTSD 交通标志','mapillary_vistas':'Mapillary Vistas','omnicity_mono':'OmniCity 单视角','omnicity_panorama':'OmniCity 全景视角','omnicity_v2_svi':'OmniCity V2 跨视角关联'}
CN=dict(zip('road,sidewalk,building,wall,fence,pole,traffic light,traffic sign,vegetation,terrain,sky,person,rider,car,truck,bus,train,motorcycle,bicycle'.split(','),'道路,人行道,建筑,墙,围栏,杆,交通信号灯,交通标志,植被,地形,天空,行人,骑行者,汽车,卡车,公交车,火车,摩托车,自行车'.split(',')))
CN.update({'Building':'建筑','1: 1/2 Family Buildings':'独栋 / 双户住宅','2: Walk-Up Buildings':'无电梯公寓','3: Elevator Buildings':'电梯公寓','4: Mixed Residential/Commercial':'商住混合','5: Office Buildings':'办公建筑','6: Industrial/Transportation/Utility':'工业 / 交通 / 公用设施','7: Others':'其他用途','day':'白天','night':'夜间','Forward':'前向','Sideways':'侧向','Backward':'后向','control_panel':'仪表盘','clear':'晴朗','foggy':'雾天','overcast':'阴天','partly cloudy':'多云','rainy':'雨天','snowy':'雪天','dawn/dusk':'黎明 / 黄昏','daytime':'白天','city street':'城市街道','gas stations':'加油站','highway':'高速公路','parking lot':'停车场','residential':'居住区','tunnel':'隧道'})
def label(x):return CN.get(x,x.replace('construction--','').replace('object--','').replace('nature--','').replace('human--','').replace('marking--','').replace('--',' / '))
def save(name):plt.savefig(FIG/(name+'.png'),bbox_inches='tight',facecolor='white');plt.close()


def bootstrap(ds,result):
    z=np.load(OUT/'results'/f'{ds}_heldout.npz');y=z['y'];s=z['scores'];g=z['group']
    unit='source' if ds!='mapillary_msls' else 'capture_sequence'
    if ds.startswith('omnicity'):
        g=np.array([','.join(str(int(np.floor(float(v)/.002))) for v in x.split(',')[:2]) for x in g]);unit='0.002_degree_spatial_block'
    _,gi=np.unique(g,return_inverse=True);ng=int(gi.max())+1
    ix=[j for j,r in enumerate(result['classes']) if r.get('ap') is not None]
    cache=[]
    for j in ix:
        ids=np.flatnonzero(y[:,j]>=0);ids=ids[np.argsort(-s[ids,j],kind='stable')]
        end=np.r_[np.flatnonzero(np.diff(s[ids,j])!=0),len(ids)-1]
        cache.append((y[ids,j],gi[ids],end))
    rng=np.random.default_rng(20260926);values=[];omissions=0
    for b in range(200):
        weights=np.bincount(rng.integers(ng,size=ng),minlength=ng);aps=[]
        for yy,gg,end in cache:
            w=weights[gg];tp=np.cumsum(w*yy)[end];total=np.cumsum(w)[end]
            if not tp[-1] or tp[-1]==total[-1]:omissions+=1;continue
            aps.append(float(np.sum(np.diff(np.r_[0,tp])*np.divide(tp,total,out=np.zeros_like(tp,dtype=float),where=total>0))/tp[-1]))
        values.append(float(np.mean(aps)))
    out={'unit':unit,'groups':ng,'replicates':200,'seed':20260926,'percentile_95':np.percentile(values,[2.5,97.5]).tolist(),'missing_class_replicates':omissions,'method':'nonparametric cluster resampling; AP score ties grouped; degenerate class replicates omitted'}
    result['bootstrap']=out;return out


def plots(ds,r):
    rows=[x for x in r['classes'] if x.get('ap') is not None]
    ranked=sorted(rows,key=lambda x:x['ap'])
    selected=ranked if len(ranked)<=26 else ranked[:8]+ranked[-10:]
    fig,ax=plt.subplots(figsize=(10,max(4,len(selected)*.31)))
    yy=np.arange(len(selected));ax.barh(yy,[x['ap'] for x in selected],color='#197f88',label='AP')
    ax.scatter([x['prevalence'] for x in selected],yy,color='#ef993f',marker='|',s=110,label='类别出现率基线',zorder=3)
    ax.set_yticks(yy,[label(x['label'])[:64] for x in selected]);ax.set_xlim(0,1.07);ax.set_xlabel('AP / 正例比例');ax.set_title(NAMES[ds]+'：类别检索质量'+('（低 8 类 + 高 10 类）' if len(ranked)>26 else ''))
    for i,x in enumerate(selected):ax.text(x['ap']+.012,i,f"{x['ap']:.3f}",va='center',fontsize=8)
    ax.legend(loc='lower right');fig.tight_layout();save(ds+'_classes')
    cats=r['categorical']
    if cats:
        fig,axes=plt.subplots(1,len(cats),figsize=(max(7,5*len(cats)),5.3),squeeze=False)
        for ax,(kind,a) in zip(axes[0],cats.items()):
            c=np.array(a['confusion']);v=np.divide(c,c.sum(1,keepdims=True),out=np.zeros_like(c,dtype=float),where=c.sum(1,keepdims=True)>0)
            ax.imshow(v,vmin=0,vmax=1,cmap='Blues');ax.set_xticks(range(len(c)),[label(x) for x in a['labels']],rotation=55,ha='right',fontsize=8);ax.set_yticks(range(len(c)),[label(x) for x in a['labels']],fontsize=8)
            for i in range(len(c)):
                for j in range(len(c)):ax.text(j,i,f'{v[i,j]:.0%}',ha='center',va='center',fontsize=8,color='white' if v[i,j]>.55 else '#123')
            title={'attribute:scene':'场景','attribute:weather':'天气','attribute:timeofday':'时段','day_night':'昼夜','direction':'相机方向','dominant_landuse':'卫星主导建筑用途'}.get(kind,kind)
            ax.set_title(f"{title}\n准确率 {a['accuracy']:.1%} / 平衡准确率 {a['balanced_accuracy']:.1%}");ax.set_xlabel('预测类别');ax.set_ylabel('真实类别')
        fig.tight_layout();save(ds+'_confusion')
    fig,axes=plt.subplots(1,2,figsize=(11,4.4))
    show=sorted(rows,key=lambda x:x['positives'],reverse=True)[:5]
    for row in show:
        c=r['curves'][row['label']];axes[0].plot(c['recall'],c['precision'],label=label(row['label'])[:33])
    axes[0].set(xlim=(0,1),ylim=(0,1.03),xlabel='召回率',ylabel='精确率',title='高频类别的 PR 曲线');axes[0].legend(fontsize=7)
    z=np.load(OUT/'results'/f'{ds}_heldout.npz');j=max(range(len(r['classes'])),key=lambda j:r['classes'][j]['positives']);yy=z['y'][:,j];ss=z['scores'][:,j]
    for val,text,color in [(0,'负例','#c46a42'),(1,'正例','#197f88')]:
        if (yy==val).any():axes[1].hist(ss[yy==val],bins=40,density=True,histtype='step',linewidth=1.6,label=text,color=color)
    if r['classes'][j].get('threshold') is not None:axes[1].axvline(r['classes'][j]['threshold'],color='#666',ls='--',label='训练集校准阈值')
    axes[1].set(xlabel='原始余弦相似度（非概率）',ylabel='密度',title=label(r['classes'][j]['label'])[:38]);axes[1].legend(fontsize=8)
    fig.suptitle(NAMES[ds]);fig.tight_layout();save(ds+'_diagnostics')


def examples(ds,r):
    items=r.get('examples',[])
    if not items:return
    records={};by=collections.defaultdict(set)
    for e in items:by[e['package']].add(e['row'])
    for pack,wanted in by.items():
        with open(ROOT/pack/'image_map.jsonl') as f:
            for idx,line in enumerate(f):
                if idx in wanted:records[(pack,idx)]=json.loads(line)
                if idx>=max(wanted):break
    fig,axes=plt.subplots(3,2,figsize=(9,12))
    zips={}
    from dataset_image_pipeline import transform_image
    for ax,e in zip(axes.flat,items):
        m=records[(e['package'],e['row'])];assert not m.get('nested_archive')
        path=m['container']
        if path not in zips:zips[path]=zipfile.ZipFile(path)
        im=Image.open(io.BytesIO(zips[path].read(m['member']))).convert('RGB')
        im=transform_image(im,m['projection'],perspective_mode=m['perspective_mode'])[m['transform']['view_index']][0]
        dest=f"{ds}_{e['type']}_{e['row']}.jpg";im.save(FIG/dest,quality=88)
        e['image']=dest;e['source_uri']=m['source_uri'];e['view_id']=m['view_id'];e['transform']=m['transform']
        ax.imshow(im);ax.axis('off');tag={'TP':'命中正例','FP':'高分误报','FN':'低分漏报'}[e['type']]
        ax.set_title(f"{tag} | {label(e['label'])[:43]}\n分数 {e['score']:.3f} / 阈值 {e['threshold']:.3f} | 源图 {e['source']}",fontsize=9)
    for ax in list(axes.flat)[len(items):]:ax.axis('off')
    fig.suptitle(NAMES[ds]+'：按预设规则选取的诊断样本（非随机样本）');fig.tight_layout();save(ds+'_examples')


def retrieval():
    base=EXP/'msls_validation';r=json.loads((base/'metrics.json').read_text());dump(REPORT/'msls_retrieval.json',r)
    print('RETRIEVAL',json.dumps(r),flush=True)
    # Read exact full matrices for query-level success indicators and city breakdown.
    q=json.loads((base/'queries.json').read_text());p=json.loads((base/'positives.json').read_text());ind=np.load(base/'top100_indices.npy')
    if isinstance(p,dict):print('POSITIVES_DICT_KEYS',list(p)[:3],flush=True);return
    ks=[1,5,10,20,100];hit=np.array([[bool(set(row[:k])&set(pos)) for k in ks] for row,pos in zip(ind,p)],float)
    city=[v.get('city','unknown') for v in q]
    output={'overall':dict(zip(map(str,ks),hit.mean(0).tolist())),'cities':{c:{'n':city.count(c),'recall':dict(zip(map(str,ks),hit[np.array(city)==c].mean(0).tolist()))} for c in sorted(set(city))}}
    rng=np.random.default_rng(20260926);rep=np.array([hit[rng.integers(len(hit),size=len(hit))].mean(0) for _ in range(1000)])
    output['query_bootstrap_95']=np.percentile(rep,[2.5,97.5],axis=0).T.tolist();output['warning']='query bootstrap is descriptive; neighboring queries are correlated'
    dump(REPORT/'msls_breakdown.json',output)
    fig,ax=plt.subplots(figsize=(9,4.5));x=np.arange(len(ks))
    ax.plot(x,hit.mean(0),'o-',label='全部（含跨城市负例）',lw=2,color='#197f88')
    for c,v in output['cities'].items():ax.plot(x,list(v['recall'].values()),'o--',label=f"{c} / {v['n']} 个 query")
    ax.set_xticks(x,['Recall@'+str(k) for k in ks]);ax.set_ylim(0,1);ax.set_ylabel('至少一个正确地点进入前 K 的比例');ax.set_title('MSLS 官方验证城市：地点检索');ax.legend();ax.grid(axis='y',alpha=.2);fig.tight_layout();save('msls_retrieval')


def main():
    allr={};flat=[]
    for f in sorted((OUT/'results').glob('*.json')):
        ds=f.stem;r=json.loads(f.read_text());bootstrap(ds,r);plots(ds,r);examples(ds,r)
        allr[ds]=r
        for x in r['classes']:
            flat.append({'dataset':ds,**{k:v for k,v in x.items() if not isinstance(v,(dict,list))},'aliases':json.dumps(x.get('aliases',[]),ensure_ascii=False)})
        dump(REPORT/(ds+'.json'),r)
        print(json.dumps({'artifacts':ds,'ci':r['bootstrap']}),flush=True)
    keys=list(dict.fromkeys(k for r in flat for k in r))
    with open(REPORT/'per_class_metrics.csv','w',newline='',encoding='utf-8-sig') as f:
        w=csv.DictWriter(f,fieldnames=keys);w.writeheader();w.writerows(flat)
    summary={d:{k:r[k] for k in ('audit','summary','groups','categorical','bootstrap')} for d,r in allr.items()};dump(REPORT/'summary.json',summary)
    fig,ax=plt.subplots(figsize=(11,6));ds=list(allr);yy=np.arange(len(ds));means=np.array([allr[d]['summary']['mAP'] for d in ds]);ci=np.array([allr[d]['bootstrap']['percentile_95'] for d in ds])
    ax.barh(yy,means,color=['#197f88']*8+['#9873b9']);ax.hlines(yy,ci[:,0],ci[:,1],color='#183e46',linewidth=2);ax.scatter(ci[:,0],yy,marker='|',color='#183e46');ax.scatter(ci[:,1],yy,marker='|',color='#183e46')
    ax.scatter([allr[d]['summary']['macro_baseline_prevalence'] for d in ds],yy,marker='|',s=180,color='#ef993f',label='平均类别出现率基线',zorder=4)
    ax.set_yticks(yy,[NAMES[d] for d in ds]);ax.set_xlim(0,1);ax.set_xlabel('宏平均 AP 与分组重采样的 95% 分位范围');ax.set_title('各任务独立评估：不可作为跨数据集难度排行榜')
    for i,m in enumerate(means):ax.text(m+.025,i,f'{m:.3f}',va='center')
    ax.legend(loc='lower right');fig.tight_layout();save('overview')
    retrieval();dump(REPORT/'artifact_status.json',{'status':'complete','datasets':len(allr),'metric_rows':len(flat),'figure_count':len(list(FIG.glob('*.png')))})


if __name__=='__main__':main()
