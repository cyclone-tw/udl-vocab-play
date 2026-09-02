# AGENTS.md — udl-vocab-play

公開靜態站：南一國語生字語詞練習。掃 QR 就能在手機／平板玩。

## 硬紅線

- 課文 PDF、教師手冊、課文原句不進 git。
- 可識別學生資料不進 git、不上公開頁。
- 圖內不要文字、字母、數字、浮水印。

## 加下一課

1. 從教師本機生字表／語詞解釋抽出這一課。
2. 新增 `data/lessons/nan3a-XX.json`（`vocab` + `phrases`，白話意思）。
3. 在 `data/catalog.json` 把該課 `ready` 改 `true` 並填 `file`。
4. 跑 `python3 scripts/validate.py`。
5. 本機 `python3 -m http.server` 試玩後再推。

## 驗收

- 注音配對、聽音配對、識字小考、語詞小考都能走完一局。
- 對錯有音效。滿分有正向結算。
- 不要依賴 CDN 才能玩（QR 庫已放 `vendor/`）。
