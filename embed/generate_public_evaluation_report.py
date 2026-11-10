#!/usr/bin/env python3
"""Render the Chinese analysis document locally from computed result artifacts.

This script performs document layout only; all scoring/evaluation runs on RunPod.
"""
import base64
import csv
import html
import json
from pathlib import Path
from xml.sax.saxutils import escape
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Table,TableStyle,Image,KeepTogether

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'outputs/public_cosine_20260926/report'
PDFDIR=ROOT/'output/pdf';PDFDIR.mkdir(parents=True,exist_ok=True)
PDF=PDFDIR/'public_embedding_evaluation_zh_20260926.pdf'
HTML=DATA/'public_embedding_evaluation_zh_20260926.html'
NAMES={'cityscapes':'Cityscapes：通用街景语义','bdd100k_10k':'BDD10K：驾驶场景语义','mapillary_vistas':'Mapillary Vistas：细粒度道路类别','mapillary_mtsd':'MTSD：交通标志语义','bdd100k_100k':'BDD100K：对象、车道与场景属性','omnicity_mono':'OmniCity Mono：单视角建筑用途','omnicity_panorama':'OmniCity Panorama：全景建筑用途','omnicity_v2_svi':'OmniCity V2：街景与卫星用途关联','mapillary_msls':'MSLS：属性一致性与地点检索'}
SHORT={'cityscapes':'Cityscapes','bdd100k_10k':'BDD10K','mapillary_vistas':'Vistas','mapillary_mtsd':'MTSD','bdd100k_100k':'BDD100K','omnicity_mono':'OmniCity Mono','omnicity_panorama':'OmniCity Pano','omnicity_v2_svi':'OmniCity V2','mapillary_msls':'MSLS 属性'}
CN=dict(zip('road,sidewalk,building,wall,fence,pole,traffic light,traffic sign,vegetation,terrain,sky,person,rider,car,truck,bus,train,motorcycle,bicycle'.split(','),'道路,人行道,建筑,墙,围栏,杆,交通信号灯,交通标志,植被,地形,天空,行人,骑行者,汽车,卡车,公交车,火车,摩托车,自行车'.split(',')))
CN.update({'Building':'建筑','1: 1/2 Family Buildings':'独栋 / 双户住宅','2: Walk-Up Buildings':'无电梯公寓','3: Elevator Buildings':'电梯公寓','4: Mixed Residential/Commercial':'商住混合','5: Office Buildings':'办公建筑','6: Industrial/Transportation/Utility':'工业 / 交通 / 公用设施','7: Others':'其他用途','day':'白天','night':'夜间','Forward':'前向','Sideways':'侧向','Backward':'后向','control_panel':'仪表盘'})
def label(x):return CN.get(x,x)
def num(x):return f'{x:.3f}' if isinstance(x,(float,int)) else '不适用'
def pct(x):return f'{x*100:.2f}%' if isinstance(x,(float,int)) else '不适用'
def rowby(r,label):return next(x for x in r['classes'] if x['label']==label)
R={d:json.loads((DATA/(d+'.json')).read_text(encoding='utf-8')) for d in NAMES}

pdfmetrics.registerFont(TTFont('CN','C:/Windows/Fonts/simhei.ttf'))
pdfmetrics.registerFontFamily('CN',normal='CN',bold='CN',italic='CN',boldItalic='CN')
STYLE={
 'body':ParagraphStyle('body',fontName='CN',fontSize=9.2,leading=14.8,spaceAfter=8,wordWrap='CJK',textColor=colors.HexColor('#233845')),
 'small':ParagraphStyle('small',fontName='CN',fontSize=7.3,leading=10.5,spaceAfter=6,wordWrap='CJK',textColor=colors.HexColor('#526575')),
 'h1':ParagraphStyle('h1',fontName='CN',fontSize=19,leading=27,spaceAfter=14,textColor=colors.HexColor('#123b49'),keepWithNext=True),
 'h2':ParagraphStyle('h2',fontName='CN',fontSize=12.2,leading=18,spaceBefore=8,spaceAfter=8,textColor=colors.HexColor('#167981'),keepWithNext=True),
 'title':ParagraphStyle('title',fontName='CN',fontSize=31,leading=44,spaceAfter=24,textColor=colors.HexColor('#103e4a')),
 'cell':ParagraphStyle('cell',fontName='CN',fontSize=7.8,leading=11,wordWrap='CJK'),
 'tiny':ParagraphStyle('tiny',fontName='CN',fontSize=6.4,leading=8.8,wordWrap='CJK'),
}


