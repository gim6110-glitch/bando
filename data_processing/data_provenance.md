# PHM 2016 실제 공개 자료와 교육용 추출 이력
공식: https://phmsociety.org/conference/annual-conference-of-the-phm-society/annual-conference-of-the-prognostics-and-health-management-society-2016/phm-data-challenge-4/
공식 설명 PDF: https://phmsociety.org/wp-content/uploads/2016/05/PHM16DataChallengeCFP.pdf
확보 경로: https://github.com/akangel0307/PHM-Data-Challenge
확인일: 2026-10-17. 고정 commit: 00d443e3f57379e3ad3d12c15a0738282b8210e5.

공식 원배포 링크는 다운로드 대신 HTML을 반환하여 사용하지 못했습니다. 비공식 공개 보관소의 CMP-training-000.csv~184.csv 185개와 CMP-training-removalrate.csv를 실제로 확보했습니다. 각 파일 Git blob SHA와 SHA-256을 검증했습니다. 미러 파일 내부 일치성을 확인한 것이며, 접근 불가한 공식 원본과 모든 바이트를 대조했다고 주장하지 않습니다.

25개 원래 열로 완전히 동일한 행 1819개만 제거하고 670925행을 통합했습니다. WAFER_ID×STAGE별 산술 평균을 계산했습니다. 활동 구간 필터는 적용하지 않았고 0값과 극단 레이블을 임의 삭제하지 않았습니다. 양측 키 1981개가 모두 일대일로 결합되었습니다. A 1166개·B 815개 중 수업 기본은 A만 사용합니다.

입력: MAIN_OUTER_AIR_BAG_PRESSURE, WAFER_ROTATION, USAGE_OF_POLISHING_TABLE, SLURRY_FLOW_LINE_C의 웨이퍼·단계별 평균. 정답: AVG_REMOVAL_RATE. 시간은 변환된 TIMESTAMP의 최대값으로 순서만 사용하며 달력 시각이 아닙니다. source manifest에 원본 파일·해시·크기·행 수·변환 내역을 남겼습니다.
실제 센서/운전 시계열에서 나온 공개 CMP 자료지만 특정 삼성전자·SK하이닉스 자료로 확인되지 않았습니다. 변환된 숫자를 원단위로 복원하지 않습니다.

원자료 전체는 이 교육 묶음에 재포장하지 않았습니다. 수업용 요약과 모델은 분석 산출물이며, 공개 GitHub/Netlify 소스에서는 REAL 행·원자료·REAL 모델을 제외했습니다. 미러의 MIT LICENSE가 원소유 PHM 제3자 데이터에 대한 재배포 권한 전체를 보증한다고 해석하지 않습니다. 기관 외부 공개 재배포 전 원출처 이용 조건을 확인하세요. 학생은 출처와 build_dataset.py로 동일 요약을 재현할 수 있습니다.

공식 test 정답을 확보한 것으로 주장하지 않습니다. 표의 validation/test는 레이블이 있는 training 내부에서 웨이퍼 시간순으로 나눈 보류집합입니다. AI 검증 MAE 40.862는 평균 기준 36.509보다 나쁩니다. 시험 MAE 60.584는 평균 기준 62.061과 비교합니다. 이 관측 자료로 인과관계·불량률·수율을 계산하지 않습니다.
