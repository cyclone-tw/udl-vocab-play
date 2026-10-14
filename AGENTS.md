# AGENTS.md — udl-vocab-play

公開靜態站：南一國語生字語詞練習。掃 QR 就能在手機／平板玩。

<!-- udl-family-block v1 -->
> **UDL 教學家族**：本 repo 是國語生字語詞配對遊戲（公開，過渡）；平台上線、RPG UI/UX 定案後改成平台裡的一種練習。
>
> 上游：教師本機的原始教材檔（生字表、語詞解釋；來源檔不進 git，遊戲用的課程 JSON 照「加下一課」進 git）、`udl-content-spec`（之後改成內容包時的格式）；下游：學生裝置（目前直接開 GitHub Pages）；之後由 `udl-learning` 平台呈現。
>
> 家族地圖正本：`cyclone-tw/udl-learning` 的 `docs/family-map.md`（私人 repo）。要改本 repo 的角色或串接方式，先改地圖。
<!-- /udl-family-block -->

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