class Document:
    def __init__(self):self.story=[];self.web=[];self.sections=[]
    def page(self):self.story.append(PageBreak())
    def title(self,text,style='h1'):
        self.story.append(Paragraph(escape(text),STYLE[style]));level='h1' if style=='title' else style
        ident='section-'+str(len(self.sections));self.sections.append((ident,text));self.web.append(f'<{level} id="{ident}">{html.escape(text)}</{level}>')
    def p(self,text,small=False):
        self.story.append(Paragraph(escape(text),STYLE['small' if small else 'body']));self.web.append(f'<p class="{"small" if small else ""}">{html.escape(text)}</p>')
    def bullets(self,items):
        for i,text in enumerate(items):self.p(f'{i+1}. {text}')
    def table(self,headers,rows,widths=None,tiny=False):
        style=STYLE['tiny' if tiny else 'cell']
        data=[[Paragraph(escape(str(v)),style) for v in headers]]+[[Paragraph(escape(str(v)),style) for v in row] for row in rows]
        t=Table(data,colWidths=widths or [515/len(headers)]*len(headers),repeatRows=1,hAlign='LEFT')
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#dcecef')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f4f7f9')]),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.5,colors.HexColor('#9cb9c0')),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
        self.story.extend([t,Spacer(1,10)])
        self.web.append('<div class="table-wrap"><table><thead><tr>'+''.join('<th>'+html.escape(str(x))+'</th>' for x in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+html.escape(str(x))+'</td>' for x in row)+'</tr>' for row in rows)+'</tbody></table></div>')
    def fig(self,name,caption,maxheight=330):
        p=DATA/'figures'/name
        if not p.exists():raise FileNotFoundError(p)
        im=PILImage.open(p);w,h=im.size;scale=min(515/w,maxheight/h)
        self.story.append(Image(str(p),width=w*scale,height=h*scale,hAlign='CENTER'));self.p(caption,True)
        b=base64.b64encode(p.read_bytes()).decode();self.web.insert(len(self.web)-1,f'<figure><img src="data:image/png;base64,{b}" alt="{html.escape(caption)}"></figure>')
    def finish(self):
        def footer(canvas,doc):
            canvas.setStrokeColor(colors.HexColor('#cddce0'));canvas.line(40,37,A4[0]-40,37)
            canvas.setFont('CN',7);canvas.setFillColor(colors.HexColor('#647984'));canvas.drawString(40,25,'UrbanFabric / 全量嵌入余弦评估 / 2026-09-26');canvas.drawRightString(A4[0]-40,25,str(doc.page))
        SimpleDocTemplate(str(PDF),pagesize=A4,leftMargin=40,rightMargin=40,topMargin=40,bottomMargin=49,title='公开数据集全量嵌入余弦评估 - 中文分析报告',author='UrbanFabric experiment analysis').build(self.story,onFirstPage=footer,onLaterPages=footer)
        nav=''.join(f'<a href="#{i}">{html.escape(t)}</a>' for i,t in self.sections)
        css='''body{margin:0;background:#edf3f5;color:#213744;font-family:"Microsoft YaHei","PingFang SC",sans-serif;line-height:1.85}main{max-width:1080px;margin:auto;background:white;padding:54px 66px;box-shadow:0 4px 28px #b9cbd344}h1{font-size:30px;line-height:1.5;color:#123e4a;border-bottom:2px solid #187e86;padding-bottom:12px;margin-top:65px}h2{color:#167981;margin-top:36px;font-size:21px}p{font-size:16px}.small{font-size:13px;color:#657987}nav{max-height:220px;overflow:auto;background:#edf5f6;padding:20px;display:flex;flex-wrap:wrap;gap:8px 22px}nav a{color:#176f7a;font-size:13px}figure{margin:25px 0;text-align:center}img{max-width:100%;height:auto;max-height:1100px}table{width:100%;border-collapse:collapse;font-size:13px;margin:15px 0}th{background:#dcecef;text-align:left;position:sticky;top:0}td,th{padding:9px;border-bottom:1px solid #e2eaec;vertical-align:top}tr:nth-child(even){background:#f4f7f9}.table-wrap{overflow:auto}input{padding:14px;width:90%;border:1px solid #a4bfc6;font-size:16px}a{color:#167981}code{overflow-wrap:anywhere}@media(max-width:700px){main{padding:20px}h1{font-size:25px}}@media print{nav,input{display:none}main{box-shadow:none;padding:0}h1{break-before:page}tr,figure{break-inside:avoid}}'''
        js='''document.getElementById('search').addEventListener('input',e=>{let q=e.target.value.toLowerCase();document.querySelectorAll('tbody tr').forEach(r=>r.style.display=r.innerText.toLowerCase().includes(q)?'':'none')});'''
        HTML.write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>全量嵌入余弦评估 | 中文报告</title><style>'+css+'</style><main><div class="small">URBANFABRIC / EXPERIMENT REPORT / 2026-09-26</div><nav>'+nav+'</nav><p><input id="search" placeholder="筛选全部表格：输入数据集、类别名或数值"></p>'+''.join(self.web)+'<script>'+js+'</script></main></html>',encoding='utf-8')


