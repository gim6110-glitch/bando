# CMP 시뮬레이터

반도체 CMP 공정 기반 D-A-A LOOP 10차시 수업용 웹앱입니다. 앱 1.1.0 / 데이터 규격 1.0.0. Python 학습과 JavaScript 예측은 동일한 실제 Random Forest 모델을 사용합니다.

## Netlify 연결

1. Add new project → Import an existing project → GitHub에서 `gim6110-glitch/bando` 선택.
2. Branch `main`, Base directory 비움, Build command `npm run build`, Publish directory `dist`. 저장소의 netlify.toml에 설정되어 있습니다.
3. 배포 후 Project configuration의 Visitor access에서 Production을 Public으로 설정합니다. 로그아웃 창과 휴대전화에서 확인합니다.
4. 다른 앱도 별도로 연결합니다. 시뮬레이터 `bando`, 관제탑 `bando2`입니다.
5. 데이터와 학습 화면에서 다른 사이트의 실제 HTTPS 주소를 저장하면 이동 링크가 생깁니다. 두 사이트의 브라우저 저장 공간은 서로 다릅니다.

현재 Netlify 연결은 사용자가 후속 진행합니다. 아직 발급되지 않은 URL을 넣지 않았습니다.

## 실행과 검증

Node 20 이상에서 `npm ci`, `npm test`, `npm run build`. 별도 npm 의존성이나 CDN, API 키, 서버, 방문자 계정이 없습니다. dist가 호스팅 산출물입니다. file://로 여는 오프라인 배포는 제공하지 않습니다.

16개 핵심 테스트와 8개 이벤트 처리 통합 테스트를 실행합니다. 후자는 DOM 대역을 쓰는 Node 시험으로 실제 브라우저·모바일 화면 검증을 뜻하지 않습니다. 미리보기는 실행 환경의 proc 마운트 권한 오류로 차단되었습니다.

## 학생 수행

시뮬레이터에서 조건 비교 → 60장 CSV → SIM Colab → 결과 ZIP의 모델 JSON → 관제탑에 모델과 새 CSV 접수 → 검사 확인 → 품질 신호 적용 → 운전 허가·별도 시작 → 새 웨이퍼로 LOOP 비교.

관제탑의 A/C는 공통, B/D는 조별 시험입니다. 시험 버튼은 제공 모델과 고정 시험 자료를 사용하고, 검사 완료를 로그에 남깁니다. 내 모델은 CSV 접수로 평가합니다. `시험 순서 JSON 재현`은 23개 전이를 같은 상태 함수로 검증합니다. 검사 전 예측만으로 모의 운전을 승인하지 않으며 새 웨이퍼는 새 운전 허가가 필요합니다.

## 데이터와 범위

SIM은 교육용 합성 자료입니다. REAL은 PHM 2016의 변환 척도를 별도 학습하며 공개 저장소에 원자료·요약 행·REAL 모델을 재배포하지 않습니다. 정답·검사 두께는 입력에 사용하지 않습니다. 원자료 가공 재현은 `data_processing` 안내를 봅니다.

연구 응답, 전문가 신원, 학생 실명·점수, 비밀키는 포함하지 않습니다. 개인 실습은 브라우저 내부에만 보관되므로 CSV/JSON으로 저장하고 공용 PC에서는 초기화하세요. 실제 PLC 제어·산업 디지털 트윈이 아닙니다.

## 원출처

- PHM 설명: https://phmsociety.org/wp-content/uploads/2016/05/PHM16DataChallengeCFP.pdf
- 확보에 사용한 비공식 미러: https://github.com/akangel0307/PHM-Data-Challenge
- CMP 공정: https://www.appliedmaterials.com/us/en/semiconductor/products/processes/cmp.html
- Netlify 연결: https://docs.netlify.com/start/quickstarts/deploy-from-repository/
