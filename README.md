# Koyomi カレンダー

スマホで使えるPWAカレンダーアプリです。

---

## ① PCでの起動方法（開発・確認用）

```bash
# Node.js が必要です（https://nodejs.org からインストール）
cd koyomi
npm install
npm run dev
# → http://localhost:3000 で開く
```

---

## ② Vercelへのデプロイ（iPhone対応・無料・5分）

### 1. GitHubにアップロード
1. https://github.com にアクセスしてアカウント作成（または既存でログイン）
2. 「New repository」→ 名前を `koyomi` にして作成
3. このフォルダをドラッグ＆ドロップ、またはコマンドで push

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/koyomi.git
git push -u origin main
```

### 2. Vercelにデプロイ
1. https://vercel.com にアクセス → GitHubでログイン
2. 「Add New Project」→ koyomiリポジトリを選択
3. 設定はデフォルトのまま「Deploy」をクリック
4. 1〜2分で `https://koyomi-xxx.vercel.app` のURLが発行される

### 3. iPhoneでホーム画面に追加
1. iPhoneのSafariで発行されたURLを開く
2. 画面下の「共有」ボタン（四角に矢印）をタップ
3. 「ホーム画面に追加」をタップ
4. 「追加」をタップ

→ ホーム画面にKoyomiのアイコンが追加され、**フルスクリーンのアプリとして起動**できます！

---

## 機能

- 月・週・日の3つのビュー
- 予定の追加・編集・削除（日付・時間・カラー・備考）
- テンプレート機能（バイトなど定型予定をワンタップで追加）
- 空き時間の自動検知とタスク入力
- タスク管理（折りたたみ式パネル）
- データはブラウザのlocalStorageに自動保存

---

## データについて

予定・テンプレート・タスクはすべてブラウザの `localStorage` に保存されます。
同じデバイスのSafariで開く限り、データは保持されます。
（異なるデバイス間の同期には対応していません）