def methods(doc):
    doc.page();doc.title('02 / 数据覆盖、划分与评估口径')
    doc.p('全量分数覆盖 1,846,880 张原始图像对应的 2,280,139 个视角嵌入，分布于 27 个数据包。原始导出阶段已有 682 个失败来源被排除；本轮未重新生成图像嵌入。622 条数据集专属陈述式英文提示共得到 68,641,302 个 FP32 余弦分数。')
    doc.table(['数据集','全量视角','校准行数','评估行数 / 原图','可评估类'],[[SHORT[d],f"{r['audit']['all_rows']:,}",f"{r['audit']['cal_rows']:,}",f"{r['audit']['eval_rows']:,} / {r['audit']['eval_sources']:,}",r['summary']['evaluable_classes']] for d,r in R.items()],[105,85,85,145,95])
    doc.p('Cityscapes 使用 fine train 校准、fine val 评估；train_extra 粗标注只作诊断。BDD 与 Vistas 使用官方 train/val，隐藏 test 标签不参与。MTSD 只以 fully annotated 的 train/val 作为主评估；OmniCity Mono/Panorama 使用 train/test，V2 使用 train/val。MSLS 属性以其他训练城市校准，cph/sf 验证城市评估，并排除全景派生视角。')
    doc.p('原图、序列或坐标组的校准/评估重叠检查均为 0。OmniCity 按完全相同的经纬度检查重叠；这不是额外的空间缓冲隔离。置信分析另外以 0.002° 网格聚合相邻位置，因此仍不宣称已消除所有空间相关。')
    doc.title('如何从原标注得到“图中有某物”','h2')
    doc.p('稠密标签在已变换的 512×512 视角中至少出现 1 个有效像素，即计为该类存在；void 与不参与官方评价的类别不作负例。MTSD 采用裁剪/投影后仍可见的框。OmniCity 采用变换后的实例类别及面积。BDD 的天气、时段、场景和 MSLS 属性来自源图元数据，属于元数据一致性探针。')
    doc.p('所有行均以 source_index、embedding_row 和 view_id 与 annotations.json 对齐。仅得到整图嵌入分数，不能据此计算像素分割 mIoU、检测框 mAP 或定位准确率；本报告的 AP 是图像/视角级类别存在性检索 AP。')
    doc.page();doc.title('03 / 指标、阈值与不确定性')
    doc.table(['指标','回答的问题','解释边界'],[
      ['AP / 宏平均 mAP','真正含有该类的图像能否排在前面？','对有正例且有负例的类别分别计算 AP，再等权平均；类别无正/负例时列为不适用。'],
      ['类别出现率 / AP lift','高分是否只是因为该类很常见？','出现率是参考基线；lift = AP / 出现率。小样本下不能把出现率视为精确有限样本随机 AP 期望。'],
      ['AUROC','随机正例的分数是否高于随机负例？','类别极不均衡时不能替代 AP、误报数和精确率。'],
      ['Precision@100','优先检查 100 张高分图时有多少是真正例？','不足 100 个已知样本时采用实际样本数；附表保留 K。'],
      ['校准 F1 / Precision / Recall','给定阈值后能否可靠地输出是/否？','只在校准集选取最大 F1 阈值，至少 5 正例、5 负例；同分取较高阈值。'],
      ['Accuracy / Balanced accuracy','互斥属性的最大分数类别是否正确？','分别报告整体准确率与各真实类别召回率均值，并附多数类基线。'],
      ['Spearman / 面积敏感性','分数是否随可见面积增加？','稠密面积为有效类别像素 / 总像素；交通标志用最大框面积。面积筛选排除小正例，绝不把它们改成负例。']],[100,150,265])
    doc.p('置信分析采用固定随机种子 20260926 的 200 次非参数分组 bootstrap。Cityscapes、BDD、Vistas、MTSD 以原图分组；MSLS 以采集序列分组；OmniCity 以约 170×222 米的 0.002° 坐标网格分组（纽约纬度附近）。报告的 95% 范围是重采样统计量的百分位范围。')
    doc.p('稀有类别会在某次重采样中完全消失，该次宏平均会跳过其 AP。这会改变可评估类别集合：MTSD 的 200 次重采样累计出现 1,257 个“类别×重复”退化事件，百分位范围甚至高于原始点估计，因此不能据此声称长尾结果稳定。MSLS 少量夜间样本集中于序列，区间也明显较宽。点估计、支持样本数和这一限制必须一起阅读。')
    doc.p('余弦分数不是概率，未使用 0.5 或 0 作为通用阈值。不同提示的分数存在基线偏移，因此“各提示排序很好”并不保证“直接 argmax 分类很好”。所有阈值均冻结后再应用于评估集；本轮未根据验证结果重新拟合模型或重写提示。')


