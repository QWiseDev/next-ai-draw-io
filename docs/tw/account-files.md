# 帳號檔案

預設情況下，應用會將圖表儲存在瀏覽器裡。開啟帳號模式後，圖表會儲存到你自己的伺服器，同一使用者可以在其他裝置繼續開啟。

## 開啟方法

設定：

```bash
ACCOUNT_MODE=true
```

伺服器會將帳號、登入工作階段和檔案儲存到 SQLite 資料庫 `data/accounts.db`。需要其他位置時，可設定 `ACCOUNT_DB_PATH`。Docker Compose 已將 `./data` 掛載到 `/app/data`，因此容器替換後資料庫不會遺失。

未設定該變數時，帳號模式關閉；一般匿名應用和瀏覽器儲存行為不會改變。

## 建立使用者

先設定 `ADMIN_PASSWORD`，開啟 `/admin` 並以管理員身分登入。接著可以在該頁面的瀏覽器主控台呼叫帳號 API：

```js
await fetch("/api/admin/accounts", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "x-admin-password": "管理員密碼",
    },
    body: JSON.stringify({
        username: "alice",
        password: "足夠長的密碼",
    }),
})
```

這裡沒有公開註冊入口。使用者名稱可使用 3 到 32 位字母、數字、點號、底線或連字號；密碼至少 10 位。

## 使用檔案中心

先造訪 `/login` 登入，再開啟 `/files`。檔案中心包含：

-   最近檔案
-   我的檔案，支援資料夾
-   回收筒，可還原或永久刪除
-   搜尋、排序以及網格/清單版面
-   重新命名、移動和刪除
-   「匯入瀏覽器檔案」，用於從匿名應用一次性遷移

編輯器會自動儲存圖表、對話、縮圖和版本歷史。如果其他裝置先儲存了同一檔案，目前裝置的修改會另存為衝突副本，不會直接覆蓋。
