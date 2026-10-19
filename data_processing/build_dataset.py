"""Rebuild the educational PHM2016 stage-A table from pinned public mirror files.
Python 3.10+, pandas. Run from this folder: python build_dataset.py --raw-dir raw
Use --no-download to validate a previously downloaded full source collection.
The public source is transformed data; no physical units are reconstructed.
"""
from pathlib import Path
import argparse, hashlib, json, urllib.parse, urllib.request, concurrent.futures
import pandas as pd

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--raw-dir',type=Path,default=Path('raw'));p.add_argument('--output-dir',type=Path,default=Path('rebuilt'));p.add_argument('--no-download',action='store_true');a=p.parse_args()
 manifest_path=Path(__file__).with_name('REAL_source_manifest.json')
 m=json.loads(manifest_path.read_text(encoding='utf-8'));a.raw_dir.mkdir(parents=True,exist_ok=True);a.output_dir.mkdir(parents=True,exist_ok=True)
 def get(record):
  file=a.raw_dir/record['filename']
  if not file.exists():
   if a.no_download:raise FileNotFoundError(file)
   url='https://raw.githubusercontent.com/akangel0307/PHM-Data-Challenge/'+m['commit']+'/'+urllib.parse.quote(record['path'])
   with urllib.request.urlopen(url,timeout=60) as response:blob=response.read()
   if hashlib.sha256(blob).hexdigest()!=record['sha256']:raise ValueError('Downloaded hash mismatch: '+file.name)
   file.write_bytes(blob)
  blob=file.read_bytes()
  if len(blob)!=record['bytes'] or hashlib.sha256(blob).hexdigest()!=record['sha256']:raise ValueError('Source integrity mismatch: '+file.name)
  return file
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:files=list(pool.map(get,m['files']))
 paths=sorted(f for f in files if f.name.startswith('CMP-training-') and f.stem[-3:].isdigit())
 if len(paths)!=185:raise ValueError('Complete training collection of 185 CSV files is required.')
 raw=pd.concat([pd.read_csv(f).assign(_file=f.name) for f in paths],ignore_index=True)
 original=[c for c in raw if c!='_file'];before=len(raw);raw=raw.drop_duplicates(original)
 labels=pd.read_csv(a.raw_dir/'CMP-training-removalrate.csv')
 if labels.duplicated(['WAFER_ID','STAGE']).any():raise ValueError('Duplicate ground-truth keys.')
 mapping={'MAIN_OUTER_AIR_BAG_PRESSURE':'pressure_scaled','WAFER_ROTATION':'rotation_scaled','USAGE_OF_POLISHING_TABLE':'pad_usage_scaled','SLURRY_FLOW_LINE_C':'slurry_scaled'}
 g=raw.groupby(['WAFER_ID','STAGE'],sort=False);means=g[list(mapping)].mean().rename(columns=mapping)
 means['timestamp']=g.TIMESTAMP.max();means['trace_start']=g.TIMESTAMP.min();means['trace_rows']=g.size();means['raw_file_count']=g._file.nunique();means['raw_files']=g._file.agg(lambda s:';'.join(sorted(s.unique())))
 joined=means.reset_index().merge(labels,on=['WAFER_ID','STAGE'],how='outer',validate='one_to_one',indicator=True)
 if not (joined._merge=='both').all():raise ValueError('Unmatched wafer-stage ground truth.')
 frame=joined[joined.STAGE=='A'].rename(columns={'WAFER_ID':'wafer_id','STAGE':'stage','AVG_REMOVAL_RATE':'mrr'}).sort_values(['timestamp','wafer_id'],kind='stable').copy()
 if len(frame)!=1166 or frame[list(mapping.values())+['mrr']].isna().any().any():raise ValueError('Unexpected processed record count or missing values.')
 frame['schema_version']='1.0.0';frame['source']='REAL';frame['run_id']='PHM2016-'+frame.wafer_id.astype(str)+'-A';frame['sequence']=range(1,len(frame)+1)
 cols=['schema_version','source','run_id','wafer_id','stage','timestamp','sequence']+list(mapping.values())+['mrr','trace_start','trace_rows','raw_file_count','raw_files']
 out=a.output_dir/'REAL_PHM2016_stage_A.csv';frame[cols].to_csv(out,index=False,encoding='utf-8-sig')
 report={'commit':m['commit'],'verified_source_files':len(files),'raw_training_files':len(paths),'removed_exact_duplicates':before-len(raw),'trace_rows':len(raw),'wafer_stage_groups':len(joined),'stage_A_rows':len(frame),'output_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'aggregation':'arithmetic mean of all available trace rows, no active-phase filter','timestamp':'scaled source ordering value; not calendar date','units':'original proprietary transformed scale'}
 (a.output_dir/'build_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