def dataset_text(ds,r):
    if ds=='cityscapes':return [
      '500 张官方验证原图被水平分为 1,000 个视角。19 类 mAP 为 73.61%，平均类别出现率为 53.89%；建筑、道路、植被等高频大目标容易取得高 AP，墙、地形与细分车辆类别更困难。',
      '建筑 AP 99.84%，但出现率已达 95.50%；汽车 AP 96.30%，出现率 85.80%。不能把这些 AP 等同于独立二分类准确率。墙 AP 30.09%，火车 AP 30.66% 且仅 28 个正例，说明细粒度与稀有类别仍有限。',
      '将两视角汇总回原图，采用“任一视角存在”真值时，max 与 mean 聚合 mAP 分别为 80.65% 和 79.20%。这两者在相同原图级任务上可比较；原图级与视角级的类别出现率不同，不能将其差异全归因于模型提升。粗标注 train_extra 的诊断 mAP 为 67.35%，不属于独立验证成绩。']
    if ds=='bdd100k_10k':return [
      '本地已提交的官方 val 中有 998 张可评估图像。19 类 mAP 为 64.82%，平均出现率 47.27%；道路、建筑、植被、天空和汽车 AP 较高，但均受常见类别占比影响。',
      '火车仅 7 个正例、AP 0.51%；墙 AP 14.82%，骑行者 AP 26.64%。小目标、相邻概念和极少样本类别不适合仅凭统一陈述提示自动筛选。与 Cityscapes 的差异同时包含领域、裁剪策略、标注密度与类别分布影响，本轮无法单独归因。',
      '代码保留正例面积至少 0.1% 和 1% 的敏感性结果。该分析用于判断是否主要遗漏很小的可见区域；小正例在敏感性子集中被排除，主评估仍使用 1 像素存在规则。']
    if ds=='mapillary_vistas':return [
      '2,000 张官方 validation 图像用于评估；训练集 18,000 张仅用于阈值校准。118 个已评分非 void 提示中，有 7 个 schema.evaluate=false 的模糊/群组类别被置为未知，主评估保留 111 类。',
      'mAP 为 32.05%，平均类别出现率 20.20%。天空、道路、植被、杆和建筑表现较强；细分标线、临时标志背面及罕见障碍类别明显较弱。其类别粒度比 Cityscapes 更细，不能把 mAP 较低直接解释为整体视觉表征失效。',
      '最低 AP 的 other-barrier 在验证集中只有 1 个正例。类别图展示最低 8 类与最高 10 类，完整 111 类以及 7 个不参与评估的提示均保留在附录。']
    if ds=='mapillary_mtsd':return [
      '401 个原始标志标签对应的提示中，许多地域/图形变体使用完全相同的文字。按完全相同 statement 合并后得到 236 个语义组；分数取组内均值，真值取正例并集。验证集中有 228 组同时包含正负例。',
      '主评估使用 5,304 张 fully annotated 验证原图对应的 5,962 个视角。mAP 为 3.22%，平均出现率 0.817%；约 3.94 倍的总体比值并不代表可用分类器。宏平均 F1 仅约 4.37%。other-sign 的 AP 80.56% 是宽泛类别优势，不能代表对限速数字、箭头方向等细节的辨识。',
      '按最大框面积分层，已校准类别的正例召回率从面积不足 0.1% 的 39.13%，升至 0.1%-1% 的 62.48%，再到至少 1% 的 87.58%。这些是跨类别按正例数汇总的召回，受 other-sign 等高频类影响，也存在类别组成差异；它们支持“小目标分辨率是潜在瓶颈”，但不是因果证明。',
      '64,094 个 partially annotated 视角仅记录了 79,037 个已知正例对；未标注类别全部保留未知，未用于负例计算。8 个语义组在验证集无正例，AP 不适用。']
    if ds=='bdd100k_100k':return [
      '70,000 张 train 校准，10,000 张 val 评估；20,000 张隐藏 test 仍有分数但不计算指标。36 条提示中 area/unknown 无正例，35 类可计算 AP。对象/车道 mAP 为 50.20%；天气、时段和场景采用单独的互斥分类分析。',
      '场景 argmax 准确率 65.08%，略高于多数类基线 61.45%，但宏 F1 仅 39.09%。天气准确率 43.68%，低于多数类基线 60.45%；平衡准确率 55.38% 表示少数天气仍有一定辨识能力，但直接输出标签不可靠。时段准确率 68.07%，高于基线 52.76%。',
      '汽车 AP 99.28%，但验证图像中 97.75% 本来就有汽车；夜间 AP 97.72%、出现率 39.43%，是更有区分价值的结果。车道颜色/单双线的细分提示明显较弱，而且部分标签只有个位数或十几个正例。']
    if ds=='omnicity_mono':return [
      '3,000 张官方 test 单视角图像都标有建筑，因此 Building 类没有负例：其 AP/AUROC 不可用于判断“有没有建筑”。主 mAP 33.78% 来自 7 个建筑用途类别，平均出现率 26.24%。',
      '商住混合 AP 71.54%，出现率 61.27%；办公 AP 48.05%，出现率 38.53%。独栋/双户住宅 AP 10.26%，其他用途 AP 1.79%，不足以支撑可靠的自动土地用途判定。',
      '这些标签评价的是视角中带用途标注的建筑实例，并非整个街区的用途比例。建筑立面与规划用途并不总是一一对应。本轮没有学习专门的用途分类头，因此结果主要反映预训练文本与视觉空间的直接对应能力。']
    if ds=='omnicity_panorama':return [
      '3,600 张 test 全景各产生 8 个视角，共 28,800 个视角。Building AP 为 90.58%；七种用途的 mAP 只有 19.91%。将建筑存在与用途混合平均会得到 28.75%，因此应优先阅读分任务结果。',
      '回到原图级，以八视角正例并集为真值时，用途任务 max 聚合 mAP 为 39.98%，mean 聚合为 42.84%。本次比较中 mean 更高，但这是观察结果，不据此回头更换主评估规则。聚合改变了任务单位与类别出现率，不能与单视角 mAP 直接作提升比例比较。',
      '只有 224 个视角属于“其他用途”正例，AP 0.80%。用途类别的混淆可能同时来自提示过于抽象、可见立面不足和用途标签本身难以直接观察；报告中的统计不能把这些原因分离。']
    if ds=='omnicity_v2_svi':return [
      '该任务将八个街景视角分数平均到每张源全景，再与配对的 256×256 卫星建筑用途栅格关联。3,600 个 val 位置参与评估。这里的正例表示卫星范围内出现该建筑用途，绝不表示当前街景视角看到了该建筑。',
      '原始栅格的 1 是背景，2-8 依次对应七种建筑用途；本轮扫描确认标签值在 1-8，依据公开类别表并通过原始卫星影像/土地用途/楼层图的空间对照核验。避免将背景误解释成独栋住宅，是本轮重要的数据审计修正。',
      '平均聚合的多标签关联 mAP 为 63.62%，平均出现率已达 51.89%；max 聚合为 60.11%。但直接用最高分预测卫星范围内面积最大的建筑用途，准确率仅 8.11%，低于多数类基线 27.28%。这说明“有某类建筑的弱关联”远不能等同于“主导用途分类”。',
      '混淆矩阵显示 3,600 个位置中有 3,477 个（96.58%）被 argmax 预测为无电梯公寓，说明这一提示具有很强的分数基线偏移。面积 Spearman 系数按整幅卫星图像素占比计算，背景不参与七类比较；主导类别只在七种建筑用途中选取。这不是卫星分割，也不能据此宣称已完成跨视角定位。']
    return [
      '属性探针使用 cph/sf 的 29,955 张非全景源图，校准集来自其他训练城市。属性来自原图元数据；中心裁剪可能改变仪表盘可见性，因此此项反映源属性与所用视图的相容程度，而非精确的裁剪后可见性真值。',
      '夜间只有 85 个正例，但 night 提示 AP 92.12%、AUROC 99.99%。训练城市选出的阈值 0.253668 在验证集命中 85 个夜间图、误报 31 个、漏报 0 个，精确率 73.28%、F1 84.58%。直接比较 day/night 两个分数却有 2,390 个白天误判为夜间，说明提示基线偏移需要校准。',
      '相机方向 argmax 准确率仅 49.76%，显著低于始终预测 Forward 的 94.41% 基线。Sideways AP 2.94%，低于其 4.41% 出现率。单张街景中的“前、后、侧”具有相对性，现有文字提示不能可靠对应采集相机方向。仪表盘 AP 81.89%，但跨城市正例比例变化使训练 F1 最优阈值接近全预测正例，应按实际误报成本另设校准目标。']


