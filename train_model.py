"""CMP Colab / local training. No downloads, pickle loading, or external service needed."""
from pathlib import Path
import json, hashlib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
import sklearn

FEATURES={'SIM':['pressure_kpa','rotation_rpm','pad_wear','slurry_ml_min'],
          'REAL':['pressure_scaled','rotation_scaled','pad_usage_scaled','slurry_scaled']}

def prepare(df):
    df=df.copy()
    required=['schema_version','source','wafer_id','run_id','stage','timestamp','mrr']
    missing=[c for c in required if c not in df]
    if missing:raise ValueError('필수 열이 없습니다: '+', '.join(missing))
    if not df['schema_version'].astype(str).eq('1.0.0').all():raise ValueError('자료 규격 버전은 1.0.0이어야 합니다.')
    sources=df['source'].dropna().unique().tolist()
    if len(sources)!=1 or sources[0] not in FEATURES:raise ValueError('SIM 또는 REAL 한 출처만 업로드하세요. 두 출처를 섞지 않습니다.')
    source=sources[0];features=FEATURES[source]
    stages=df['stage'].dropna().unique().tolist()
    if len(stages)!=1 or stages[0]!=('EDU' if source=='SIM' else 'A'):raise ValueError('SIM은 EDU, REAL은 A 단계 자료만 사용하세요.')
    if df[required].isna().any().any():raise ValueError('식별자·시간·정답에 빈칸이 있습니다.')
    if df['run_id'].astype(str).duplicated().any():raise ValueError('중복 run_id가 있습니다. 같은 자료를 다시 붙였는지 확인하세요.')
    for c in features+['mrr']:
        if c not in df:raise ValueError('필수 열이 없습니다: '+c)
        df[c]=pd.to_numeric(df[c],errors='coerce')
        if not np.isfinite(df[c]).all():raise ValueError(c+'의 빈칸·문자·무한값을 확인하세요. 자동으로 0을 넣지 않습니다.')
    if (df['mrr']<=0).any():raise ValueError('평균 제거율 정답은 양수여야 합니다. 출처와 계산을 확인하세요.')
    if source=='SIM':
        for c,low,high in [('duration_s',30,75),('initial_thickness_nm',1000,1000)]:
            if c not in df:raise ValueError('필수 열이 없습니다: '+c)
            values=pd.to_numeric(df[c],errors='coerce')
            if not values.between(low,high).all():raise ValueError(c+'의 교육용 범위를 확인하세요.')
        if not df.timestamp.astype(str).str.contains(r'(?:Z|[+-]\d{2}:\d{2})$',regex=True).all():raise ValueError('SIM 시각에 시간대가 필요합니다.')
    # REAL timestamp is a proprietary scaled ordering value, not a calendar date.
    if source=='REAL':df['_order']=pd.to_numeric(df['timestamp'],errors='coerce')
    else:df['_order']=pd.to_datetime(df['timestamp'],errors='coerce',utc=True)
    if df['_order'].isna().any():raise ValueError('시간/순서 값을 확인하세요.')
    groups=df.groupby('wafer_id',sort=False)['_order'].agg(['min','max']).sort_values(['min','max'],kind='stable')
    if len(groups)<30:raise ValueError('학습·검증·시험을 나누려면 서로 다른 웨이퍼가 30개 이상 필요합니다. 시뮬레이터의 실험표 60장을 수집하세요.')
    n=len(groups);a=n*70//100;b=n*85//100
    mapping={key:('train' if i<a else 'validation' if i<b else 'test') for i,key in enumerate(groups.index)}
    df['split']=df['wafer_id'].map(mapping)
    # A group that crosses a chronological boundary must not leak later records into training.
    for first,second in [('train','validation'),('validation','test')]:
        if df.loc[df.split==first,'_order'].max()>df.loc[df.split==second,'_order'].min():
            raise ValueError('동일 웨이퍼의 시간 구간이 분할 경계를 가로지릅니다. 웨이퍼별 한 행으로 요약하거나 경계를 다시 정하세요.')
    return df,source,features,stages[0]

def predict_json(model,frame):
    X=frame[model['features']].to_numpy(dtype=np.float32)
    output=[]
    for row in X:
        total=0.0
        for t in model['trees']:
            i=0;steps=0
            while t['left'][i]!=-1:
                steps+=1
                if steps>50:raise ValueError('이전 모델의 나무 구조가 잘못되었습니다.')
                i=t['left'][i] if row[t['feature'][i]]<=t['threshold'][i] else t['right'][i]
            total+=t['value'][i]
        output.append(total/len(model['trees']))
    return np.array(output)

