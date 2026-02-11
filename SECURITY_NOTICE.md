# Repository Security Notice

We recently removed sensitive credentials from the repository history and rotated exposed credentials.

Action required for all collaborators:

- Delete your local clone (or make a fresh clone):

```bash
cd ~
rm -rf wifisentry-1
git clone https://github.com/dvntone/wifisentry.git
```

- Recreate your local `.env` from `.env.example` and do NOT commit it.
- If you had any personal access tokens or keys in the repository, rotate them immediately.

If you need help re-connecting CI or secrets, see `SECURITY.md` and contact the repo owner.
