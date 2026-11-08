# 账号文件

默认情况下，应用把图表保存在浏览器里。开启账号模式后，图表会保存到你自己的服务器，同一用户可以在其他设备继续打开。

## 开启方法

设置：

```bash
ACCOUNT_MODE=true
```

服务端会把账号、登录会话和文件保存到 SQLite 数据库 `data/accounts.db`。需要其他位置时，设置 `ACCOUNT_DB_PATH`。Docker Compose 已经把 `./data` 挂载到 `/app/data`，因此容器替换后数据库不会丢失。容器内的 `nextjs` 用户（uid 1001）需要能写入该目录；如果挂载目录属主不对，可执行 `sudo chown -R 1001:1001 data` 修复。

不设置该变量时，账号模式关闭；普通匿名应用和浏览器保存行为不会改变。

## 创建用户

先设置 `ADMIN_PASSWORD`，打开 `/admin` 并以管理员身份登录。然后可以在该页面的浏览器控制台调用账号 API：

```js
await fetch("/api/admin/accounts", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "x-admin-password": "管理员密码",
    },
    body: JSON.stringify({
        username: "alice",
        password: "足够长的密码",
    }),
})
```

这里没有公开注册入口。用户名可使用 3 到 32 位字母、数字、点号、下划线或连字符；密码至少 10 位。

## 使用文件中心

先访问 `/login` 登录，再打开 `/files`。文件中心包含：

-   最近文件
-   我的文件，支持文件夹
-   回收站，可恢复或永久删除
-   搜索、排序以及网格/列表布局
-   重命名、移动和删除
-   “导入浏览器文件”，用于从匿名应用一次性迁移

编辑器会自动保存图表、对话、缩略图和版本历史。如果其他设备先保存了同一个文件，当前设备的修改会另存为冲突副本，不会直接覆盖。