def dataset(doc,ds,index):
    r=R[ds];a=r['audit'];s=r['summary'];doc.page();doc.title(f'{index:02d} / '+NAMES[ds])
    for text in dataset_text(ds,r):doc.p(text)
    doc.table(['mAP','平均出现率','宏 AUROC','宏 F1','AP 可评估类'],[[pct(s['mAP']),pct(s['macro_baseline_prevalence']),num(s['macro_auc']),pct(s['macro_f1']),str(s['evaluable_classes'])]],[103]*5)
    doc.fig(ds+'_classes.png','类别 AP 与出现率对照。橙色短线为出现率；它与 AP 接近时，高 AP 的实际区分价值有限。',maxheight=340)
    doc.page();doc.title(SHORT[ds]+' / 分布与误差诊断')
    doc.fig(ds+'_diagnostics.png','左：高频类别的精确率-召回率曲线。右：出现最频繁类别的分数分布；虚线是训练划分校准的阈值。高频类别并不一定是最有区分力的类别。',maxheight=235)
    if r['categorical']:
        doc.fig(ds+'_confusion.png','混淆矩阵按真实类别逐行归一化；列是预测类别。矩阵对角线之外的质量显示具体混淆方向。',maxheight=265)
        doc.table(['属性','样本数','准确率','平衡准确率','宏 F1','多数类基线'],[[k,v['n'],pct(v['accuracy']),pct(v['balanced_accuracy']),pct(v['macro_f1']),pct(v['majority_baseline'])] for k,v in r['categorical'].items()],[110,60,85,90,80,90])
    else:
        rows=[x for x in r['classes'] if x.get('spearman_area') is not None]
        rows=sorted(rows,key=lambda x:x['positives'],reverse=True)[:8]
        if rows:
            doc.title('可见面积与分数的关系','h2')
            doc.table(['类别','正例数','Spearman','面积≥0.1% AP','面积≥1% AP'],[[label(x['label']),x['positives'],num(x['spearman_area']),num(x.get('area_0.001',{}).get('ap')),num(x.get('area_0.01',{}).get('ap'))] for x in rows],[235,55,65,80,80])
            doc.p('面积敏感性表按正例数列出最多 8 类。小正例被移出子集，所以这些 AP 不与主 AP 作同分布比较；它们用于诊断目标大小、可见性与排序之间的关系。',True)
    b=r['bootstrap'];doc.p(f"分组重采样：{b['groups']:,} 个组，200 次重复，mAP 的 95% 分位范围为 {pct(b['percentile_95'][0])} - {pct(b['percentile_95'][1])}；共 {b['missing_class_replicates']} 个类别×重复因缺少正例或负例而略过。该范围不包含模型训练、提示选择和跨城市分布变化的不确定性。",True)
    if r.get('examples'):
        doc.page();doc.title(SHORT[ds]+' / 真实图像案例')
        doc.fig(ds+'_examples.png','案例按预设规则选择：最高分误报、最低分漏报、最高分命中各至多 2 张。它们不是随机样本，不能据此估计整体错误比例。',maxheight=560 if ds in ('cityscapes','mapillary_mtsd') else 625)
        if ds=='cityscapes':doc.p('图中“汽车误报”仍可看到拍摄车辆的车头。Cityscapes 的自车区域不属于参与本次评估的 car 类，所以这里的误报是相对标注定义而言，不能直接表述为画面中完全没有汽车部件。两个漏报样本的 car 像素占比分别仅约 0.062% 和 0.760%。',True)
        if ds=='mapillary_mtsd':doc.p('other-sign 是类别表中的剩余类，不代表任意交通标志。上排虽可见明显标志，也可能属于别的具体类别，因此是相对 other-sign 的误报。中排两个漏报正例的最大框仅占约 0.0077% 和 0.0232%，在整图缩放后极难辨认；它们不应被简单解释为程序错配。',True)
        doc.p('显示图像根据 image_map 的裁剪/投影几何从原始压缩包重建，用于目视诊断，未重新推理。原始路径、source_index、view_id、分数与阈值均保存在对应数据集 JSON 的 examples 字段。',True)


