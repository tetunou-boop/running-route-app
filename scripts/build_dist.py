#!/usr/bin/env python3
"""index.html / css / js / data を1ファイルに束ねて dist/index.html を生成する。

data/group_companies.json を更新した後は、このスクリプトを再実行して
dist/index.html（Netlify等への配布用ファイル）を最新化すること。

Usage:
    python3 scripts/build_dist.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

FETCH_BLOCK = '''  function loadData() {
    return fetch("data/group_companies.json")
      .then((res) => {
        if (!res.ok) throw new Error("データの読み込みに失敗しました");
        return res.json();
      })
      .then((data) => {
        state.segments = data.segments;
        state.meta = data.meta;
        state.companies = data.segments.flatMap((segment) =>
          segment.companies.map((company) => ({
            ...company,
            segmentId: segment.id,
            segmentName: segment.name,
            prefecture: extractPrefecture(company.hq)
          }))
        );
        state.selectedSegments = new Set(data.segments.map((s) => s.id));
      });
  }'''


def build():
    data = json.loads((ROOT / "data" / "group_companies.json").read_text(encoding="utf-8"))
    data_literal = json.dumps(data, ensure_ascii=False)

    css = (ROOT / "css" / "styles.css").read_text(encoding="utf-8")
    js = (ROOT / "js" / "app.js").read_text(encoding="utf-8")

    embedded_block = f'''  const EMBEDDED_DATA = {data_literal};

  function loadData() {{
    return Promise.resolve(EMBEDDED_DATA).then((data) => {{
      state.segments = data.segments;
      state.meta = data.meta;
      state.companies = data.segments.flatMap((segment) =>
        segment.companies.map((company) => ({{
          ...company,
          segmentId: segment.id,
          segmentName: segment.name,
          prefecture: extractPrefecture(company.hq)
        }}))
      );
      state.selectedSegments = new Set(data.segments.map((s) => s.id));
    }});
  }}'''

    if FETCH_BLOCK not in js:
        raise SystemExit("js/app.js の loadData() の形が変わっています。FETCH_BLOCK を更新してください。")
    js = js.replace(FETCH_BLOCK, embedded_block)

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
