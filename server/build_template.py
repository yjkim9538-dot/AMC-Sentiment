# 운용사 배포용 엑셀 양식 생성 (가독성·작성 편의 개선판)
# 실행: python3 build_template.py  → public/templates/AMC_컨센서스_양식.xlsx
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'templates', 'AMC_컨센서스_양식.xlsx')
os.makedirs(os.path.dirname(OUT), exist_ok=True)

NAVY = '1A2A4A'
HEAD_FILL = PatternFill('solid', fgColor=NAVY)
SUB_FILL = PatternFill('solid', fgColor='EEF3FB')
EX_FILL = PatternFill('solid', fgColor='FBFBF5')
HEAD_FONT = Font(color='FFFFFF', bold=True, size=11)
TITLE_FONT = Font(color=NAVY, bold=True, size=15)
NOTE_FONT = Font(color='5A6678', size=10)
EX_FONT = Font(color='9AA3B2', italic=True, size=10)
THIN = Side(style='thin', color='D7DEE8')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
CENTER = Alignment(horizontal='center', vertical='center', wrap_text=True)
LEFT = Alignment(horizontal='left', vertical='center', wrap_text=True)

wb = Workbook()

def style_header(ws, headers, row=1):
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=row, column=c, value=h)
        cell.fill = HEAD_FILL; cell.font = HEAD_FONT
        cell.alignment = CENTER; cell.border = BORDER
    ws.row_dimensions[row].height = 30

def widths(ws, ws_widths):
    for col, w in ws_widths.items():
        ws.column_dimensions[col].width = w

def example_row(ws, values, row):
    for c, v in enumerate(values, 1):
        cell = ws.cell(row=row, column=c, value=v)
        cell.fill = EX_FILL; cell.font = EX_FONT
        cell.alignment = LEFT; cell.border = BORDER

def dropdown(ws, options, col_letter, first=2, last=200):
    dv = DataValidation(type='list', formula1='"%s"' % ','.join(options), allow_blank=True)
    dv.error = '목록에서 선택하세요: ' + ' / '.join(options)
    dv.errorTitle = '입력 값 확인'
    dv.prompt = ' / '.join(options) + ' 중 선택'
    dv.promptTitle = '선택'
    ws.add_data_validation(dv)
    dv.add('%s%d:%s%d' % (col_letter, first, col_letter, last))

# ── 시트 0: 작성안내 ──
guide = wb.active
guide.title = '작성안내'
guide.sheet_view.showGridLines = False
guide['A1'] = '증시 컨센서스 작성 안내'
guide['A1'].font = TITLE_FONT
notes = [
    '',
    '■ 군인공제회 증권운용1팀 — 위탁운용사(AMC) 증시 컨센서스 제출 양식입니다.',
    '',
    '1) 아래 3개 시트를 작성해 주세요:  [국내시장]  [국내종목]  [해외]',
    '2) 색이 옅은 (예시) 행은 참고용입니다. 지우고 그 아래부터 작성하시거나, 덮어쓰셔도 됩니다.',
    '3) 회색 음영 셀(방향성/의견)은 클릭하면 드롭다운으로 선택할 수 있습니다.',
    '   · 방향성 = 강세 / 중립 / 약세',
    '   · 의견   = 매수 / 중립 / 매도',
    '4) 목표밴드는 지수의 예상 하단~상단을 숫자로 입력합니다. (예: KOSPI 2,700 ~ 3,000)',
    '5) Pro(긍정사유) / Con(부정사유)는 핵심만 간결히 적어 주세요.',
    '6) [국내종목]은 운용사가 자유롭게 선정한 Top Pick 종목을 적습니다(행 수 제한 없음).',
    '7) [해외] 시장은 미국 / 일본 / 베트남 / 인도 / ACWI / 선진국 6개가 기본 제공됩니다.',
    '',
    '※ 작성 후 파일을 그대로 담당자에게 회신하시면 됩니다. (파일명은 자유)',
]
for i, t in enumerate(notes, start=2):
    guide.cell(row=i, column=1, value=t).font = NOTE_FONT
    guide.cell(row=i, column=1).alignment = LEFT
guide.column_dimensions['A'].width = 95

# ── 시트 1: 국내시장 ──
m = wb.create_sheet('국내시장')
m.sheet_view.showGridLines = False
mh = ['운용사명', '작성일', '방향성', 'KOSPI 목표 하단', 'KOSPI 목표 상단', 'Pro (긍정사유)', 'Con (부정사유)']
style_header(m, mh)
m['C1'].comment = Comment('강세 / 중립 / 약세 중 선택', 'guide')
example_row(m, ['(예시) 미래에셋자산운용', '2026-06-20', '강세', 2750, 3050,
                '반도체 업황 회복, 외국인 순매수 전환', '미국 금리 인하 지연, 중국 둔화'], 2)
widths(m, {'A': 22, 'B': 13, 'C': 12, 'D': 15, 'E': 15, 'F': 40, 'G': 40})
m.freeze_panes = 'A2'
dropdown(m, ['강세', '중립', '약세'], 'C')

# ── 시트 2: 국내종목 ──
s = wb.create_sheet('국내종목')
s.sheet_view.showGridLines = False
sh = ['운용사명', '종목명', '의견', '사유']
style_header(s, sh)
s['C1'].comment = Comment('매수 / 중립 / 매도 중 선택', 'guide')
for r, (st, op, rs) in enumerate([
    ('삼성전자', '매수', 'HBM 경쟁력 회복, 메모리 업황 반등'),
    ('SK하이닉스', '매수', 'AI 수요 수혜, HBM 시장 선두'),
], start=2):
    example_row(s, ['(예시) 미래에셋자산운용', st, op, rs], r)
widths(s, {'A': 22, 'B': 18, 'C': 10, 'D': 52})
s.freeze_panes = 'A2'
dropdown(s, ['매수', '중립', '매도'], 'C')

# ── 시트 3: 해외 ──
o = wb.create_sheet('해외')
o.sheet_view.showGridLines = False
oh = ['운용사명', '작성일', '시장', '기준지수', '방향성', '목표 하단', '목표 상단', 'Pro (긍정사유)', 'Con (부정사유)']
style_header(o, oh)
o['E1'].comment = Comment('강세 / 중립 / 약세 중 선택', 'guide')
markets = [('미국', 'S&P500'), ('일본', 'Nikkei225'), ('베트남', 'VN-Index'),
           ('인도', 'Nifty50'), ('ACWI', 'MSCI ACWI'), ('선진국', 'MSCI World')]
# 예시 1행 + 시장별 빈 가이드 행(운용사명만 비움 → 작성자가 채움)
example_row(o, ['(예시) 미래에셋자산운용', '2026-06-20', '미국', 'S&P500', '강세', 5400, 6000,
                'AI 투자 사이클 지속', '밸류에이션 부담'], 2)
for i, (mk, idx) in enumerate(markets, start=3):
    for c, v in enumerate(['', '', mk, idx, '', '', '', '', ''], 1):
        cell = o.cell(row=i, column=c, value=v)
        cell.border = BORDER
        cell.alignment = LEFT if c in (1, 8, 9) else CENTER
        if c in (3, 4):
            cell.fill = SUB_FILL
            cell.font = Font(bold=True, color=NAVY, size=10)
widths(o, {'A': 22, 'B': 13, 'C': 10, 'D': 13, 'E': 10, 'F': 11, 'G': 11, 'H': 36, 'I': 36})
o.freeze_panes = 'A2'
dropdown(o, ['강세', '중립', '약세'], 'E', first=2, last=200)

wb.save(OUT)
print('saved:', os.path.abspath(OUT))