def main():
    doc=Document();doc.title('公开数据集\n全量嵌入余弦评估',style='title')
    doc.p('中文图文分析报告 | 2026 年 9 月 26 日 | UrbanFabric')
    doc.p('对象：500 GB RunPod 网络卷 ph7jmyo7ov 中的九类公开数据集；模型为 Qwen3-VL-Embedding-8B。报告评价已经计算的余弦分数，并保留官方验证城市 MSLS 的完整图像配对结果。')
    doc.title('本轮最重要的结论','h2')
    doc.bullets([
      '通用语义可以作为检索起点：Cityscapes mAP 73.61%，BDD10K 64.82%；高频大目标表现较好，但出现率基线也很高。',
      '细粒度交通标志明显不足：MTSD 合并同义提示后 mAP 仅 3.22%；小目标和长尾标签尤其困难。',
      '排序能力与分类决策必须分开：MSLS night AP 92.12%，校准后 F1 84.58%；方向分类则低于多数类基线。',
      '建筑用途只能谨慎解释：全景可见用途 mAP 19.91%；V2 卫星用途关联 mAP 63.62%，但主导用途准确率只有 8.11%。',
      '地点检索仍有改进空间：MSLS 官方验证城市 Recall@1 为 29.59%，Recall@10 为 51.35%，Recall@100 为 74.32%。'])
    doc.p('交付包含：自包含 HTML、可打印 PDF、457 行逐类别统计 CSV、九份详细结果 JSON、28 张分析图，以及原始案例图。所有数据集均完成已定义的评分评估；无标签、无正例或无负例的项目明确列为不适用。')
    doc.p('这些是现有固定嵌入与固定提示下的派生任务结果，不是原始分割/检测官方排行榜成绩，也不是重新训练后的模型成绩。')
    doc.page();doc.title('01 / 结果总览')
    doc.table(['任务','mAP','出现率基线','宏 F1','评估单位'],[[SHORT[d],pct(r['summary']['mAP']),pct(r['summary']['macro_baseline_prevalence']),pct(r['summary']['macro_f1']),'源全景' if d=='omnicity_v2_svi' else '图像视角'] for d,r in R.items()],[120,80,105,80,130])
    doc.fig('overview.png','不同数据集的类别粒度、出现率与任务单位不同，此图用于各任务内部与基线对照，不构成跨数据集难度或模型能力排行榜。',maxheight=310)
    doc.p('OmniCity Panorama 的 28.75% 总 mAP 混合了“建筑存在”和“七种用途”；其中用途单独 mAP 为 19.91%。BDD100K 混合表仅用于总览，天气、时段、场景与对象/车道必须分开解读。V2 的关联任务与可见类别任务不可直接比较。',True)
    methods(doc)
    for i,ds in enumerate(NAMES,4):dataset(doc,ds,i)
    doc.page();doc.title('13 / MSLS 官方验证城市地点检索')
    ms=json.loads((DATA/'msls_breakdown.json').read_text());metrics=json.loads((DATA/'msls_retrieval.json').read_text())
    doc.p('按用户选择，仅计算 Copenhagen（cph）与 San Francisco（sf）官方验证城市；保留跨城市负样本。使用官方 all 子任务、单张图像对单张图像、排除全景、同城市 UTM 距离不超过 25 米为正例。747 个候选 query 中有 7 个无正例，按协议排除，最终 740 query × 18,871 database。')
    doc.p('完整 FP32 矩阵有 13,964,540 个分数，数据体积 55,858,160 字节，约 55.86 MB（53.27 MiB），远小于事前 0.841 GB 的上限估计。本轮未扩展到全部 30 个城市，也未将该任务错误限定为“不同日期才是正例”；相同日期的有效地点配对仍保留。')
    doc.fig('msls_retrieval.png','地点检索 Recall@K：前 K 个候选中至少包含一个 25 米以内的同城正确地点。两城市检索时使用共同 database，因此跨城候选属于负样本。',maxheight=300)
    doc.table(['范围','query 数','R@1','R@5','R@10','R@20','R@100'],[['全部',740]+[pct(ms['overall'][str(k)]) for k in (1,5,10,20,100)]]+[[city,v['n']]+[pct(v['recall'][str(k)]) for k in (1,5,10,20,100)] for city,v in ms['cities'].items()],[90,65,72,72,72,72,72])
    doc.p('现有表征在前 100 个候选中能找回约四分之三 query，但首位命中不足三分之一。后续若服务于精确地点匹配，应将这一全局检索用作候选召回，再验证局部对应关系；本报告没有实施或声称完成重排序模型。城市差异反映数据条件差异，但仅两个验证城市不足以估计广泛跨城市泛化。')
    doc.page();doc.title('14 / 对产品与下一轮实验的含义')
    doc.table(['用途','现有证据','建议决策'],[
      ['语义检索与人工探索','大类 AP 较高，细类差异明显','保留连续分数排序，按类别显示验证指标和出现率；优先采用有足够正负例且明显优于基线的类别。'],
      ['二分类过滤','固定阈值与提示 argmax 会产生不同错误','以实际误报/漏报成本在独立校准集选阈值；上线前验证目标城市，不复用一个全局阈值。'],
      ['交通标志细分','MTSD mAP 3.22%，目标越小召回越低','优先研究框裁剪后的局部嵌入、文字/数字识别与专用标志分类；在新留出集验证。'],
      ['相机方向','argmax 49.76%，多数类基线 94.41%','当前提示不应直接用于方向标签；先明确方向坐标系，再评估相机元数据或具有参照信息的模型。'],
      ['建筑用途','可见用途弱；V2 主导用途 8.11%','将结果作为关联线索，避免直接输出规划/地籍用途结论；下一轮单独研究用途监督与空间证据。'],
      ['地点匹配','R@1 29.59%，R@100 74.32%','先保留全量验证矩阵基线，再评估局部特征或时序重排序；固定相同 query/database 比较。']],[100,155,260])
    doc.title('建议优先做的可检验改进','h2')
    doc.bullets(['先完成阈值目标的定义：精确率优先、召回率优先或人工核查预算优先；本轮 F1 最优阈值只是一种操作点。','建立独立的提示开发划分，在其中比较自然语句、正负成对提示及提示集合；不能根据本报告的验证错误直接挑选最佳提示后继续把同一验证集当最终测试。','对小目标进行局部视图实验，同时固定原图级分组、类别集合及评估规则，以区分分辨率收益与样本组成变化。'])
    doc.p('本轮结果来自已有预训练模型。预训练数据与公开 benchmark 的交集未知，因此“没有在本次实验训练模型”不等于能够证明模型从未见过相近数据。空间相邻样本、标注边界、裁剪范围和源属性的可见性差异也会影响估计。')
    doc.page();doc.title('15 / 复现、质量检查与文件说明')
    doc.bullets(['27 个包均逐行校验 source_index、embedding_row、view_id；分数分块边界连续，行数和列顺序一致，数值均为有限值。','未知标签保留为 -1；没有隐藏标签的 test、MTSD partial 未标注类别、Vistas 不参与评价的类别不会被当作负例。','阈值校准与评估来源分离，源 ID 无交叉；OmniCity 坐标组无完全重叠。阈值在训练集选取，评估集只报告结果。','合成用例验证了未知标签屏蔽、校准阈值、无正例情形与面积敏感性过滤；实际评分阶段已有 FP32 余弦数值检查，真实数据最大绝对误差约 6.56×10^-7。','原始 embedding、image_map、validation.tar 与图像压缩包均只读。所有新结果位于实验 evaluation 目录；本轮评分评估在 RunPod 执行，本地仅排版报告。'])
    doc.table(['文件 / 目录','内容'],[
      ['public_embedding_evaluation_zh_20260926.html','完整自包含中文报告，图像内嵌，可在浏览器筛选表格。'],
      ['public_embedding_evaluation_zh_20260926.pdf','同一分析内容及逐类附表的可打印版本。'],
      ['per_class_metrics.csv','457 行类别记录；原始标签、实际 statement、支持数、AP、AUROC、P@100、校准阈值、混淆计数等。'],
      ['各数据集 JSON','包含面积敏感性、分组重采样、PR 曲线、聚合比较、类别合并 aliases、混淆矩阵和案例溯源。'],
      ['evaluation/truth/*.npz（远程）','全量视角真值、面积、来源、划分、标注覆盖信息；可重算指标。'],
      ['evaluation/results/*_heldout.npz（远程）','留出集分数、标签和组 ID；用于误差审计与不确定性分析。']],[225,290])
    doc.p('远程实验路径：/workspace/experiments/public_cosine_20260926/evaluation/。执行脚本：embed/evaluate_public_cosine.py、embed/public_evaluation_artifacts.py；文档排版脚本：embed/generate_public_evaluation_report.py。硬件：RTX PRO 4500 Blackwell 32 GB；本轮评估主要使用 CPU，不需要重新加载图像嵌入模型。')
    doc.title('原始协议与方法来源','h2')
    refs=[('Cityscapes 数据与评测定义','https://www.cityscapes-dataset.com/benchmarks/'),('Mapillary Vistas 标签编码','https://github.com/mapillary/mapillary_vistas'),('MTSD 全量/部分标注说明','https://arxiv.org/abs/1909.04422'),('BDD100K 标注格式','https://github.com/ucbdrive/bdd100k/blob/master/doc/format.md'),('MSLS 官方评估代码','https://github.com/mapillary/mapillary_sls'),('OmniCity 项目','https://city-super.github.io/omnicity/'),('SG-BEV 补充材料：OmniCity 类别定义','https://openaccess.thecvf.com/content/CVPR2024/supplemental/Ye_SG-BEV_Satellite-Guided_BEV_CVPR_2024_supplemental.pdf'),('AP 实现与定义','https://scikit-learn.org/stable/modules/generated/sklearn.metrics.average_precision_score.html')]
    for name,url in refs:
        doc.story.append(Paragraph(f'<link href="{escape(url)}" color="#167981">{escape(name)}</link>',STYLE['small']));doc.web.append(f'<p class="small"><a href="{html.escape(url)}">{html.escape(name)}</a></p>')
    doc.page();doc.title('附录 A / 完整逐类别结果')
    doc.p('下表保留全部 457 个最终类别/语义组记录；MTSD 已由 401 个原标签合并到 236 个语义组，因此总行数不同于 622 个原始提示。表中的类别标识保留原始英文，便于与提示、标注和程序输出精确对照。完整英文陈述、阈值与 TP/FP/FN/TN 在 CSV 和 JSON 中。')
    doc.p('AP、AUROC、F1 和 P@100 均采用 0-1 标度；“不适用”不等于 0。F1 使用训练划分选出的阈值；无正例或无负例时即使可计算某个 F1 数值，也不作为 AP 性能证据。极少正例类别的数值不稳定，应先阅读正例数量。')
    for ds,r in R.items():
        doc.title(SHORT[ds],'h2')
        doc.table(['原始类别 / 语义组代表名','正例 / 已知','AP','AUROC','F1','P@100'],[[x['label'],f"{x['positives']} / {x['n']}",num(x.get('ap')),num(x.get('auc')),num(x.get('f1')),num(x.get('precision_at_100'))] for x in r['classes']],[260,75,45,45,45,45],tiny=True)
    doc.finish();print(json.dumps({'pdf':str(PDF),'html':str(HTML),'pdf_bytes':PDF.stat().st_size,'html_bytes':HTML.stat().st_size},ensure_ascii=False))


if __name__=='__main__':main()