def fit_and_export(frame,outdir,version='student-v1'):
    import re
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,60}',str(version)):raise ValueError('모델 버전은 영문·숫자·밑줄·하이픈 1~60자로 적으세요.')
    df,source,features,stage=prepare(frame)
    train=df[df.split=='train'];val=df[df.split=='validation'];test=df[df.split=='test']
    rf=RandomForestRegressor(n_estimators=48,max_depth=8,min_samples_leaf=2,random_state=42,n_jobs=1)
    rf.fit(train[features],train.mrr)
    baseline=float(train.mrr.mean());metrics={}
    for name,data in [('validation',val),('test',test)]:
        p=rf.predict(data[features]);metrics[name]={'n':len(data),'mae':float(mean_absolute_error(data.mrr,p)),'baseline_mae':float(mean_absolute_error(data.mrr,np.full(len(data),baseline)))}
    model={'format':'daa-cmp-rf-v1','schema_version':'1.0.0','source':source,'stage':stage,'features':features,'target':'mrr','target_unit':'nm/min (educational)' if source=='SIM' else 'proprietary_scaled','inference_timing':'post_process_pre_inspection','model_version':str(version)[:80],'sklearn_version':sklearn.__version__,'training_ranges':{f:[float(train[f].min()),float(train[f].max())] for f in features},'split_counts':df.split.value_counts().to_dict(),'metrics':metrics,'split_rule':'wafer groups by time 70/15/15; training only; validation for policy; test once','trees':[]}
    from datetime import datetime,timezone
    model.update(model_id=source+'-'+version,source_type=source,feature_columns=features,feature_types={f:'number' for f in features},imputer_params={'strategy':'reject_missing','scaling':'none'},target_name='mrr',training_dataset_hash=hashlib.sha256(train.drop(columns=['_order']).to_csv(index=False).encode()).hexdigest(),trained_at=datetime.now(timezone.utc).isoformat(),model_format='daa-cmp-rf-v1',model_parameters={'n_estimators':48,'max_depth':8,'min_samples_leaf':2,'random_state':42},input_cast='float32')
    for est in rf.estimators_:
        t=est.tree_;model['trees'].append({'left':t.children_left.tolist(),'right':t.children_right.tolist(),'feature':t.feature.tolist(),'threshold':t.threshold.tolist(),'value':t.value[:,0,0].tolist()})
    all_pred=rf.predict(df[features]);delta=float(np.max(np.abs(all_pred-predict_json(model,df))))
    if delta>1e-9:raise RuntimeError('모델 저장 후 예측 검증에 실패했습니다.')
    model['export_max_abs_error']=delta
    out=Path(outdir);out.mkdir(parents=True,exist_ok=True)
    path=out/f'{source}_model_{version}.json';path.write_text(json.dumps(model,ensure_ascii=False,allow_nan=False,separators=(',',':')),encoding='utf-8')
    df['predicted_mrr']=all_pred;df['absolute_error']=abs(df.mrr-all_pred)
    if source=='SIM':
        df['predicted_thickness_nm']=pd.to_numeric(df.initial_thickness_nm)-all_pred*pd.to_numeric(df.duration_s)/60
    clean=df.drop(columns=['_order'])
    clean.to_csv(out/f'{source}_predictions_{version}.csv',index=False,encoding='utf-8-sig')
    clean[clean.split=='validation'].to_csv(out/f'{source}_validation_{version}.csv',index=False,encoding='utf-8-sig')
    clean[clean.split=='test'].to_csv(out/f'{source}_test_{version}.csv',index=False,encoding='utf-8-sig')
    (out/f'{source}_metrics_{version}.json').write_text(json.dumps(metrics,ensure_ascii=False,indent=2))
    return model,clean,metrics

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('csv');p.add_argument('out');p.add_argument('--version',default='teacher-v1');a=p.parse_args()
    m,d,metrics=fit_and_export(pd.read_csv(a.csv),a.out,a.version)
    print(json.dumps({'source':m['source'],'rows':len(d),'split':m['split_counts'],'metrics':metrics,'parity':m['export_max_abs_error']},ensure_ascii=False))
