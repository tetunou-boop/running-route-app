#!/usr/bin/env python3
"""index.html / css / js / data を1ファイルに束ねて dist/index.html を生成する。

data/group_companies.json を更新した後は、このスクリプトを再実行して
dist/index.html（Netlify等への配布用ファイル）を最新化すること。

js/app.js のロジック（データの整形・マッピング部分）を変更しても、
fetch() の呼び出し部分さえ変わらなければこのスクリプトの修正は不要。

Usage:
    python3 scripts/build_dist.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

FETCH_CALL = '''fetch("data/group_companies.json")
      .then((res) => {
        if (!res.ok) throw new Error("データの読み込みに失敗しました");
        return res.json();
      })'''


def build():
    data = json.loads((ROOT / "data" / "group_companies.json").read_text(encoding="utf-8"))
    data_literal = json.dumps(data, ensure_ascii=False)

    css = (ROOT / "css" / "styles.css").read_text(encoding="utf-8")
    js = (ROOT / "js" / "app.js").read_text(encoding="utf-8")

    if FETCH_CALL not in js:
        raise SystemExit("js/app.js の fetch() 呼び出しの形が変わっています。FETCH_CALL を更新してください。")
    js = js.replace(FETCH_CALL, "Promise.resolve(EMBEDDED_DATA)")
    js = js.replace(
        "(function () {\n  \"use strict\";",
        f'(function () {{\n  "use strict";\n\n  const EMBEDDED_DATA = {data_literal};',
        1,
    )

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = html.replace(
        '<link rel="stylesheet" href="css/styles.css">',
        f"<style>\n{css}\n  </style>",
    )
    html = html.replace(
        '<script src="js/app.js"></script>',
        f"<script>\n{js}\n  </script>",
    )

    dist_dir = ROOT / "dist"
    dist_dir.mkdir(exist_ok=True)
    (dist_dir / "index.html").write_text(html, encoding="utf-8")
    print(f"dist/index.html を生成しました（{len(html):,} bytes）")


if __name__ == "__main__":
    build()
