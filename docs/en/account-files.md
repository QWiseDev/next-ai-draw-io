# Account files

The app saves diagrams in the browser by default. Turn on account mode to save
them on your own server instead, so the same user can open them from another
device.

## Turn it on

Set:

```bash
ACCOUNT_MODE=true
```

The server keeps accounts, sessions and files in a SQLite database at
`data/accounts.db`. To use another location, set `ACCOUNT_DB_PATH`. Docker
Compose already mounts `./data` to `/app/data`, so the database survives a
container replacement. The in-container `nextjs` user (uid 1001) must be able
to write to that directory; if the mounted directory has the wrong owner, run
`sudo chown -R 1001:1001 data` to fix it.

Account mode is off unless you set this variable. The normal anonymous app,
with diagrams saved in the browser, does not change.

## Create users

With `ADMIN_PASSWORD` set, open `/admin`, sign in as the administrator and call
the account API from the browser console on that page:

```js
await fetch("/api/admin/accounts", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "x-admin-password": "your-admin-password",
    },
    body: JSON.stringify({
        username: "alice",
        password: "a long password",
    }),
})
```

There is no public sign-up. Usernames use 3 to 32 letters, numbers, dots,
underscores or hyphens; passwords need at least 10 characters.

## Use the file center

Sign in at `/login`, then open `/files`. The center has:

-   Recent files
-   My files, with folders
-   Trash, where files can be restored or deleted permanently
-   Search, sorting and a grid or list layout
-   Rename, move and delete actions
-   Import browser files, for one-time migration from the anonymous app

The editor automatically saves the diagram, its conversation, thumbnail and
version history. If another device saved the same file first, the app keeps the
changes on this device as a conflict copy instead of overwriting them.
